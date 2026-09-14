import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient, withTenant, type PrismaClient, type TenantTransaction } from '@entropix/db';
import { generatedKey, loadStorageConfig, PrivateObjectStorage } from '@entropix/storage';
import { outputChecksum } from '../src/jobs/job.repository.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const source = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const storage = new PrivateObjectStorage(loadStorageConfig());
const container = 'entropix-exam-postgres';
const token = randomUUID().replaceAll('-', '').slice(0, 12);
const restoreDatabase = `exam_restore_${token}`;
const containerDump = `/tmp/${restoreDatabase}.dump`;
const tempDirectory = await mkdtemp(join(tmpdir(), 'entropix-release-restore-'));
const objectBackup = join(tempDirectory, 'referenced-object.bin');
let restore: PrismaClient | null = null;
let tenantId = '';
let jobId = '';
let objectKey = '';
let databaseCreated = false;

async function command(program: string, args: string[], allowFailure = false) {
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(program, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
  });
  if (!allowFailure && result.code !== 0) throw new Error(`${program} failed (${result.code}): ${result.stderr.trim()}`);
}

function restoredUrl(sourceUrl: string) {
  const value = new URL(sourceUrl);
  value.pathname = `/${restoreDatabase}`;
  return value.toString();
}

async function counts(tx: TenantTransaction) {
  const values = await Promise.all([
    tx.membership.count(), tx.campus.count(), tx.department.count(), tx.program.count(), tx.academicYear.count(),
    tx.term.count(), tx.cohort.count(), tx.subject.count(), tx.student.count(), tx.faculty.count(), tx.enrolment.count(),
    tx.studentImport.count(), tx.ruleVersion.count(), tx.exam.count(), tx.examSubject.count(), tx.registration.count(),
    tx.registrationSubject.count(), tx.examPaper.count(), tx.hall.count(), tx.hallSitting.count(), tx.seatAssignment.count(),
    tx.duty.count(), tx.attendanceBatch.count(), tx.attendance.count(), tx.incident.count(), tx.incidentStudent.count(),
    tx.evaluationAssignment.count(), tx.marksBatch.count(), tx.mark.count(), tx.resultRun.count(), tx.resultItem.count(),
    tx.studentResult.count(), tx.publication.count(), tx.auditEvent.count(), tx.workerJob.count(), tx.workerOutput.count(),
  ]);
  const names = [
    'memberships', 'campuses', 'departments', 'programs', 'academicYears', 'terms', 'cohorts', 'subjects', 'students',
    'faculty', 'enrolments', 'studentImports', 'ruleVersions', 'exams', 'examSubjects', 'registrations',
    'registrationSubjects', 'examPapers', 'halls', 'hallSittings', 'seatAssignments', 'duties', 'attendanceBatches',
    'attendance', 'incidents', 'incidentStudents', 'evaluationAssignments', 'marksBatches', 'marks', 'resultRuns',
    'resultItems', 'studentResults', 'publications', 'auditEvents', 'workerJobs', 'workerOutputs',
  ];
  return Object.fromEntries(names.map((name, index) => [name, values[index]]));
}

async function snapshot(client: PrismaClient, currentTenantId: string) {
  return withTenant(client, currentTenantId, async (tx) => ({
    counts: await counts(tx),
    currentPublications: (await tx.publication.findMany({
      where: { isCurrent: true },
      include: { exam: { select: { code: true } }, resultRun: { select: { checksum: true } } },
      orderBy: [{ exam: { code: 'asc' } }, { version: 'asc' }],
    })).map((publication) => ({ examCode: publication.exam.code, version: publication.version, resultChecksum: publication.resultRun.checksum })),
  }));
}

async function download(key: string) {
  const response = await fetch(await storage.signedDownloadUrl(key, 60));
  assert.equal(response.ok, true, 'Referenced private object could not be downloaded');
  return new Uint8Array(await response.arrayBuffer());
}

