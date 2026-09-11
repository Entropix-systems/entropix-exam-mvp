export interface VersionedCommand {
  expectedVersion: number;
}

export interface IdempotentCommandMetadata {
  idempotencyKey: string;
}

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export const IDEMPOTENCY_RETENTION_HOURS = 24;
