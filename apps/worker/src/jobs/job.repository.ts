import { createHash, randomUUID } from 'node:crypto';
import {
  type Prisma,
  type PrismaClient,
  type WorkerJob,
  type WorkerOutput,
  withTenant,
} from '@entropix/db';

export interface CompletedWorkerOutput {
  checksum: string;
  objectKey?: string | null;
  output: Prisma.InputJsonValue;
}

export function outputChecksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class WorkerJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  enqueue(tenantId: string, kind: string, businessKey: string, payload: Prisma.InputJsonValue, availableAt: Date): Promise<WorkerJob> {
    return withTenant(this.prisma, tenantId, (tx) => tx.workerJob.upsert({
      where: { tenantId_kind_businessKey: { tenantId, kind, businessKey } },
      create: { tenantId, kind, businessKey, payload, availableAt },
      update: {},
    }));
  }

  claim(tenantId: string, leaseOwner: string, now: Date, leaseMilliseconds: number): Promise<WorkerJob | null> {
    if (!leaseOwner.trim() || leaseMilliseconds < 1) throw new Error('INVALID_LEASE');
    const leaseExpiresAt = new Date(now.getTime() + leaseMilliseconds);
    return withTenant(this.prisma, tenantId, async (tx) => {
      const claimed = await tx.$queryRaw<Array<{ id: string }>>`
        WITH candidate AS (
          SELECT "id"
          FROM "worker_jobs"
          WHERE "tenant_id" = ${tenantId}::uuid
            AND "available_at" <= ${now}
            AND ("state" = 'READY' OR ("state" = 'LEASED' AND "lease_expires_at" <= ${now}))
          ORDER BY "created_at", "id"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE "worker_jobs" AS job
        SET "state" = 'LEASED',
            "lease_owner" = ${leaseOwner},
            "lease_expires_at" = ${leaseExpiresAt},
            "attempt_count" = job."attempt_count" + 1,
            "updated_at" = ${now}
        FROM candidate
        WHERE job."id" = candidate."id"
        RETURNING job."id"
      `;
      if (!claimed[0]) return null;
      return tx.workerJob.findFirstOrThrow({ where: { tenantId, id: claimed[0].id } });
    });
  }

  complete(tenantId: string, jobId: string, leaseOwner: string, value: CompletedWorkerOutput, now: Date): Promise<WorkerOutput> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const job = await tx.workerJob.findFirst({ where: { tenantId, id: jobId } });
      if (!job) throw new Error('JOB_NOT_FOUND');
      if (job.state === 'COMPLETED') return tx.workerOutput.findFirstOrThrow({ where: { tenantId, jobId } });
      if (job.state !== 'LEASED' || job.leaseOwner !== leaseOwner || !job.leaseExpiresAt || job.leaseExpiresAt <= now) throw new Error('LEASE_LOST');
      const output = await tx.workerOutput.upsert({
        where: { tenantId_kind_businessKey: { tenantId, kind: job.kind, businessKey: job.businessKey } },
        create: {
          id: randomUUID(), tenantId, jobId: job.id, kind: job.kind, businessKey: job.businessKey,
          checksum: value.checksum, objectKey: value.objectKey ?? null, output: value.output,
        },
        update: {},
      });
      const completed = await tx.workerJob.updateMany({
        where: { tenantId, id: job.id, state: 'LEASED', leaseOwner, leaseExpiresAt: { gt: now } },
        data: { state: 'COMPLETED', leaseOwner: null, leaseExpiresAt: null, completedAt: now },
      });
      if (completed.count !== 1) throw new Error('LEASE_LOST');
      return output;
    });
  }
}
