import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPrismaClient, withTenant } from '@entropix/db';
import dotenv from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthApplicationService } from '../application/auth.service.js';
import {
  IdentityNotificationSender,
  type IdentityNotificationMessage,
} from '../application/identity-notifications.js';
import { AccessTokenCodec } from '../security/access-token.js';
import { hashOpaqueToken } from '../security/opaque-token.js';
import { PasswordHasher } from '../security/password-hasher.js';
import {
  PrismaCurrentAuthorityRepository,
  PrismaIdentityRepository,
} from './prisma-identity.repository.js';

dotenv.config({
  path: fileURLToPath(new URL('../../../../../../.env', import.meta.url)),
});

const tenantA = '31111111-1111-4111-8111-111111111111';
const tenantB = '32222222-2222-4222-8222-222222222222';
const adminUser = '3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const memberUser = '3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const foreignUser = '3ccccccc-cccc-4ccc-8ccc-cccccccccccc';
const departmentId = '3ddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now = new Date();

class TestPasswords extends PasswordHasher {
  async hash(password: string): Promise<string> {
    return `$test$${password}`;
  }
  async verify(password: string, encodedHash: string): Promise<boolean> {
    return encodedHash === `$test$${password}`;
  }
}

class TestAccessTokens extends AccessTokenCodec {
  async sign(identity: { sessionId: string }): Promise<string> {
    return `access:${identity.sessionId}`;
  }
  async verify(): Promise<never> {
    throw new Error('not used');
  }
}

class TestNotifications extends IdentityNotificationSender {
  async send(_message: IdentityNotificationMessage): Promise<void> {}
}

