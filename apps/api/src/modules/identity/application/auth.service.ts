import { randomUUID } from 'node:crypto';
import type {
  AcceptInvitationRequest,
  AccessTokenIdentity,
  AccessTokenResponse,
  AuthenticatedContext,
  CurrentUserResponse,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  SwitchAuthContextRequest,
  TenantRole,
} from '@entropix/contracts';
import { ROLES } from '@entropix/contracts';
import { isUuid } from '@entropix/domain';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AuthenticatedPrincipal,
  IdentityWorkflowRepository,
} from '../identity.repository.js';
import { AccessTokenCodec } from '../security/access-token.js';
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from '../security/opaque-token.js';
import { PasswordHasher } from '../security/password-hasher.js';
import type { TokenPolicy } from '../security/token-policy.js';
import { DEFAULT_TOKEN_POLICY } from '../security/token-policy.js';
import {
  AuthApplicationError,
  invalidCredentials,
  invalidInvitation,
  invalidRecoveryToken,
  invalidSession,
  noInstitutionAccess,
} from './auth.errors.js';
import { IdentityNotificationSender } from './identity-notifications.js';

export interface IssuedSession extends AccessTokenResponse {
  /** Controller-only transport secret. Never return in an API body or log. */
  refreshToken: string;
}

export interface ForgotPasswordResult {
  accepted: true;
}

export interface ResetPasswordResult {
  reset: true;
}

export interface InvitationAcceptanceResult {
  accepted: true;
}

export interface AuthServiceConfiguration {
  tokenPolicy?: Readonly<TokenPolicy>;
  passwordResetUrl: string;
  /** A complete encoded Argon2id hash used to equalize unknown-user verification. */
  dummyPasswordHash: string;
}

export const AUTH_SERVICE_CONFIGURATION = Symbol(
  'identity.auth-service-configuration',
);
export const AUTH_CLOCK = Symbol('identity.auth-clock');

function normalizeEmail(value: string): string | null {
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    normalized.length <= 320
    ? normalized
    : null;
}

const tenantRoles = new Set<TenantRole>(
  Object.values(ROLES).filter(
    (role): role is TenantRole => role !== ROLES.PLATFORM_ADMIN,
  ),
);

function validatePassword(value: string): void {
  if (typeof value !== 'string' || value.length < 12 || value.length > 1024)
    throw new AuthApplicationError(
      'VALIDATION',
      'Password must be between 12 and 1024 characters',
      'password',
    );
}

function expiresAt(now: Date, seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000);
}

@Injectable()
export class AuthApplicationService {
  private readonly policy: Readonly<TokenPolicy>;
  private readonly passwordResetUrl: URL;

  constructor(
    private readonly repository: IdentityWorkflowRepository,
    private readonly passwords: PasswordHasher,
    private readonly accessTokens: AccessTokenCodec,
    private readonly notifications: IdentityNotificationSender,
    @Inject(AUTH_SERVICE_CONFIGURATION)
    private readonly configuration: AuthServiceConfiguration,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date,
  ) {
    this.policy = configuration.tokenPolicy ?? DEFAULT_TOKEN_POLICY;
    if (
      !/^\$argon2id\$v=\d+\$m=\d+,(?:t=\d+,p=\d+|p=\d+,t=\d+)\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/.test(
        configuration.dummyPasswordHash,
      )
    )
      throw new Error('Invalid authentication service configuration');
    try {
      this.passwordResetUrl = new URL(configuration.passwordResetUrl);
    } catch {
      throw new Error('Invalid authentication service configuration');
    }
  }

  async login(input: LoginRequest): Promise<IssuedSession> {
    const normalizedEmail =
      typeof input.email === 'string' ? normalizeEmail(input.email) : null;
    let user = null;
    try {
      user = normalizedEmail
        ? await this.repository.findUserByEmail(normalizedEmail)
        : null;
    } catch {
      // Keep the public result and password-verification work account-agnostic.
    }
    const candidateHash =
      user?.passwordHash ?? this.configuration.dummyPasswordHash;
    const verified = await this.passwords.verify(
      typeof input.password === 'string' ? input.password : '',
      candidateHash,
    );
    if (
      !normalizedEmail ||
      !user ||
      !user.passwordHash ||
      !verified ||
      user.status !== 'ACTIVE'
    )
      throw invalidCredentials();

    const now = this.clock();
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const refreshToken = generateOpaqueToken();
    let session;
    try {
      session = await this.repository.createLoginSession({
        userId: user.id,
        sessionId,
        refreshTokenId,
        refreshTokenHash: hashOpaqueToken(refreshToken),
        now,
        expiresAt: expiresAt(now, this.policy.refreshTtlSeconds),
        requireActiveUser: true,
        requireActiveTenantMembership: true,
      });
    } catch {
      throw invalidCredentials();
    }
    if (session.kind === 'NO_ACCESS') throw noInstitutionAccess();
    if (session.kind !== 'CREATED') throw invalidCredentials();
    return this.issue(session.identity, refreshToken);
  }