try {
  const tenant = await source.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  tenantId = tenant.id;
  objectKey = generatedKey(storage.config, { tenantId, category: 'recovery-evidence', documentId: randomUUID(), versionId: randomUUID() });
  const objectBytes = Buffer.from(`A15 referenced object ${token}`, 'utf8');
  await storage.putGeneratedObject(objectKey, objectBytes, 'application/octet-stream');
  await writeFile(objectBackup, objectBytes);

  jobId = randomUUID();
  const businessKey = `A15-${token}`;
  const completedAt = new Date();
  await withTenant(source, tenantId, async (tx) => {
    await tx.workerJob.create({ data: {
      id: jobId, tenantId, kind: 'RECOVERY_EVIDENCE', businessKey, payload: { objectKey }, state: 'COMPLETED',
      availableAt: completedAt, completedAt,
    } });
    const output = { objectKey, bytes: objectBytes.byteLength };
    await tx.workerOutput.create({ data: {
      id: randomUUID(), tenantId, jobId, kind: 'RECOVERY_EVIDENCE', businessKey,
      checksum: outputChecksum(output), objectKey, output,
    } });
  });

  const tenants = await source.tenant.findMany({ orderBy: { slug: 'asc' }, select: { id: true, slug: true } });
  const baseline = Object.fromEntries(await Promise.all(tenants.map(async (entry) => [entry.slug, await snapshot(source, entry.id)])));

  await command('/usr/local/bin/docker', ['exec', container, 'pg_dump', '-U', 'exam_bootstrap', '--format=custom', '--no-owner', '--file', containerDump, 'exam_mvp']);
  await storage.delete(objectKey);
  assert.equal(await storage.exists(objectKey), false, 'Referenced object deletion simulation failed');
  await command('/usr/local/bin/docker', ['exec', container, 'createdb', '-U', 'exam_bootstrap', '-O', 'exam_bootstrap', restoreDatabase]);
  databaseCreated = true;
  await command('/usr/local/bin/docker', ['exec', container, 'pg_restore', '-U', 'exam_bootstrap', '--no-owner', '--dbname', restoreDatabase, containerDump]);

  restore = createPrismaClient(restoredUrl(connectionString), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
  const restoredTenants = await restore.tenant.findMany({ orderBy: { slug: 'asc' }, select: { id: true, slug: true } });
  assert.deepEqual(restoredTenants, tenants, 'Restored tenant identities differ from the backup');
  const restored = Object.fromEntries(await Promise.all(restoredTenants.map(async (entry) => [entry.slug, await snapshot(restore!, entry.id)])));
  assert.deepEqual(restored, baseline, 'Restored tenant record counts or current publications differ from the backup');
  assert.equal(await restore.workerJob.count(), 0, 'Restored database weakened missing-context RLS');
  const restoredReference = await withTenant(restore, tenantId, (tx) => tx.workerOutput.findFirstOrThrow({ where: { jobId }, select: { objectKey: true } }));
  assert.equal(restoredReference.objectKey, objectKey, 'Restored database lost the referenced object key');

  const backupBytes = await readFile(objectBackup);
  await storage.putGeneratedObject(objectKey, backupBytes, 'application/octet-stream');
  const restoredBytes = await download(objectKey);
  assert.equal(createHash('sha256').update(restoredBytes).digest('hex'), createHash('sha256').update(objectBytes).digest('hex'), 'Restored private object checksum differs');

  console.log('A15 database and object-storage restore: PASS');
  console.log(`  Tenant snapshots compared: ${tenants.length}`);
  console.log(`  Tenant-owned table counts compared per tenant: ${Object.keys((baseline[tenants[0]!.slug] as { counts: object }).counts).length}`);
  console.log('  Current publication identities, versions, and checksums: MATCH');
  console.log('  Referenced private object deleted and restored: PASS');
  console.log('  Restored object checksum: MATCH');
  console.log('  Restored missing-context RLS: DENIED');
} finally {
  if (restore) await restore.$disconnect();
  if (databaseCreated) await command('/usr/local/bin/docker', ['exec', container, 'dropdb', '-U', 'exam_bootstrap', '--force', restoreDatabase], true);
  await command('/usr/local/bin/docker', ['exec', container, 'rm', '-f', containerDump], true);
  if (jobId && tenantId) await withTenant(source, tenantId, async (tx) => {
    await tx.workerOutput.deleteMany({ where: { jobId } });
    await tx.workerJob.deleteMany({ where: { id: jobId } });
  });
  if (objectKey) await storage.delete(objectKey);
  await source.$disconnect();
  storage.client.destroy();
  await rm(tempDirectory, { recursive: true, force: true });
}
