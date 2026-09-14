import { describe, expect, it } from 'vitest';
import type {
  AccessTokenIdentity,
  AuthenticatedContext,
} from '@entropix/contracts';
import {
  IdentityWorkflowRepository,
  type AcceptInvitationCommand,
  type AcceptInvitationResult,
  type AuthenticatedPrincipal,
  type CreatePasswordResetCommand,
  type IdentityUserRecord,
  type LoginSessionCommand,
  type LoginSessionResult,
  type ResetPasswordCommand,
  type ResetPasswordResult,
  type RotateRefreshCommand,
  type RotateRefreshResult,
  type SwitchSessionContextCommand,
  type SwitchSessionContextResult,
} from '../identity.repository.js';
import { AccessTokenCodec } from '../security/access-token.js';
import { PasswordHasher } from '../security/password-hasher.js';
import { AuthApplicationService } from './auth.service.js';
import {
  IdentityNotificationSender,
  type IdentityNotificationMessage,
} from './identity-notifications.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-09-13T12:00:00Z');
const validOpaqueToken = Buffer.alloc(32, 1).toString('base64url');
const identity: AccessTokenIdentity = {
  kind: 'TENANT',
  userId,
  sessionId,
  tenantId,
  membershipId,
};
const context: AuthenticatedContext = {
  kind: 'TENANT',
  userId,
  tenantId,
  membershipId,
  activeRole: 'STUDENT',
  grants: [{ role: 'STUDENT', departmentId: null }],
};
const principal: AuthenticatedPrincipal = { identity, context };

class TestRepository extends IdentityWorkflowRepository {
  user: IdentityUserRecord | null = {
    id: userId,
    email: 'student@example.test',
    passwordHash: '$argon2id$valid',
    status: 'ACTIVE',
    platformRole: null,
  };
  loginResult: LoginSessionResult = { kind: 'CREATED', identity };
  rotateResult: RotateRefreshResult = { kind: 'ROTATED', identity };
  switchResult: SwitchSessionContextResult = { kind: 'SWITCHED', identity };
  resetResult: ResetPasswordResult = { kind: 'RESET', userId };
  invitationResult: AcceptInvitationResult = { kind: 'ACCEPTED' };
  loginCommands: LoginSessionCommand[] = [];
  rotationCommands: RotateRefreshCommand[] = [];
  switchCommands: SwitchSessionContextCommand[] = [];
  resetTokenCommands: CreatePasswordResetCommand[] = [];
  resetCommands: ResetPasswordCommand[] = [];
  invitationCommands: AcceptInvitationCommand[] = [];
  logoutCommands: { userId: string; sessionId: string; now: Date }[] = [];
  revokeAllCommands: { userId: string; now: Date }[] = [];
  lookedUpEmails: string[] = [];
  failLookup = false;
  failLogin = false;
  failResetTokenWrite = false;

  async findUserByEmail(email: string) {
    if (this.failLookup) throw new Error('private repository failure');
    this.lookedUpEmails.push(email);
    return this.user;
  }
  async createLoginSession(command: LoginSessionCommand) {
    if (this.failLogin) throw new Error('private repository failure');
    this.loginCommands.push(command);
    return this.loginResult;
  }
  async switchSessionContext(command: SwitchSessionContextCommand) {
    this.switchCommands.push(command);
    return this.switchResult;
  }
  async currentUserAccess() {
    return {
      name: 'Northstar Student',
      email: 'student@example.test',
      institutions: [{ id: tenantId, name: 'Northstar College', slug: 'northstar-college' }],
    };
  }
  async rotateRefresh(command: RotateRefreshCommand) {
    this.rotationCommands.push(command);
    return this.rotateResult;
  }
  async logoutSession(userIdValue: string, sessionIdValue: string, at: Date) {
    this.logoutCommands.push({
      userId: userIdValue,
      sessionId: sessionIdValue,
      now: at,
    });
  }
  async revokeUserSessions(userIdValue: string, at: Date) {
    this.revokeAllCommands.push({ userId: userIdValue, now: at });
  }
  async createPasswordReset(command: CreatePasswordResetCommand) {
    if (this.failResetTokenWrite) throw new Error('private repository failure');
    this.resetTokenCommands.push(command);
  }
  async resetPassword(command: ResetPasswordCommand) {
    this.resetCommands.push(command);
    return this.resetResult;
  }
  async acceptInvitation(command: AcceptInvitationCommand) {
    this.invitationCommands.push(command);
    return this.invitationResult;
  }
}

class TestPasswordHasher extends PasswordHasher {
  verified: { password: string; hash: string }[] = [];
  async hash(password: string) {
    return `$argon2id$hashed:${password}`;
  }
  async verify(password: string, hash: string) {
    this.verified.push({ password, hash });
    return password === 'correct password' && hash === '$argon2id$valid';
  }
}

class TestAccessTokens extends AccessTokenCodec {
  signed: AccessTokenIdentity[] = [];
  async sign(value: AccessTokenIdentity) {
    this.signed.push(value);
    return `access:${value.sessionId}`;
  }
  async verify(): Promise<AccessTokenIdentity> {
    throw new Error('not used by application service tests');
  }
}

