import type {
  StorageConfig,
} from './config.js';

export interface DocumentKeyInput {
  tenantId: string;
  category: string;
  documentId: string;
  versionId: string;
}

function safeSegment(
  value: string,
  name: string,
): string {
  const normalized =
    value.trim();

  if (
    !normalized ||
    !/^[A-Za-z0-9._-]+$/.test(
      normalized,
    )
  ) {
    throw new Error(
      `Unsafe storage key segment: ${name}`,
    );
  }

  return normalized;
}

function businessPath(
  input: DocumentKeyInput,
): string {
  return [
    safeSegment(
      input.tenantId,
      'tenantId',
    ),
    safeSegment(
      input.category,
      'category',
    ),
    safeSegment(
      input.documentId,
      'documentId',
    ),
    safeSegment(
      input.versionId,
      'versionId',
    ),
  ].join('/');
}

export function quarantineKey(
  config: StorageConfig,
  input: DocumentKeyInput,
): string {
  return (
    config.quarantinePrefix +
    businessPath(input)
  );
}

export function cleanKey(
  config: StorageConfig,
  input: DocumentKeyInput,
): string {
  return (
    config.cleanPrefix +
    businessPath(input)
  );
}

export function generatedKey(
  config: StorageConfig,
  input: DocumentKeyInput,
): string {
  return (
    config.generatedPrefix +
    businessPath(input)
  );
}
