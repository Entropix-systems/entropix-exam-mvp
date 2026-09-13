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
    let controllerGrant = await tx.roleGrant.findFirst({
      where: { tenantId: tenant.id, role: { in: ['EXAM_CONTROLLER', 'INSTITUTION_ADMIN'] }, membership: { status: 'ACTIVE' } },
      include: { membership: true },
    });
    if (!controllerGrant) {
      const user = await tx.user.upsert({
        where: { email: 'exam.controller@cedar.example.test' },
        update: { status: 'ACTIVE' },
        create: { email: 'exam.controller@cedar.example.test', status: 'ACTIVE' },
      });
      const membership = await tx.membership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: { status: 'ACTIVE' },
        create: { tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
      });
      const grant = await tx.roleGrant.findFirst({ where: { tenantId: tenant.id, membershipId: membership.id, role: 'EXAM_CONTROLLER', departmentId: null } })
        ?? await tx.roleGrant.create({ data: { tenantId: tenant.id, membershipId: membership.id, role: 'EXAM_CONTROLLER' } });
      controllerGrant = { ...grant, membership };
    }
    const faculty = await tx.faculty.findMany({ where: { tenantId: tenant.id, status: 'ACTIVE' }, orderBy: { code: 'asc' } });
    const sittings = await tx.hallSitting.findMany({
      where: { tenantId: tenant.id, examPaper: { exam: { code: 'ANNUAL-2026' } } },
      include: { examPaper: true }, orderBy: { examPaper: { startsAt: 'asc' } },
    });
    if (faculty.length === 0 || sittings.length === 0) throw new Error('Run people, exam and scheduling seeds first');
    for (const member of faculty) {
      const existingGrant = await tx.roleGrant.findFirst({ where: { tenantId: tenant.id, membershipId: member.membershipId, role: 'INVIGILATOR', departmentId: null } });
      if (!existingGrant) await tx.roleGrant.create({ data: { tenantId: tenant.id, membershipId: member.membershipId, role: 'INVIGILATOR' } });
    }
    let created = 0;
    for (const [index, sitting] of sittings.entries()) {
      const assigned = faculty[index % faculty.length]!;
      const existing = await tx.duty.findFirst({ where: { tenantId: tenant.id, hallSittingId: sitting.id, facultyId: assigned.id, state: { in: ['PENDING', 'ACCEPTED'] } } });
      if (!existing) {
        await tx.duty.create({ data: { tenantId: tenant.id, hallSittingId: sitting.id, facultyId: assigned.id, assignedByMembershipId: controllerGrant.membership.id } });
        created += 1;
      }
    }
    return { sittings: sittings.length, invigilators: faculty.length, created };
  }, { maxWait: 10_000, timeout: 120_000 });
  console.log(`Conduct fixture ready: ${tenant.name} (${result.sittings} sittings, ${result.invigilators} invigilators, ${result.created} duties created)`);
} finally {
  await prisma.$disconnect();
}
