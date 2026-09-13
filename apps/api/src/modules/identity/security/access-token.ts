import { SignJWT, jwtVerify } from 'jose';
import type { AccessTokenIdentity } from '@entropix/contracts';
import { isAccessTokenIdentity } from '@entropix/domain';
import { tokenPolicy } from './token-policy.js';

export abstract class AccessTokenCodec {
  abstract sign(identity: AccessTokenIdentity): Promise<string>;
  abstract verify(token: string): Promise<AccessTokenIdentity>;
}

export interface AccessTokenConfiguration {
  /** HS256 is the only allowed algorithm in this implementation. */
  algorithm: 'HS256';
  issuer: string;
  audience: string;
  /** At least 32 cryptographically random bytes; no default secret. */
  secret: Uint8Array;
  ttlSeconds?: number;
}

export class JoseAccessTokenCodec extends AccessTokenCodec {
  private readonly secret: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly ttl: number;

  constructor(
    config: AccessTokenConfiguration,
    private readonly clock: () => Date = () => new Date(),
  ) {
    super();
    if (
      config.algorithm !== 'HS256' ||
      !config.issuer?.trim() ||
      !config.audience?.trim() ||
      !(config.secret instanceof Uint8Array) ||
      config.secret.length < 32
    )
      throw new Error('Invalid access token configuration');
    this.secret = new Uint8Array(config.secret);
    this.issuer = config.issuer;
    this.audience = config.audience;
    this.ttl = tokenPolicy(
      config.ttlSeconds === undefined
        ? {}
        : { accessTtlSeconds: config.ttlSeconds },
    ).accessTtlSeconds;
  }

  async sign(identity: AccessTokenIdentity): Promise<string> {
    if (!isAccessTokenIdentity(identity))
      throw new Error('Invalid access identity');
    const now = Math.floor(this.clock().getTime() / 1000);
    const binding =
      identity.kind === 'TENANT'
        ? { tenantId: identity.tenantId, membershipId: identity.membershipId }
        : {};
    return new SignJWT({
      kind: identity.kind,
      sid: identity.sessionId,
      ...binding,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setSubject(identity.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttl)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenIdentity> {
    try {
      const now = this.clock();
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
        typ: 'at+jwt',
        requiredClaims: ['sub', 'sid', 'kind', 'iat', 'exp'],
        maxTokenAge: this.ttl,
        clockTolerance: 0,
        currentDate: now,
      });
      if (
        !Number.isSafeInteger(payload.iat) ||
        !Number.isSafeInteger(payload.exp) ||
        payload.exp! <= payload.iat! ||
        payload.exp! - payload.iat! > this.ttl
      )
        throw new Error();
      const identity = {
        kind: payload.kind,
        userId: payload.sub,
        sessionId: payload.sid,
        ...('tenantId' in payload ? { tenantId: payload.tenantId } : {}),
        ...('membershipId' in payload
          ? { membershipId: payload.membershipId }
          : {}),
      };
      if (!isAccessTokenIdentity(identity)) throw new Error();
      return identity;
    } catch {
      // No token, claims, or crypto-library diagnostics in public failures.
      throw new Error('Invalid access token');
    }
  }
}
