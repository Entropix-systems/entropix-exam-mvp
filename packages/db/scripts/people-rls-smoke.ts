import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, {
  sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
});

try {
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  const cedar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const countsFor = (tenantId: string) => withTenant(prisma, tenantId, async (tx) => ({
    students: await tx.student.count(),
    faculty: await tx.faculty.count(),
    enrolments: await tx.enrolment.count(),
    imports: await tx.studentImport.count(),
  }), { timeout: 30_000 });
  const [northstarCounts, cedarCounts] = await Promise.all([
    countsFor(northstar.id),
    countsFor(cedar.id),
  ]);
  const expectedNorthstar = { students: 100, faculty: 4, enrolments: 300, imports: 1 };
  const expectedCedar = { students: 20, faculty: 3, enrolments: 60, imports: 1 };
  if (JSON.stringify(northstarCounts) !== JSON.stringify(expectedNorthstar))
    throw new Error(`Northstar people counts are invalid: ${JSON.stringify(northstarCounts)}`);
  if (JSON.stringify(cedarCounts) !== JSON.stringify(expectedCedar))
    throw new Error(`Cedar people counts are invalid: ${JSON.stringify(cedarCounts)}`);

  const [unscopedStudents, unscopedFaculty, unscopedEnrolments] = await Promise.all([
    prisma.student.count(),
    prisma.faculty.count(),
    prisma.enrolment.count(),
  ]);
  if (unscopedStudents || unscopedFaculty || unscopedEnrolments)
    throw new Error('Missing tenant context exposed people records');

  const cedarState = await withTenant(prisma, cedar.id, async (tx) => ({
    studentId: (await tx.student.findFirstOrThrow()).id,
    subjectId: (await tx.subject.findFirstOrThrow()).id,
  }));
  const northstarState = await withTenant(prisma, northstar.id, async (tx) => ({
    student: await tx.student.findFirstOrThrow({ where: { rollNo: 'NS26001' } }),
  }));
  const foreignRead = await withTenant(prisma, northstar.id, (tx) =>
    tx.student.findFirst({ where: { id: cedarState.studentId } }));
  if (foreignRead) throw new Error('Northstar scope exposed a Cedar student');
  const selfRows = await withTenant(prisma, northstar.id, (tx) =>
    tx.student.count({ where: { membershipId: northstarState.student.membershipId } }));
  if (selfRows !== 1) throw new Error(`Student membership resolved ${selfRows} profiles`);

  let foreignSubjectRejected = false;
  try {
    await withTenant(prisma, northstar.id, (tx) => tx.enrolment.create({
      data: {
        id: randomUUID(),
        tenantId: northstar.id,
        studentId: northstarState.student.id,
        cohortId: northstarState.student.cohortId,
        subjectId: cedarState.subjectId,
      },
    }));
  } catch {
    foreignSubjectRejected = true;
  }
  if (!foreignSubjectRejected) throw new Error('Cross-tenant enrolment was accepted');

  console.log(`Northstar people counts: ${JSON.stringify(northstarCounts)}`);
  console.log(`Cedar people counts: ${JSON.stringify(cedarCounts)}`);
  console.log('People tenant and self scope: READY');
} finally {
  await prisma.$disconnect();
}