const connectionString = process.env.DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase('PostgreSQL IAM persistence', () => {
  const prisma = createPrismaClient(connectionString!, {
    sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
  });
  const repository = new PrismaIdentityRepository(prisma);
  const authority = new PrismaCurrentAuthorityRepository(prisma);
  let adminMembership = '';
  let memberMembership = '';
  let additionalStaffMembership = '';
  let memberForeignMembership = '';
  let foreignMembership = '';

  async function clean(): Promise<void> {
    await prisma.authToken.deleteMany({
      where: { user: { email: { endsWith: '@iam-phase3.example.test' } } },
    });
    await prisma.session.deleteMany({
      where: { user: { email: { endsWith: '@iam-phase3.example.test' } } },
    });
    for (const tenantId of [tenantA, tenantB]) {
      await withTenant(prisma, tenantId, async (tx) => {
        await tx.roleGrant.deleteMany({ where: { tenantId } });
        await tx.membership.deleteMany({ where: { tenantId } });
      });
    }
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@iam-phase3.example.test' } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
  }

  beforeAll(async () => {
    await clean();
    await prisma.tenant.createMany({
      data: [
        {
          id: tenantA,
          name: 'IAM Phase 3 College',
          slug: 'iam-phase3-college',
          timezone: 'Asia/Kolkata',
        },
        {
          id: tenantB,
          name: 'IAM Phase 3 Foreign College',
          slug: 'iam-phase3-foreign-college',
          timezone: 'Asia/Kolkata',
        },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: adminUser,
          name: 'Platform Admin',
          email: 'admin@iam-phase3.example.test',
          passwordHash: '$test$admin password',
        },
        {
          id: memberUser,
          name: 'IAM Member',
          email: 'member@iam-phase3.example.test',
          passwordHash: '$test$member password',
        },
        {
          id: foreignUser,
          name: 'IAM Foreign',
          email: 'foreign@iam-phase3.example.test',
          passwordHash: '$test$foreign password',
        },
      ],
    });
    adminMembership = (
      await withTenant(prisma, tenantA, (tx) =>
        tx.membership.create({
          data: { tenantId: tenantA, userId: adminUser, status: 'ACTIVE' },
        }),
      )
    ).id;
    memberMembership = (
      await withTenant(prisma, tenantA, (tx) =>
        tx.membership.create({
          data: { tenantId: tenantA, userId: memberUser, status: 'ACTIVE' },
        }),
      )
    ).id;
    additionalStaffMembership = (
      await withTenant(prisma, tenantA, (tx) =>
        tx.membership.create({
          data: { tenantId: tenantA, userId: foreignUser, status: 'ACTIVE' },
        }),
      )
    ).id;
    foreignMembership = (
      await withTenant(prisma, tenantB, (tx) =>
        tx.membership.create({
          data: { tenantId: tenantB, userId: foreignUser, status: 'ACTIVE' },
        }),
      )
    ).id;
    memberForeignMembership = (
      await withTenant(prisma, tenantB, (tx) =>
        tx.membership.create({
          data: { tenantId: tenantB, userId: memberUser, status: 'ACTIVE' },
        }),
      )
    ).id;
    await withTenant(prisma, tenantA, (tx) =>
      tx.roleGrant.createMany({
        data: [
          {
            tenantId: tenantA,
            membershipId: adminMembership,
            role: 'INSTITUTION_ADMIN',
            departmentId: null,
          },
          {
            tenantId: tenantA,
            membershipId: memberMembership,
            role: 'FACULTY',
            departmentId,
          },
          {
            tenantId: tenantA,
            membershipId: memberMembership,
            role: 'AUDITOR',
            departmentId: null,
          },
          {
            tenantId: tenantA,
            membershipId: additionalStaffMembership,
            role: 'INVIGILATOR',
            departmentId: null,
          },
        ],
      }),
    );
    await withTenant(prisma, tenantB, (tx) =>
      tx.roleGrant.createMany({
        data: [
          {
            tenantId: tenantB,
            membershipId: foreignMembership,
            role: 'STUDENT',
            departmentId: null,
          },
          {
            tenantId: tenantB,
            membershipId: memberForeignMembership,
            role: 'INVIGILATOR',
            departmentId: null,
          },
        ],
      }),
    );
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('logs in against persisted identity and preserves scoped grants', async () => {
    const service = new AuthApplicationService(
      repository,
      new TestPasswords(),
      new TestAccessTokens(),
      new TestNotifications(),
      {
        passwordResetUrl: 'https://app.example.test/reset-password',
        dummyPasswordHash:
          '$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$aGFzaGhhc2g',
      },
      () => now,
    );
    const login = await service.login({
      email: ' MEMBER@IAM-PHASE3.EXAMPLE.TEST ',
      password: 'member password',
    });
    expect(login.accessToken).toMatch(/^access:/);
    const sessionId = login.accessToken.slice('access:'.length);
    const context = await authority.resolveCurrentAuthority(
      {
        kind: 'TENANT',
        userId: memberUser,
        sessionId,
        tenantId: tenantA,
        membershipId: memberMembership,
      },
      now,
    );
    expect(context).toMatchObject({
      kind: 'TENANT',
      activeRole: 'FACULTY',
      grants: expect.arrayContaining([
        { role: 'FACULTY', departmentId },
        { role: 'AUDITOR', departmentId: null },
      ]),
    });
  });

  it('rotates refresh atomically and a concurrent replay revokes the family', async () => {
    const sessionId = randomUUID();
    const tokenId = randomUUID();
    const tokenHash = hashOpaqueToken('A'.repeat(43));
    await repository.createLoginSession({
      userId: memberUser,
      sessionId,
      refreshTokenId: tokenId,
      refreshTokenHash: tokenHash,
      now,
      expiresAt: new Date(now.getTime() + 60_000),
      requireActiveUser: true,
      requireActiveTenantMembership: true,
    });
    const results = await Promise.all([
      repository.rotateRefresh({
        currentTokenHash: tokenHash,
        successorTokenId: randomUUID(),
        successorTokenHash: 'a'.repeat(64),
        now: new Date(now.getTime() + 1_000),
        expiresAt: new Date(now.getTime() + 61_000),
        revokeSessionFamilyOnReplay: true,
      }),
      repository.rotateRefresh({
        currentTokenHash: tokenHash,
        successorTokenId: randomUUID(),
        successorTokenHash: 'b'.repeat(64),
        now: new Date(now.getTime() + 1_001),
        expiresAt: new Date(now.getTime() + 61_001),
        revokeSessionFamilyOnReplay: true,
      }),
    ]);
    expect(results.map((result) => result.kind).sort()).toEqual([
      'REPLAY',
      'ROTATED',
    ]);
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(session.revocationReason).toBe('REFRESH_TOKEN_REPLAY');
    expect(
      await prisma.authToken.count({ where: { predecessorId: tokenId } }),
    ).toBe(1);
  });

  it('accepts an invitation exactly once and then permits a tenant session', async () => {
    const hash = 'c'.repeat(64);
    const invited = await repository.createInvitation({
      tenantId: tenantA,
      actorMembershipId: adminMembership,
      name: 'Invited User',
      email: 'invited@iam-phase3.example.test',
      grants: [{ role: 'STUDENT', departmentId: null }],
      invitationTokenId: randomUUID(),
      invitationTokenHash: hash,
      now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    expect(invited.kind).toBe('CREATED');
    await expect(
      repository.acceptInvitation({
        tokenHash: hash,
        passwordHash: '$test$invited password',
        now,
        consumeOnce: true,
        protectExistingPassword: true,
        activateMembershipAfterValidation: true,
      }),
    ).resolves.toEqual({ kind: 'ACCEPTED' });
    await expect(
      repository.acceptInvitation({
        tokenHash: hash,
        passwordHash: '$test$other password',
        now,
        consumeOnce: true,
        protectExistingPassword: true,
        activateMembershipAfterValidation: true,
      }),
    ).resolves.toEqual({ kind: 'INVALID' });
    const invitedUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'invited@iam-phase3.example.test' },
    });
    expect(invitedUser.name).toBe('Invited User');
    const login = await repository.createLoginSession({
      userId: invitedUser.id,
      sessionId: randomUUID(),
      refreshTokenId: randomUUID(),
      refreshTokenHash: 'd'.repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 60_000),
      requireActiveUser: true,
      requireActiveTenantMembership: true,
    });
    expect(login.kind).toBe('CREATED');
  });

  it('consumes reset once, replaces the hash, and revokes existing sessions', async () => {
    const sessionId = randomUUID();
    await repository.createLoginSession({
      userId: adminUser,
      sessionId,
      refreshTokenId: randomUUID(),
      refreshTokenHash: 'e'.repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 60_000),
      requireActiveUser: true,
      requireActiveTenantMembership: true,
    });
    await repository.createPasswordReset({
      userId: adminUser,
      tokenId: randomUUID(),
      tokenHash: 'f'.repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const command = {
      tokenHash: 'f'.repeat(64),
      passwordHash: '$test$new admin password',
      now: new Date(now.getTime() + 1_000),
      consumeOnce: true as const,
      requireActiveUser: true as const,
      revokeAllSessions: true as const,
      revokeRemainingResetTokens: true as const,
    };
    await expect(repository.resetPassword(command)).resolves.toEqual({
      kind: 'RESET',
      userId: adminUser,
    });
    await expect(repository.resetPassword(command)).resolves.toEqual({
      kind: 'INVALID',
    });
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: sessionId } }))
        .revocationReason,
    ).toBe('PASSWORD_RESET');
  });

  it('revokes the persisted session and refresh family on logout', async () => {
    const sessionId = randomUUID();
    await repository.createLoginSession({
      userId: memberUser,
      sessionId,
      refreshTokenId: randomUUID(),
      refreshTokenHash: '9'.repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 60_000),
      requireActiveUser: true,
      requireActiveTenantMembership: true,
    });
    await repository.logoutSession(
      memberUser,
      sessionId,
      new Date(now.getTime() + 1_000),
    );
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: sessionId } }))
        .revocationReason,
    ).toBe('LOGOUT');
    expect(
      await prisma.authToken.count({
        where: { sessionId, revokedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('switches only to institutions and roles granted to the current user', async () => {
    const sessionId = randomUUID();
    await expect(
      repository.createLoginSession({
        userId: memberUser,
        sessionId,
        refreshTokenId: randomUUID(),
        refreshTokenHash: '7'.repeat(64),
        now,
        expiresAt: new Date(now.getTime() + 60_000),
        requireActiveUser: true,
        requireActiveTenantMembership: true,
      }),
    ).resolves.toMatchObject({
      kind: 'CREATED',
      identity: { tenantId: tenantA, membershipId: memberMembership },
    });
    await expect(repository.currentUserAccess(memberUser)).resolves.toMatchObject({
      name: 'IAM Member',
      email: 'member@iam-phase3.example.test',
      institutions: [
        { id: tenantA, name: 'IAM Phase 3 College' },
        { id: tenantB, name: 'IAM Phase 3 Foreign College' },
      ],
    });

    await expect(
      repository.switchSessionContext({
        userId: memberUser,
        sessionId,
        institutionId: tenantA,
        role: 'AUDITOR',
        now: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toMatchObject({
      kind: 'SWITCHED',
      identity: { tenantId: tenantA, membershipId: memberMembership },
    });
    expect(
      await authority.resolveCurrentAuthority(
        {
          kind: 'TENANT',
          userId: memberUser,
          sessionId,
          tenantId: tenantA,
          membershipId: memberMembership,
        },
        new Date(now.getTime() + 2_000),
      ),
    ).toMatchObject({ activeRole: 'AUDITOR' });

    await expect(
      repository.switchSessionContext({
        userId: memberUser,
        sessionId,
        institutionId: tenantB,
        role: 'INVIGILATOR',
        now: new Date(now.getTime() + 3_000),
      }),
    ).resolves.toMatchObject({
      kind: 'SWITCHED',
      identity: { tenantId: tenantB, membershipId: memberForeignMembership },
    });
    await expect(
      repository.switchSessionContext({
        userId: memberUser,
        sessionId,
        institutionId: tenantB,
        role: 'INSTITUTION_ADMIN',
        now: new Date(now.getTime() + 4_000),
      }),
    ).resolves.toEqual({ kind: 'FORBIDDEN' });
    await expect(
      repository.switchSessionContext({
        userId: memberUser,
        sessionId,
        institutionId: randomUUID(),
        role: null,
        now: new Date(now.getTime() + 5_000),
      }),
    ).resolves.toEqual({ kind: 'FORBIDDEN' });
  });

  it('paginates staff, rejects foreign cursors, and excludes student identities', async () => {
    const first = await repository.listMemberships(tenantA, 1, null);
    expect(first).not.toBeNull();
    expect(first!.institutionName).toBe('IAM Phase 3 College');
    expect(first!.memberships.items).toHaveLength(1);
    expect(first!.memberships.nextCursor).not.toBeNull();

    const middle = await repository.listMemberships(
      tenantA,
      1,
      first!.memberships.nextCursor,
    );
    expect(middle!.memberships.items).toHaveLength(1);
    expect(middle!.memberships.nextCursor).not.toBeNull();
    const final = await repository.listMemberships(
      tenantA,
      1,
      middle!.memberships.nextCursor,
    );
    expect(final!.memberships.items).toHaveLength(1);
    expect(final!.memberships.nextCursor).toBeNull();
    expect(
      new Set([
        ...first!.memberships.items.map(({ id }) => id),
        ...middle!.memberships.items.map(({ id }) => id),
        ...final!.memberships.items.map(({ id }) => id),
      ]),
    ).toEqual(
      new Set([adminMembership, memberMembership, additionalStaffMembership]),
    );
    await expect(
      repository.listMemberships(tenantA, 25, foreignMembership),
    ).resolves.toBeNull();

    const tenantBDirectory = await repository.listMemberships(tenantB, 25, null);
    expect(tenantBDirectory!.memberships.items.map(({ id }) => id)).toEqual([
      memberForeignMembership,
    ]);
    expect(tenantBDirectory!.memberships.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: foreignMembership })]),
    );
  });

  it('replaces canonical role grants with department scope and hides foreign targets', async () => {
    const current = (await repository.listMemberships(tenantA, 25, null))!
      .memberships.items.find(
      (membership) => membership.id === memberMembership,
    )!;
    const updated = await repository.replaceRoleGrants({
      tenantId: tenantA,
      actorUserId: adminUser,
      actorMembershipId: adminMembership,
      membershipId: memberMembership,
      grants: [{ role: 'DEPARTMENT_ADMIN', departmentId }],
      expectedVersion: current.version,
    });
    expect(updated).toMatchObject({
      kind: 'UPDATED',
      membership: {
        grants: [{ role: 'DEPARTMENT_ADMIN', departmentId }],
      },
    });
    await expect(
      repository.replaceRoleGrants({
        tenantId: tenantA,
        actorUserId: adminUser,
        actorMembershipId: adminMembership,
        membershipId: foreignMembership,
        grants: [{ role: 'STUDENT', departmentId: null }],
        expectedVersion: null,
      }),
    ).resolves.toEqual({ kind: 'NOT_FOUND' });
    expect(
      (
        await repository.replaceRoleGrants({
          tenantId: tenantA,
          actorUserId: adminUser,
          actorMembershipId: adminMembership,
          membershipId: adminMembership,
          grants: [{ role: 'AUDITOR', departmentId: null }],
          expectedVersion: null,
        })
      ).kind,
    ).toBe('FORBIDDEN');
  });

  it('isolates membership lists and deactivation kills tenant authority permanently for old sessions', async () => {
    expect(
      (await repository.listMemberships(tenantA, 25, null))!.memberships.items.every(
        (m) => m.id !== foreignMembership,
      ),
    ).toBe(true);
    expect(
      (await repository.listMemberships(tenantB, 25, null))!.memberships.items,
    ).toHaveLength(1);
    const sessionId = randomUUID();
    await repository.createLoginSession({
      userId: memberUser,
      sessionId,
      refreshTokenId: randomUUID(),
      refreshTokenHash: '0'.repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 60_000),
      requireActiveUser: true,
      requireActiveTenantMembership: true,
    });
    const deactivated = await repository.setMembershipActive(
      tenantA,
      adminMembership,
      memberMembership,
      false,
      new Date(now.getTime() + 1_000),
    );
    expect(deactivated.kind).toBe('UPDATED');
    expect(
      await authority.resolveCurrentAuthority(
        {
          kind: 'TENANT',
          userId: memberUser,
          sessionId,
          tenantId: tenantA,
          membershipId: memberMembership,
        },
        new Date(now.getTime() + 2_000),
      ),
    ).toBeNull();
    expect(
      (
        await repository.setMembershipActive(
          tenantA,
          adminMembership,
          memberMembership,
          true,
          new Date(now.getTime() + 3_000),
        )
      ).kind,
    ).toBe('UPDATED');
    expect(
      await authority.resolveCurrentAuthority(
        {
          kind: 'TENANT',
          userId: memberUser,
          sessionId,
          tenantId: tenantA,
          membershipId: memberMembership,
        },
        new Date(now.getTime() + 4_000),
      ),
    ).toBeNull();
  });
});
