import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import type { AccessTokenIdentity } from '@entropix/contracts';
import { Argon2PasswordHasher } from './password-hasher.js';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  matchesOpaqueToken,
} from './opaque-token.js';
import { JoseAccessTokenCodec } from './access-token.js';
import {
  DEFAULT_TOKEN_POLICY,
  tokenPolicy,
  tokenPolicyFromEnv,
} from './token-policy.js';
import { refreshCookiePolicy } from './cookie-policy.js';

const identity: AccessTokenIdentity = {
  kind: 'TENANT',
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenantId: '11111111-1111-4111-8111-111111111111',
  membershipId: '22222222-2222-4222-8222-222222222222',
};
const secret = randomBytes(32);
const configuration = {
  algorithm: 'HS256',
  issuer: 'urn:exam:identity',
  audience: 'urn:exam:api',
  secret,
} as const;
const epoch = new Date('2026-09-13T00:00:00Z');

describe('password hashing', () => {
  it('uses salted Argon2id, verifies passwords, and fails closed on malformed hashes', async () => {
    const hasher = new Argon2PasswordHasher();
    const password = 'fictional development password 🔐';
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);
    expect(first).toMatch(/^\$argon2id\$v=19\$/);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(password);
    expect(await hasher.verify(password, first)).toBe(true);
    expect(await hasher.verify('wrong password', first)).toBe(false);
    expect(await hasher.verify(password, 'malformed')).toBe(false);
    expect(await hasher.verify(password, '$argon2id$malformed')).toBe(false);
  });
});

describe('opaque tokens', () => {
  it('generates independent 256-bit URL-safe secrets and deterministic hashes', () => {
    const tokens = Array.from({ length: 128 }, generateOpaqueToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const raw of tokens) {
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(raw, 'base64url')).toHaveLength(32);
      const hash = hashOpaqueToken(raw);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(hashOpaqueToken(raw));
      expect(hash).not.toBe(raw);
      expect(matchesOpaqueToken(raw, hash)).toBe(true);
      expect(matchesOpaqueToken(generateOpaqueToken(), hash)).toBe(false);
    }
  });
  it('rejects malformed tokens/hashes without leaking token contents', () => {
    expect(() => hashOpaqueToken('secret-invalid')).toThrow(
      'Invalid opaque token',
    );
    expect(matchesOpaqueToken('bad', 'a'.repeat(64))).toBe(false);
    expect(matchesOpaqueToken(generateOpaqueToken(), 'bad')).toBe(false);
  });
});

