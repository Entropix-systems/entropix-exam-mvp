import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '@entropix/db';
import { WorkerJobRepository } from '../src/jobs/job.repository.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const [tenantId, workerId, nowValue, businessKey] = process.argv.slice(2);
assert.ok(tenantId && workerId && nowValue && businessKey, 'Crash-worker arguments are required');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const jobs = new WorkerJobRepository(prisma);
const claimed = await jobs.claim(tenantId, workerId, new Date(nowValue), 1_000);
assert.equal(claimed?.businessKey, businessKey, 'Crash worker did not claim the expected job');
process.stdout.write('LEASE_CLAIMED_BEFORE_CRASH\n');
process.exit(86);
