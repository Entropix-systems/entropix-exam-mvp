import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outputChecksum } from './job.repository.js';

describe('durable worker job foundation', () => {
  it('uses a deterministic output checksum', () => {
    expect(outputChecksum({ publicationId: 'fixture', version: 1 })).toBe(outputChecksum({ publicationId: 'fixture', version: 1 }));
    expect(outputChecksum({ publicationId: 'fixture', version: 2 })).not.toBe(outputChecksum({ publicationId: 'fixture', version: 1 }));
  });

  it('enforces tenant RLS and unique business output in the migration', () => {
    const sql = readFileSync(resolve(process.cwd(), '../../packages/db/prisma/migrations/20260914160000_worker_recovery/migration.sql'), 'utf8');
    expect(sql).toContain('ALTER TABLE "worker_jobs" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "worker_outputs" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('worker_jobs_tenant_kind_business_key_key');
    expect(sql).toContain('worker_outputs_tenant_kind_business_key_key');
  });

  it('claims work with row locking that permits concurrent workers', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/jobs/job.repository.ts'), 'utf8');
    expect(source).toContain('FOR UPDATE SKIP LOCKED');
  });
});
