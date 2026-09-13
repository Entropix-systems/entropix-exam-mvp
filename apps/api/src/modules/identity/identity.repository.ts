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

export interface AuthenticatedPrincipal {
  readonly identity: AccessTokenIdentity;
  readonly context: AuthenticatedContext;
}

export interface LoginSessionCommand {
  userId: UUID;
  institutionSlug: string | null;
  sessionId: UUID;
  refreshTokenId: UUID;
  refreshTokenHash: string;
  now: Date;
  expiresAt: Date;
  readonly requireActiveUser: true;
  readonly requireActiveTenantMembership: true;
}

export type LoginSessionResult =
  { kind: 'CREATED'; identity: AccessTokenIdentity } | { kind: 'DENIED' };

export interface RotateRefreshCommand {
  currentTokenHash: string;
  successorTokenId: UUID;
  successorTokenHash: string;
  now: Date;
  expiresAt: Date;
  readonly revokeSessionFamilyOnReplay: true;
}

/** REPLAY means the adapter committed family revocation before returning. */
export type RotateRefreshResult =
  | { kind: 'ROTATED'; identity: AccessTokenIdentity }
  | { kind: 'REPLAY' | 'INVALID' | 'SESSION_REVOKED' };

export interface CreatePasswordResetCommand {
  userId: UUID;
  tokenId: UUID;
  tokenHash: string;
  now: Date;
  expiresAt: Date;
}

export interface ResetPasswordCommand {
  tokenHash: string;
  passwordHash: string;
  now: Date;
  readonly consumeOnce: true;
  readonly requireActiveUser: true;
  readonly revokeAllSessions: true;
  readonly revokeRemainingResetTokens: true;
}

export type ResetPasswordResult =
  { kind: 'RESET'; userId: UUID } | { kind: 'INVALID' | 'USER_INACTIVE' };

export interface AcceptInvitationCommand {
  tokenHash: string;
  passwordHash: string | null;
  now: Date;
  readonly consumeOnce: true;
  readonly protectExistingPassword: true;
  readonly activateMembershipAfterValidation: true;
}

export type AcceptInvitationResult =
  | { kind: 'ACCEPTED' }
  | {
      kind:
        | 'INVALID'
        | 'USER_INACTIVE'
        | 'PASSWORD_NOT_ALLOWED'
        | 'AUTHENTICATION_REQUIRED';
    };

/**
 * Phase 2 workflow port. The Phase 3 adapter must implement each mutating method
 * transactionally against real persistence; there is deliberately no production
 * in-memory implementation.
 */
export abstract class IdentityWorkflowRepository {
  abstract findUserByEmail(
    normalizedEmail: string,
  ): Promise<IdentityUserRecord | null>;
  abstract createLoginSession(
    command: LoginSessionCommand,
  ): Promise<LoginSessionResult>;
  abstract rotateRefresh(
    command: RotateRefreshCommand,
  ): Promise<RotateRefreshResult>;
  abstract logoutSession(
    userId: UUID,
    sessionId: UUID,
    now: Date,
  ): Promise<void>;
  abstract revokeUserSessions(userId: UUID, now: Date): Promise<void>;
  abstract createPasswordReset(
    command: CreatePasswordResetCommand,
  ): Promise<void>;
  /** Atomically consumes one token, updates the hash, revokes all sessions and remaining reset tokens. */
  abstract resetPassword(
    command: ResetPasswordCommand,
  ): Promise<ResetPasswordResult>;
  /** Atomically validates token/bindings, protects existing passwords and activates membership after acceptance. */
  abstract acceptInvitation(
    command: AcceptInvitationCommand,
  ): Promise<AcceptInvitationResult>;
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
  ): Promise<AuthenticatedPrincipal | null>;
}

/** Persistence-side resolver may use verified hints only as lookup keys. */
export abstract class CurrentAuthorityRepository {
  abstract resolveCurrentAuthority(
    identity: AccessTokenIdentity,
    now: Date,
  ): Promise<AuthenticatedContext | null>;
}

export interface MembershipListItem {
  id: UUID;
  userId: UUID;
  email: string;
  name: string | null;
  status: string;
  version: number;
  grants: readonly ScopedRoleGrant[];
}

export interface CreateInvitationCommand {
  tenantId: UUID;
  actorMembershipId: UUID;
  email: string;
  grants: readonly ScopedRoleGrant[];
  invitationTokenId: UUID;
  invitationTokenHash: string;
  now: Date;
  expiresAt: Date;
}

export type CreateInvitationResult =
  { kind: 'CREATED'; membership: MembershipListItem } | { kind: 'INELIGIBLE' };

export interface ReplaceMembershipRoleGrantsCommand {
  tenantId: UUID;
  actorUserId: UUID;
  actorMembershipId: UUID;
  membershipId: UUID;
  grants: readonly ScopedRoleGrant[];
  expectedVersion: number | null;
}

export type MembershipMutationResult =
  | { kind: 'UPDATED'; membership: MembershipListItem }
  | { kind: 'NOT_FOUND' | 'INELIGIBLE' | 'VERSION_CONFLICT' | 'FORBIDDEN' };

/** Tenant administration port. Implementations keep every tenant mutation inside withTenant(). */
export abstract class IdentityAdminRepository {
  abstract listMemberships(
    tenantId: UUID,
  ): Promise<readonly MembershipListItem[]>;
  abstract createInvitation(
    command: CreateInvitationCommand,
  ): Promise<CreateInvitationResult>;
  abstract replaceRoleGrants(
    command: ReplaceMembershipRoleGrantsCommand,
  ): Promise<MembershipMutationResult>;
  abstract setMembershipActive(
    tenantId: UUID,
    actorMembershipId: UUID,
    membershipId: UUID,
    active: boolean,
    now: Date,
  ): Promise<MembershipMutationResult>;
}