  async switchContext(
    principal: AuthenticatedPrincipal,
    input: SwitchAuthContextRequest & { requestId?: string },
  ): Promise<AccessTokenResponse> {
    const institutionId =
      typeof input.institutionId === 'string' && isUuid(input.institutionId)
        ? input.institutionId.toLowerCase()
        : null;
    const role =
      input.role === undefined
        ? null
        : typeof input.role === 'string' && tenantRoles.has(input.role)
          ? input.role
          : undefined;
    const returnToPlatform = input.returnToPlatform === true;
    if ((!institutionId && !returnToPlatform) || (returnToPlatform && (institutionId || input.role !== undefined)) || role === undefined)
      throw new AuthApplicationError(
        'VALIDATION',
        'Institution or role selection is invalid',
      );
    const result = await this.repository.switchSessionContext({
      userId: principal.context.userId,
      sessionId: principal.identity.sessionId,
      institutionId,
      role,
      returnToPlatform,
      requestId: input.requestId ?? randomUUID(),
      now: this.clock(),
    });
    if (result.kind === 'SESSION_INVALID') throw invalidSession();
    if (result.kind !== 'SWITCHED')
      throw new AuthApplicationError(
        'FORBIDDEN',
        'Institution or role selection is not available',
      );
    return this.issueAccess(result.identity);
  }

  async refresh(rawRefreshToken: string): Promise<IssuedSession> {
    let currentTokenHash: string;
    try {
      currentTokenHash = hashOpaqueToken(rawRefreshToken);
    } catch {
      throw invalidSession();
    }
    const now = this.clock();
    const successorToken = generateOpaqueToken();
    let rotation;
    try {
      rotation = await this.repository.rotateRefresh({
        currentTokenHash,
        successorTokenId: randomUUID(),
        successorTokenHash: hashOpaqueToken(successorToken),
        now,
        expiresAt: expiresAt(now, this.policy.refreshTtlSeconds),
        revokeSessionFamilyOnReplay: true,
      });
    } catch {
      throw invalidSession();
    }
    if (rotation.kind !== 'ROTATED') throw invalidSession();
    return this.issue(rotation.identity, successorToken);
  }

  async logout(principal: AuthenticatedPrincipal): Promise<void> {
    await this.repository.logoutSession(
      principal.context.userId,
      principal.identity.sessionId,
      this.clock(),
    );
  }

  async revokeAllOwnSessions(context: AuthenticatedContext): Promise<void> {
    await this.repository.revokeUserSessions(context.userId, this.clock());
  }

  async forgotPassword(
    input: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResult> {
    const normalizedEmail =
      typeof input.email === 'string' ? normalizeEmail(input.email) : null;
    try {
      const user = normalizedEmail
        ? await this.repository.findUserByEmail(normalizedEmail)
        : null;
      if (user?.status === 'ACTIVE') {
        const now = this.clock();
        const rawToken = generateOpaqueToken();
        await this.repository.createPasswordReset({
          userId: user.id,
          tokenId: randomUUID(),
          tokenHash: hashOpaqueToken(rawToken),
          now,
          expiresAt: expiresAt(now, this.policy.passwordResetTtlSeconds),
        });
        const link = new URL(this.passwordResetUrl);
        link.searchParams.set('token', rawToken);
        await this.notifications.send({
          to: user.email,
          subject: 'Reset your Examination ERP password',
          text: `Use this one-time link to reset your password: ${link.toString()}`,
          category: 'PASSWORD_RESET',
        });
      }
    } catch {
      // Lookup, persistence and delivery failures share the same public response.
    }
    return { accepted: true };
  }

  async resetPassword(
    input: ResetPasswordRequest,
  ): Promise<ResetPasswordResult> {
    validatePassword(input.password);
    let tokenHash: string;
    try {
      tokenHash = hashOpaqueToken(input.token);
    } catch {
      throw invalidRecoveryToken();
    }
    const passwordHash = await this.passwords.hash(input.password);
    let result;
    try {
      result = await this.repository.resetPassword({
        tokenHash,
        passwordHash,
        now: this.clock(),
        consumeOnce: true,
        requireActiveUser: true,
        revokeAllSessions: true,
        revokeRemainingResetTokens: true,
      });
    } catch {
      throw invalidRecoveryToken();
    }
    if (result.kind !== 'RESET') throw invalidRecoveryToken();
    return { reset: true };
  }

  async acceptInvitation(
    input: AcceptInvitationRequest,
  ): Promise<InvitationAcceptanceResult> {
    let tokenHash: string;
    try {
      tokenHash = hashOpaqueToken(input.token);
    } catch {
      throw invalidInvitation();
    }
    let passwordHash: string | null = null;
    if (input.password !== undefined) {
      validatePassword(input.password);
      passwordHash = await this.passwords.hash(input.password);
    }
    let result;
    try {
      result = await this.repository.acceptInvitation({
        tokenHash,
        passwordHash,
        now: this.clock(),
        consumeOnce: true,
        protectExistingPassword: true,
        activateMembershipAfterValidation: true,
      });
    } catch {
      throw invalidInvitation();
    }
    if (result.kind === 'PASSWORD_NOT_ALLOWED')
      throw new AuthApplicationError(
        'VALIDATION',
        'Sign in with the existing account to accept this invitation',
        'password',
      );
    if (result.kind !== 'ACCEPTED') throw invalidInvitation();
    return { accepted: true };
  }

  async me(principal: AuthenticatedPrincipal): Promise<CurrentUserResponse> {
    const access = await this.repository.currentUserAccess(
      principal.context.userId,
    );
    if (!access) throw invalidSession();
    return {
      context: principal.context,
      sessionId: principal.identity.sessionId,
      name: access.name,
      email: access.email,
      institutions: access.institutions,
    };
  }

  private async issueAccess(
    identity: AccessTokenIdentity,
  ): Promise<AccessTokenResponse> {
    const accessToken = await this.accessTokens.sign(identity);
    return {
      accessToken,
      expiresInSeconds: this.policy.accessTtlSeconds,
    };
  }

  private async issue(
    identity: AccessTokenIdentity,
    refreshToken: string,
  ): Promise<IssuedSession> {
    return { ...(await this.issueAccess(identity)), refreshToken };
  }
}
