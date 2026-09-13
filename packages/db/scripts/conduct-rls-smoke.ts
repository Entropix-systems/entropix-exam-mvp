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
  const cedarState = await withTenant(prisma, cedar.id, async (tx) => ({
    duties: await tx.duty.count(),
    pending: await tx.duty.count({ where: { state: 'PENDING' } }),
    invigilators: await tx.roleGrant.count({ where: { role: 'INVIGILATOR' } }),
    sittings: await tx.hallSitting.count({ where: { examPaper: { exam: { code: 'ANNUAL-2026' } } } }),
  }));
  if (cedarState.duties !== 3 || cedarState.pending !== 3 || cedarState.invigilators < 3 || cedarState.sittings !== 3) throw new Error(`Cedar conduct fixture is invalid: ${JSON.stringify(cedarState)}`);
  const unscoped = await Promise.all([prisma.duty.count(), prisma.attendanceBatch.count(), prisma.attendance.count(), prisma.incident.count(), prisma.incidentStudent.count()]);
  if (unscoped.some(Boolean)) throw new Error('Missing tenant context exposed conduct records');
  const cedarDutyId = await withTenant(prisma, cedar.id, async (tx) => (await tx.duty.findFirstOrThrow()).id);
  if (await withTenant(prisma, northstar.id, (tx) => tx.duty.findFirst({ where: { id: cedarDutyId } }))) throw new Error('Northstar scope exposed a Cedar duty');
  console.log(`Cedar conduct: ${JSON.stringify(cedarState)}`);
  console.log('Conduct tenant isolation and assignment fixtures: READY');
} finally {
  await prisma.$disconnect();
}