class TestNotifications extends IdentityNotificationSender {
  messages: IdentityNotificationMessage[] = [];
  fail = false;
  async send(message: IdentityNotificationMessage) {
    this.messages.push(message);
    if (this.fail) throw new Error('provider failed');
  }
}

function setup() {
  const repository = new TestRepository();
  const passwords = new TestPasswordHasher();
  const accessTokens = new TestAccessTokens();
  const notifications = new TestNotifications();
  const service = new AuthApplicationService(
    repository,
    passwords,
    accessTokens,
    notifications,
    {
      passwordResetUrl: 'https://app.example.test/reset-password',
      dummyPasswordHash:
        '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$aGFzaGhhc2g',
    },
    () => now,
  );
  return { repository, passwords, accessTokens, notifications, service };
}

describe('login orchestration', () => {
  it('normalizes identifiers, requests active tenant session state, and exposes only issued transport values', async () => {
    const { service, repository, accessTokens } = setup();
    const result = await service.login({
      email: '  STUDENT@Example.Test ',
      password: 'correct password',
    });
    expect(repository.lookedUpEmails).toEqual(['student@example.test']);
    expect(repository.loginCommands).toHaveLength(1);
    expect(repository.loginCommands[0]).toMatchObject({
      userId,
      requireActiveUser: true,
      requireActiveTenantMembership: true,
      now,
    });
    expect(repository.loginCommands[0].refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.loginCommands[0].expiresAt.toISOString()).toBe(
      '2026-09-20T12:00:00.000Z',
    );
    expect(result.accessToken).toBe(`access:${sessionId}`);
    expect(result.expiresInSeconds).toBe(900);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.loginCommands[0].refreshTokenHash).not.toBe(
      result.refreshToken,
    );
    expect(accessTokens.signed).toEqual([identity]);
  });

  it.each([
    ['wrong password', 'ACTIVE', true],
    ['correct password', 'ACTIVE', false],
    ['correct password', 'INACTIVE', true],
  ])(
    'returns the same public error for invalid account conditions',
    async (password, status, exists) => {
      const { service, repository, passwords } = setup();
      repository.user = exists ? { ...repository.user!, status } : null;
      await expect(
        service.login({
          email: 'student@example.test',
          password,
        }),
      ).rejects.toMatchObject({
        kind: 'UNAUTHENTICATED',
        message: 'Invalid credentials',
      });
      expect(passwords.verified).toHaveLength(1);
      expect(repository.loginCommands).toHaveLength(0);
    },
  );

  it('returns an authenticated no-access state when no usable membership exists', async () => {
    const { service, repository } = setup();
    repository.loginResult = { kind: 'NO_ACCESS' };
    await expect(
      service.login({
        email: 'student@example.test',
        password: 'correct password',
      }),
    ).rejects.toMatchObject({
      kind: 'FORBIDDEN',
      message: 'No active institution access is available for this account',
    });
  });

  it.each(['lookup', 'session'] as const)(
    'keeps %s repository failures generic',
    async (failure) => {
      const { service, repository } = setup();
      if (failure === 'lookup') repository.failLookup = true;
      else repository.failLogin = true;
      await expect(
        service.login({
          email: 'student@example.test',
          password: 'correct password',
        }),
      ).rejects.toMatchObject({
        kind: 'UNAUTHENTICATED',
        message: 'Invalid credentials',
      });
    },
  );
});

describe('refresh and revocation orchestration', () => {
  it('requests atomic rotation and family revocation on replay', async () => {
    const { service, repository } = setup();
    const login = await service.login({
      email: 'student@example.test',
      password: 'correct password',
    });
    const result = await service.refresh(login.refreshToken);
    expect(repository.rotationCommands[0]).toMatchObject({
      revokeSessionFamilyOnReplay: true,
      now,
    });
    expect(repository.rotationCommands[0].currentTokenHash).toBe(
      repository.loginCommands[0].refreshTokenHash,
    );
    expect(result.refreshToken).not.toBe(login.refreshToken);
  });

  it.each(['REPLAY', 'INVALID', 'SESSION_REVOKED'] as const)(
    'returns a generic invalid-session error for %s',
    async (kind) => {
      const { service, repository } = setup();
      repository.rotateResult = { kind };
      const raw = 'A'.repeat(43);
      await expect(service.refresh(raw)).rejects.toMatchObject({
        kind: 'UNAUTHENTICATED',
        message: 'Session is not valid',
      });
    },
  );

  it('requests current-session logout and all-own-session revocation', async () => {
    const { service, repository } = setup();
    await service.logout(principal);
    await service.revokeAllOwnSessions(context);
    expect(repository.logoutCommands).toEqual([{ userId, sessionId, now }]);
    expect(repository.revokeAllCommands).toEqual([{ userId, now }]);
  });
});

