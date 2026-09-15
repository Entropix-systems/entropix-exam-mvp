import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createPrismaClient, withTenant } from '@entropix/db';
import { StudentPortalRepository } from '../src/modules/documents/student-portal.repository.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const prisma = createPrismaClient(connectionString, {
  sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
});

try {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: process.env.PORTAL_SMOKE_TENANT_SLUG?.trim() || 'northstar-college' },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error('Portal smoke tenant not found');

  const students = await withTenant(prisma, tenant.id, (tx) => tx.student.findMany({
    where: { tenantId: tenant.id, registrations: { some: { state: 'APPROVED' } } },
    select: { id: true, membershipId: true },
    orderBy: { rollNo: 'asc' },
    take: 2,
  }));
  if (!students[0]) throw new Error('No student with an approved registration was found');

  const repository = new StudentPortalRepository(prisma);
  const snapshots = await Promise.all(students.map((student) => repository.snapshot(tenant.id, student.membershipId)));
  for (const [index, snapshot] of snapshots.entries()) {
    if (snapshot.student.id !== students[index]!.id) throw new Error('Resolved membership returned another student');
    if (snapshot.registrations.some((registration) => registration.state !== 'APPROVED')) throw new Error('Non-approved registration was visible');
    for (const document of snapshot.documents) {
      if (!document.current) throw new Error('A stale document was returned as current');
      if (document.kind === 'ADMIT_CARD' && !snapshot.timetables.some((timetable) => timetable.examId === document.examId && timetable.scheduleRevision === document.version)) {
        throw new Error('Admit card was not bound to the current schedule revision');
      }
      if (document.kind === 'GRADE_CARD' && (!snapshot.result || snapshot.result.outcome === 'WITHHELD' || snapshot.result.publicationVersion !== document.version)) {
        throw new Error('Grade card was not bound to an eligible current publication');
      }
    }
    if (snapshot.result?.outcome === 'WITHHELD') {
      const held = snapshot.result as unknown as Record<string, unknown>;
      if ('percentage' in held || 'gpa' in held || 'items' in held) throw new Error('WITHHELD result leaked numeric or component detail');
    }
  }

  console.log(`Student portal smoke passed for ${snapshots.length} scoped ${tenant.name} student(s).`);
  console.log(`Current data: ${snapshots[0].registrations.length} approved registration(s), ${snapshots[0].timetables.length} published timetable(s), result ${snapshots[0].result?.outcome ?? 'NOT_PUBLISHED'}.`);
} finally {
  await prisma.$disconnect();
}
