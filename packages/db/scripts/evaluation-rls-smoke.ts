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
  const cedarAssignments = await withTenant(prisma, cedar.id, (tx) => tx.evaluationAssignment.findMany({
    where: { examSubject: { exam: { code: 'ANNUAL-2026' } } },
    include: { faculty: true, examSubject: { include: { exam: true } } },
  }));
  if (cedarAssignments.length !== 3) {
    throw new Error('Cedar evaluation assignment fixture is invalid');
  }
  const unscoped = await Promise.all([
    prisma.evaluationAssignment.count(),
    prisma.marksBatch.count(),
    prisma.mark.count(),
  ]);
  if (unscoped.some(Boolean)) throw new Error('Missing tenant context exposed evaluation records');
  const cedarAssignmentId = cedarAssignments[0]!.id;
  const foreign = await withTenant(prisma, northstar.id, (tx) => tx.evaluationAssignment.findFirst({ where: { id: cedarAssignmentId } }));
  if (foreign) throw new Error('Northstar scope exposed a Cedar evaluation assignment');
  console.log('Cedar evaluation assignments: ' + cedarAssignments.length);
  console.log('Evaluation tenant isolation and assignments: READY');
} finally {
  await prisma.$disconnect();
}
