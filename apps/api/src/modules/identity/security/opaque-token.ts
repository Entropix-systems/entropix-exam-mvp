import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits of entropy. Raw tokens are transport-only secrets: never persist/log. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(rawToken: string): string {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(rawToken) ||
    Buffer.from(rawToken, 'base64url').toString('base64url') !== rawToken
  )
    throw new Error('Invalid opaque token');
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function matchesOpaqueToken(
  rawToken: string,
  tokenHash: string,
): boolean {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return false;
  try {
    return timingSafeEqual(
      Buffer.from(hashOpaqueToken(rawToken), 'hex'),
      Buffer.from(tokenHash, 'hex'),
    );
  } catch {
    return false;
  }
}