describe('password recovery orchestration', () => {
  it('returns one response for known, unknown, inactive and email-failure cases', async () => {
    for (const mode of [
      'known',
      'unknown',
      'inactive',
      'email-failure',
      'lookup-failure',
      'token-write-failure',
    ]) {
      const { service, repository, notifications } = setup();
      if (mode === 'unknown') repository.user = null;
      if (mode === 'inactive') repository.user = { ...repository.user!, status: 'SUSPENDED' };
      if (mode === 'email-failure') notifications.fail = true;
      if (mode === 'lookup-failure') repository.failLookup = true;
      if (mode === 'token-write-failure') repository.failResetTokenWrite = true;
      await expect(
        service.forgotPassword({ email: 'student@example.test' }),
      ).resolves.toEqual({ accepted: true });
    }
  });

  it('persists only a token hash before delivering the one-time link', async () => {
    const { service, repository, notifications } = setup();
    await service.forgotPassword({ email: 'student@example.test' });
    expect(repository.resetTokenCommands).toHaveLength(1);
    expect(repository.resetTokenCommands[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(notifications.messages).toHaveLength(1);
    const link = new URL(notifications.messages[0].text.split(' ').at(-1)!);
    const raw = link.searchParams.get('token')!;
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(notifications.messages[0].text).not.toContain(
      repository.resetTokenCommands[0].tokenHash,
    );
  });

  it('requests one-time reset, active-user check, session revocation and remaining-token invalidation', async () => {
    const { service, repository } = setup();
    await expect(
      service.resetPassword({ token: validOpaqueToken, password: 'new secure password' }),
    ).resolves.toEqual({ reset: true });
    expect(repository.resetCommands[0]).toMatchObject({
      passwordHash: '$argon2id$hashed:new secure password',
      consumeOnce: true,
      requireActiveUser: true,
      revokeAllSessions: true,
      revokeRemainingResetTokens: true,
    });
  });

  it.each(['INVALID', 'USER_INACTIVE'] as const)(
    'does not report reset success for %s and cannot reactivate suspended users',
    async (kind) => {
      const { service, repository } = setup();
      repository.resetResult = { kind };
      await expect(
        service.resetPassword({ token: validOpaqueToken, password: 'new secure password' }),
      ).rejects.toMatchObject({
        kind: 'UNAUTHENTICATED',
        message: 'Recovery link is not valid',
      });
    },
  );
});

describe('invitation acceptance orchestration', () => {
  it('requests single-use validation, server binding, password protection and post-validation activation', async () => {
    const { service, repository } = setup();
    await expect(
      service.acceptInvitation({
        token: validOpaqueToken,
        password: 'first secure password',
      }),
    ).resolves.toEqual({ accepted: true });
    expect(repository.invitationCommands[0]).toMatchObject({
      passwordHash: '$argon2id$hashed:first secure password',
      consumeOnce: true,
      protectExistingPassword: true,
      activateMembershipAfterValidation: true,
    });
    expect(repository.invitationCommands[0]).not.toHaveProperty('tenantId');
    expect(repository.invitationCommands[0]).not.toHaveProperty('membershipId');
  });

  it.each(['INVALID', 'USER_INACTIVE', 'AUTHENTICATION_REQUIRED'] as const)(
    'denies invalid/expired/consumed/ineligible invitation result %s',
    async (kind) => {
      const { service, repository } = setup();
      repository.invitationResult = { kind };
      await expect(
        service.acceptInvitation({ token: validOpaqueToken }),
      ).rejects.toMatchObject({
        kind: 'UNAUTHENTICATED',
        message: 'Invitation link is not valid',
      });
    },
  );

  it('protects an existing user password', async () => {
    const { service, repository } = setup();
    repository.invitationResult = { kind: 'PASSWORD_NOT_ALLOWED' };
    await expect(
      service.acceptInvitation({
        token: validOpaqueToken,
        password: 'replacement password',
      }),
    ).rejects.toMatchObject({ kind: 'VALIDATION', field: 'password' });
  });
});

describe('current context', () => {
  it('returns server-resolved context, identity label, and institution choices', async () => {
    await expect(setup().service.me(principal)).resolves.toEqual({
      context,
      sessionId,
      name: 'Northstar Student',
      email: 'student@example.test',
      institutions: [{ id: tenantId, name: 'Northstar College', slug: 'northstar-college' }],
    });
  });

  it('accepts only a server-verified institution and granted role switch', async () => {
    const { service, repository, accessTokens } = setup();
    await expect(service.switchContext(principal, {
      institutionId: tenantId,
      role: 'STUDENT',
    })).resolves.toEqual({
      accessToken: `access:${sessionId}`,
      expiresInSeconds: 900,
    });
    expect(repository.switchCommands).toEqual([{
      userId,
      sessionId,
      institutionId: tenantId,
      role: 'STUDENT',
      now,
    }]);
    expect(accessTokens.signed.at(-1)).toEqual(identity);

    repository.switchResult = { kind: 'FORBIDDEN' };
    await expect(service.switchContext(principal, {
      institutionId: '33333333-3333-4333-8333-333333333333',
      role: 'INSTITUTION_ADMIN',
    })).rejects.toMatchObject({ kind: 'FORBIDDEN' });
  });
});
