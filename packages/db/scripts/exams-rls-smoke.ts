import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });

try {
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  const cedar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const counts = (tenantId: string, examCode: string) => withTenant(prisma, tenantId, async (tx) => ({
    exams: await tx.exam.count({ where: { code: examCode } }),
    examSubjects: await tx.examSubject.count({ where: { exam: { code: examCode } } }),
    registrations: await tx.registration.count({ where: { exam: { code: examCode } } }),
    registrationSubjects: await tx.registrationSubject.count({ where: { examSubject: { exam: { code: examCode } } } }),
    approved: await tx.registration.count({ where: { exam: { code: examCode }, state: 'APPROVED' } }),
  }));
  const [northstarCounts, cedarCounts] = await Promise.all([
    counts(northstar.id, 'SEM3-2026'),
    counts(cedar.id, 'ANNUAL-2026'),
  ]);
  if (JSON.stringify(northstarCounts) !== JSON.stringify({ exams: 1, examSubjects: 3, registrations: 1, registrationSubjects: 3, approved: 0 })) throw new Error(`Northstar exam counts are invalid: ${JSON.stringify(northstarCounts)}`);
  if (JSON.stringify(cedarCounts) !== JSON.stringify({ exams: 1, examSubjects: 3, registrations: 20, registrationSubjects: 60, approved: 20 })) throw new Error(`Cedar exam counts are invalid: ${JSON.stringify(cedarCounts)}`);
  const unscoped = await Promise.all([prisma.exam.count(), prisma.examSubject.count(), prisma.registration.count(), prisma.registrationSubject.count()]);
  if (unscoped.some(Boolean)) throw new Error('Missing tenant context exposed exam or registration records');
  const cedarExamId = await withTenant(prisma, cedar.id, async (tx) => (await tx.exam.findFirstOrThrow({ where: { code: 'ANNUAL-2026' } })).id);
  const foreignExam = await withTenant(prisma, northstar.id, (tx) => tx.exam.findFirst({ where: { id: cedarExamId } }));
  if (foreignExam) throw new Error('Northstar scope exposed a Cedar exam');
  const rosterIds = await withTenant(prisma, cedar.id, (tx) => tx.registrationSubject.findMany({ where: { examSubject: { exam: { code: 'ANNUAL-2026' } } }, select: { id: true } }));
  if (new Set(rosterIds.map((entry) => entry.id)).size !== 60) throw new Error('Approved roster IDs are not stable and unique');
  console.log(`Northstar exams: ${JSON.stringify(northstarCounts)}`);
  console.log(`Cedar exams: ${JSON.stringify(cedarCounts)}`);
  console.log('Exam tenant isolation and approved roster IDs: READY');
} finally {
  await prisma.$disconnect();
}
