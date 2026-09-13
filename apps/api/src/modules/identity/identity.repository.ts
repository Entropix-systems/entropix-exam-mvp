import type {
  AccessTokenIdentity,
  AuthenticatedContext,
  AuthTokenPurpose,
  ScopedRoleGrant,
  UUID,
} from '@entropix/contracts';

export type SessionBinding =
  | { kind: 'PLATFORM'; tenantId: null; membershipId: null }
  | { kind: 'TENANT'; tenantId: UUID; membershipId: UUID };

/** Global authentication record; id is the refresh family identifier. */
export type SessionRecord = SessionBinding & {
  id: UUID;
  userId: UUID;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
};

export interface AuthTokenRecord {
  id: UUID;
  tokenHash: string;
  purpose: AuthTokenPurpose;
  userId: UUID;
  sessionId: UUID | null;
  tenantId: UUID | null;
  membershipId: UUID | null;
  predecessorId: UUID | null;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}

export interface IdentityUserRecord {
  id: UUID;
  email: string;
  passwordHash: string | null;
  /** Existing DB status vocabulary is not expanded in Phase 1. */
  status: string;
  platformRole: 'PLATFORM_ADMIN' | null;
}

export interface MembershipAuthority {
  userId: UUID;
  tenantId: UUID;
  membershipId: UUID;
  membershipStatus: string;
  tenantStatus: string;
  grants: readonly ScopedRoleGrant[];
}

/** All methods operate in one database transaction, supplied by the future adapter. */
export interface IdentityUnitOfWork {
  findUserByEmail(normalizedEmail: string): Promise<IdentityUserRecord | null>;
  lockUser(userId: UUID): Promise<IdentityUserRecord | null>;
  lockSession(sessionId: UUID): Promise<SessionRecord | null>;
  findTokenByHash(
    tokenHash: string,
    purpose: AuthTokenPurpose,
  ): Promise<AuthTokenRecord | null>;
  createSession(session: SessionRecord): Promise<void>;
  createToken(token: AuthTokenRecord): Promise<void>;
  /** Atomic conditional update: unconsumed, unrevoked, unexpired, expected purpose. */
  consumeToken(
    tokenId: UUID,
    purpose: AuthTokenPurpose,
    now: Date,
  ): Promise<boolean>;
  revokeSessionFamily(
    sessionId: UUID,
    now: Date,
    reason: string,
  ): Promise<void>;
  revokeUserSessions(userId: UUID, now: Date, reason: string): Promise<void>;
  revokeUserTokens(
    userId: UUID,
    purpose: AuthTokenPurpose,
    now: Date,
  ): Promise<void>;
  updatePasswordHash(userId: UUID, passwordHash: string): Promise<void>;
}

export interface IdentityRepository {
  transaction<T>(
    operation: (unit: IdentityUnitOfWork) => Promise<T>,
  ): Promise<T>;
  /** Must use withTenant(), filter by user, and return only this membership's grants. */
  resolveMembership(
    userId: UUID,
    tenantId: UUID,
    membershipId: UUID,
  ): Promise<MembershipAuthority | null>;
}

/**
 * Mandatory production integration port. Verify the access token, then recheck
 * session expiry/revocation, user status, platformRole OR active tenant/membership,
 * matching session binding, and current grants. Never return JWT roles as authority.
 * Tenant-owned reads use withTenant(); no adapter is supplied in Phase 1.
 */
export abstract class AuthenticatedContextResolver {
  abstract resolveAccessToken(
    rawAccessToken: string,
  ): Promise<AuthenticatedContext | null>;
}

/** Persistence-side resolver may use verified hints only as lookup keys. */
export interface CurrentAuthorityRepository {
  resolveCurrentAuthority(
    identity: AccessTokenIdentity,
    now: Date,
  ): Promise<AuthenticatedContext | null>;
}
