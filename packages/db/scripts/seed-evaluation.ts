import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });

try {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const result = await withTenant(prisma, tenant.id, async (tx) => {
    const controllerGrant = await tx.roleGrant.findFirst({
      where: { tenantId: tenant.id, role: { in: ['EXAM_CONTROLLER', 'INSTITUTION_ADMIN'] }, membership: { status: 'ACTIVE' } },
    });
    if (!controllerGrant) throw new Error('Run the conduct seed first to create the Cedar controller');
    const [exam, faculty] = await Promise.all([
      tx.exam.findFirstOrThrow({
        where: { tenantId: tenant.id, code: 'ANNUAL-2026' },
        include: { subjects: { include: { subject: { include: { program: true } } }, orderBy: { subject: { code: 'asc' } } } },
      }),
      tx.faculty.findMany({ where: { tenantId: tenant.id, status: 'ACTIVE' }, orderBy: { code: 'asc' } }),
    ]);
    if (faculty.length === 0) throw new Error('Run the people seed first');
    let assignments = 0;
    for (const [index, examSubject] of exam.subjects.entries()) {
      const candidates = faculty.filter((entry) => entry.departmentId === examSubject.subject.program.departmentId);
      const assigned = candidates[index % candidates.length];
      if (!assigned) throw new Error('No active faculty exists in the subject department');
      const grant = await tx.roleGrant.findFirst({
        where: { tenantId: tenant.id, membershipId: assigned.membershipId, role: 'FACULTY', departmentId: null },
      });
      if (!grant) await tx.roleGrant.create({ data: { tenantId: tenant.id, membershipId: assigned.membershipId, role: 'FACULTY' } });
      await tx.evaluationAssignment.upsert({
        where: { tenantId_examSubjectId: { tenantId: tenant.id, examSubjectId: examSubject.id } },
        create: {
          tenantId: tenant.id,
          examSubjectId: examSubject.id,
          facultyId: assigned.id,
          assignedByMembershipId: controllerGrant.membershipId,
        },
        update: {
          facultyId: assigned.id,
          assignedByMembershipId: controllerGrant.membershipId,
          version: { increment: 1 },
        },
      });
      assignments += 1;
    }
    return { assignments, faculty: faculty.length };
  });
  console.log('Evaluation fixture ready: ' + tenant.name + ' (' + result.assignments + ' assignments, ' + result.faculty + ' faculty)');
} finally {
  await prisma.$disconnect();
}
