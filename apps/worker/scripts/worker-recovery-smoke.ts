import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient, withTenant } from '@entropix/db';
import { outputChecksum, WorkerJobRepository } from '../src/jobs/job.repository.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const jobs = new WorkerJobRepository(prisma);

async function runCrashWorker(args: string[]) {
  const runner = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
  const script = fileURLToPath(new URL('./crash-worker.ts', import.meta.url));
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(runner, [script, ...args], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
const otherTenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
const businessKey = `A13-${randomUUID()}`;
const firstWorker = `crash-${randomUUID()}`;
const recoveryWorker = `recovery-${randomUUID()}`;
const claimedAt = new Date('2032-01-01T00:00:00.000Z');
let jobId: string | null = null;

try {
  const job = await jobs.enqueue(tenant.id, 'GRADE_CARD', businessKey, { publicationId: randomUUID() }, claimedAt);
  jobId = job.id;
  const duplicate = await jobs.enqueue(tenant.id, 'GRADE_CARD', businessKey, { publicationId: randomUUID() }, claimedAt);
  assert.equal(duplicate.id, job.id, 'Duplicate enqueue created a second job');

  const crashed = await runCrashWorker([tenant.id, firstWorker, claimedAt.toISOString(), businessKey]);
  assert.equal(crashed.code, 86, `Crash worker returned ${crashed.code}: ${crashed.stderr}`);
  assert.match(crashed.stdout, /LEASE_CLAIMED_BEFORE_CRASH/);

  assert.equal(await jobs.claim(tenant.id, recoveryWorker, new Date(claimedAt.getTime() + 999), 1_000), null, 'Another worker claimed a live lease');
  const recovered = await jobs.claim(tenant.id, recoveryWorker, new Date(claimedAt.getTime() + 1_001), 1_000);
  assert.equal(recovered?.id, job.id, 'Expired lease was not recovered');
  assert.equal(recovered?.attemptCount, 2, 'Recovered job did not record its second attempt');

  const output = { publicationId: randomUUID(), version: 1 };
  await assert.rejects(jobs.complete(tenant.id, job.id, firstWorker, { checksum: outputChecksum(output), output }, new Date(claimedAt.getTime() + 1_100)), /LEASE_LOST/);
  const completed = await jobs.complete(tenant.id, job.id, recoveryWorker, { checksum: outputChecksum(output), output }, new Date(claimedAt.getTime() + 1_100));
  const retry = await jobs.complete(tenant.id, job.id, recoveryWorker, { checksum: outputChecksum(output), output }, new Date(claimedAt.getTime() + 1_200));
  assert.equal(retry.id, completed.id, 'Completion retry created a duplicate output');

  const scopedCounts = await withTenant(prisma, tenant.id, async (tx) => ({
    jobs: await tx.workerJob.count({ where: { kind: 'GRADE_CARD', businessKey } }),
    outputs: await tx.workerOutput.count({ where: { kind: 'GRADE_CARD', businessKey } }),
    state: await tx.workerJob.findFirstOrThrow({ where: { id: job.id }, select: { state: true, attemptCount: true } }),
  }));
  assert.deepEqual(scopedCounts, { jobs: 1, outputs: 1, state: { state: 'COMPLETED', attemptCount: 2 } });
  assert.equal(await prisma.workerJob.count(), 0, 'Missing tenant context exposed worker jobs');
  assert.equal(await prisma.workerOutput.count(), 0, 'Missing tenant context exposed worker outputs');
  assert.equal(await withTenant(prisma, otherTenant.id, (tx) => tx.workerJob.findFirst({ where: { id: job.id } })), null, 'Foreign tenant read recovered job');

  console.log('A13 worker crash/lease recovery: PASS');
  console.log('  Child process claimed lease and exited abruptly: PASS');
  console.log('  Live lease could not be stolen: PASS');
  console.log('  Expired lease resumed with attempt 2: PASS');
  console.log('  Stale worker completion: DENIED');
  console.log('  Duplicate enqueue/completion: one job, one output');
  console.log('  Missing-context and foreign-tenant reads: DENIED');
} finally {
  if (jobId) await withTenant(prisma, tenant.id, async (tx) => {
    await tx.workerOutput.deleteMany({ where: { jobId } });
    await tx.workerJob.deleteMany({ where: { id: jobId } });
  });
  await prisma.$disconnect();
}