describe('access token signing and verification', () => {
  it('round-trips tenant/platform identity, with no role authorization claims', async () => {
    const codec = new JoseAccessTokenCodec(configuration, () => epoch);
    for (const value of [
      identity,
      {
        kind: 'PLATFORM',
        userId: identity.userId,
        sessionId: identity.sessionId,
      } as const,
      {
        kind: 'PLATFORM',
        userId: identity.userId,
        sessionId: identity.sessionId,
        tenantId: identity.tenantId,
      } as const,
    ]) {
      const token = await codec.sign(value);
      expect(await codec.verify(token)).toEqual(value);
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString(),
      );
      expect(payload.exp - payload.iat).toBe(900);
      expect(payload).not.toHaveProperty('roles');
      expect(payload).not.toHaveProperty('grants');
    }
  });
  it('rejects at exact expiry and before issue time', async () => {
    const signer = new JoseAccessTokenCodec(configuration, () => epoch);
    const token = await signer.sign(identity);
    await expect(
      new JoseAccessTokenCodec(
        configuration,
        () => new Date(+epoch + 899000),
      ).verify(token),
    ).resolves.toEqual(identity);
    await expect(
      new JoseAccessTokenCodec(
        configuration,
        () => new Date(+epoch + 900000),
      ).verify(token),
    ).rejects.toThrow('Invalid access token');
    await expect(
      new JoseAccessTokenCodec(
        configuration,
        () => new Date(+epoch - 1000),
      ).verify(token),
    ).rejects.toThrow('Invalid access token');
  });
  it('rejects tampering, wrong signature, issuer, audience, and configuration', async () => {
    const codec = new JoseAccessTokenCodec(configuration, () => epoch);
    const token = await codec.sign(identity);
    const parts = token.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
        sub: identity.sessionId,
      }),
    ).toString('base64url');
    await expect(codec.verify(parts.join('.'))).rejects.toThrow(
      'Invalid access token',
    );
    for (const override of [
      { secret: randomBytes(32) },
      { issuer: 'wrong' },
      { audience: 'wrong' },
    ]) {
      await expect(
        new JoseAccessTokenCodec(
          { ...configuration, ...override },
          () => epoch,
        ).verify(token),
      ).rejects.toThrow('Invalid access token');
    }
    expect(
      () =>
        new JoseAccessTokenCodec({
          ...configuration,
          secret: new Uint8Array(8),
        }),
    ).toThrow();
    expect(
      () =>
        new JoseAccessTokenCodec({
          ...configuration,
          algorithm: 'none' as never,
        }),
    ).toThrow();
  });
  it('rejects signed tokens with missing claims, wrong algorithm/type or invalid binding', async () => {
    const codec = new JoseAccessTokenCodec(configuration, () => epoch);
    const now = +epoch / 1000;
    const valid = {
      sub: identity.userId,
      sid: identity.sessionId,
      kind: 'PLATFORM',
      iss: configuration.issuer,
      aud: configuration.audience,
      iat: now,
      exp: now + 900,
    };
    const invalidPayloads: Record<string, unknown>[] = [
      { ...valid, exp: undefined },
      { ...valid, iat: undefined },
      { ...valid, sid: undefined },
      { ...valid, sub: 'invalid' },
      { ...valid, kind: 'TENANT' },
      { ...valid, exp: now + 901 },
      { ...valid, exp: now },
    ];
    for (const payload of invalidPayloads) {
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
        .sign(secret);
      await expect(codec.verify(token)).rejects.toThrow('Invalid access token');
    }
    for (const header of [
      { alg: 'HS384', typ: 'at+jwt' },
      { alg: 'HS256', typ: 'JWT' },
    ]) {
      const token = await new SignJWT(valid)
        .setProtectedHeader(header)
        .sign(secret);
      await expect(codec.verify(token)).rejects.toThrow('Invalid access token');
    }
  });
});

describe('token and cookie configuration', () => {
  it('uses corrected configurable defaults with no absolute-session policy', () => {
    expect(DEFAULT_TOKEN_POLICY).toEqual({
      accessTtlSeconds: 900,
      refreshTtlSeconds: 604800,
      invitationTtlSeconds: 86400,
      passwordResetTtlSeconds: 1800,
    });
    expect(
      tokenPolicyFromEnv({ PASSWORD_RESET_TTL_SECONDS: '1200' })
        .passwordResetTtlSeconds,
    ).toBe(1200);
    expect(tokenPolicy({ accessTtlSeconds: 300 }).accessTtlSeconds).toBe(300);
    for (const value of [0, -1, Infinity, NaN, 0.5])
      expect(() => tokenPolicy({ accessTtlSeconds: value })).toThrow();
    for (const value of ['', '0', '-1', 'bad', '1.5'])
      expect(() =>
        tokenPolicyFromEnv({ REFRESH_TOKEN_TTL_SECONDS: value }),
      ).toThrow();
  });
  it('uses host-only HttpOnly SameSite cookies and matching clear attributes', () => {
    const cookie = refreshCookiePolicy({ environment: 'production' });
    expect(cookie.name).toBe('__Host-iam-refresh');
    expect(cookie.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 604800000,
    });
    expect(cookie.clearOptions).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(cookie.options).not.toHaveProperty('domain');
  });
  it('allows insecure cookies only for explicitly configured local development', () => {
    expect(
      refreshCookiePolicy({ environment: 'development' }).options.secure,
    ).toBe(true);
    expect(refreshCookiePolicy({ environment: 'test' }).options.secure).toBe(
      true,
    );
    expect(
      refreshCookiePolicy({
        environment: 'development',
        localDevelopment: true,
      }).options.secure,
    ).toBe(false);
    expect(() =>
      refreshCookiePolicy({
        environment: 'production',
        localDevelopment: true,
      }),
    ).toThrow();
  });
});
