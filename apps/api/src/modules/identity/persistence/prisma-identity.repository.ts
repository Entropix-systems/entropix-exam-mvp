import type {
  AccessTokenIdentity,
  AuthenticatedContext,
  ScopedRoleGrant,
  UUID,
} from '@entropix/contracts';
import { type Prisma, PrismaClient, withTenant } from '@entropix/db';
import { canReplaceRoleGrants } from '@entropix/domain';
import { Injectable } from '@nestjs/common';
import {
  IdentityAdminRepository,
  IdentityWorkflowRepository,
  CurrentAuthorityRepository,
  type AcceptInvitationCommand,
  type AcceptInvitationResult,
  type CreateInvitationCommand,
  type CreateInvitationResult,
  type CreatePasswordResetCommand,
  type IdentityUserRecord,
  type LoginSessionCommand,
  type LoginSessionResult,
  type MembershipListItem,
  type MembershipMutationResult,
  type ReplaceMembershipRoleGrantsCommand,
  type ResetPasswordCommand,
  type ResetPasswordResult,
  type RotateRefreshCommand,
  type RotateRefreshResult,
} from '../identity.repository.js';

type Tx = Prisma.TransactionClient;

interface LockedTokenRow {
  id: string;
  tokenHash: string;
  purpose: string;
  userId: string;
  sessionId: string | null;
  tenantId: string | null;
  membershipId: string | null;
  predecessorId: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

interface LockedSessionRow {
  id: string;
  userId: string;
  kind: string;
  tenantId: string | null;
  membershipId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

const ACTIVE = 'ACTIVE';

function grantsFrom(
  rows: readonly { role: string; departmentId: string | null }[],
): ScopedRoleGrant[] {
  return rows.map((row) => ({
    role: row.role as ScopedRoleGrant['role'],
    departmentId: row.departmentId,
  }));
}

function memberFrom(row: {
  id: string;
  userId: string;
  status: string;
  version: number;
  user: { email: string };
  roleGrants: readonly { role: string; departmentId: string | null }[];
}): MembershipListItem {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    name: null,
    status: row.status,
    version: row.version,
    grants: grantsFrom(row.roleGrants),
  };
}

async function setTenant(tx: Tx, tenantId: string): Promise<void> {
  await tx.$queryRaw<Array<{ set_config: string }>>`
    SELECT set_config('app.tenant_id', ${tenantId}, true)
  `;
}

async function lockUser(tx: Tx, userId: string) {
  const [user] = await tx.$queryRaw<
    Array<{
      id: string;
      email: string;
      passwordHash: string | null;
      status: string;
      platformRole: string | null;
    }>
  >`
    SELECT id, email, password_hash AS "passwordHash", status,
           platform_role AS "platformRole"
    FROM users
    WHERE id = ${userId}::uuid
    FOR UPDATE
  `;
  return user ?? null;
}

async function lockToken(tx: Tx, hash: string, purpose: string) {
  const [token] = await tx.$queryRaw<LockedTokenRow[]>`
    SELECT id, token_hash AS "tokenHash", purpose, user_id AS "userId",
           session_id AS "sessionId", tenant_id AS "tenantId",
           membership_id AS "membershipId", predecessor_id AS "predecessorId",
           expires_at AS "expiresAt", consumed_at AS "consumedAt",
           revoked_at AS "revokedAt", created_at AS "createdAt"
    FROM auth_tokens
    WHERE token_hash = ${hash} AND purpose = ${purpose}
    FOR UPDATE
  `;
  return token ?? null;
}

async function lockSession(tx: Tx, sessionId: string) {
  const [session] = await tx.$queryRaw<LockedSessionRow[]>`
    SELECT id, user_id AS "userId", kind, tenant_id AS "tenantId",
           membership_id AS "membershipId", expires_at AS "expiresAt",
           revoked_at AS "revokedAt"
    FROM sessions
    WHERE id = ${sessionId}::uuid
    FOR UPDATE
  `;
  return session ?? null;
}

function identityFrom(session: LockedSessionRow): AccessTokenIdentity | null {
  if (session.kind === 'PLATFORM' && !session.tenantId && !session.membershipId)
    return {
      kind: 'PLATFORM',
      userId: session.userId,
      sessionId: session.id,
    };
  if (session.kind === 'TENANT' && session.tenantId && session.membershipId)
    return {
      kind: 'TENANT',
      userId: session.userId,
      sessionId: session.id,
      tenantId: session.tenantId,
      membershipId: session.membershipId,
    };
  return null;
}

@Injectable()
export class PrismaIdentityRepository
  extends IdentityWorkflowRepository
  implements IdentityAdminRepository
{
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async findUserByEmail(
    normalizedEmail: string,
  ): Promise<IdentityUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        platformRole: true,
      },
    });
    return user as IdentityUserRecord | null;
  }

  async createLoginSession(
    command: LoginSessionCommand,
  ): Promise<LoginSessionResult> {
    return this.prisma.$transaction(async (tx) => {
      const user = await lockUser(tx, command.userId);
      if (!user || user.status !== ACTIVE) return { kind: 'DENIED' };

      let binding:
        | { kind: 'PLATFORM'; tenantId: null; membershipId: null }
        | { kind: 'TENANT'; tenantId: string; membershipId: string };

      if (command.institutionSlug === null) {
        if (user.platformRole !== 'PLATFORM_ADMIN') return { kind: 'DENIED' };
        binding = { kind: 'PLATFORM', tenantId: null, membershipId: null };
      } else {
        const tenant = await tx.tenant.findUnique({
          where: { slug: command.institutionSlug },
          select: { id: true, status: true },
        });
        if (!tenant || tenant.status !== ACTIVE) return { kind: 'DENIED' };
        await setTenant(tx, tenant.id);
        const membership = await tx.membership.findUnique({
          where: {
            tenantId_userId: { tenantId: tenant.id, userId: command.userId },
          },
          select: { id: true, status: true },
        });
        if (!membership || membership.status !== ACTIVE)
          return { kind: 'DENIED' };
        binding = {
          kind: 'TENANT',
          tenantId: tenant.id,
          membershipId: membership.id,
        };
      }

      await tx.session.create({
        data: {
          id: command.sessionId,
          userId: command.userId,
          kind: binding.kind,
          tenantId: binding.tenantId,
          membershipId: binding.membershipId,
          expiresAt: command.expiresAt,
          lastUsedAt: command.now,
        },
      });
      await tx.authToken.create({
        data: {
          id: command.refreshTokenId,
          tokenHash: command.refreshTokenHash,
          purpose: 'REFRESH',
          userId: command.userId,
          sessionId: command.sessionId,
          tenantId: binding.tenantId,
          membershipId: binding.membershipId,
          expiresAt: command.expiresAt,
        },
      });
      return {
        kind: 'CREATED',
        identity: {
          kind: binding.kind,
          userId: command.userId,
          sessionId: command.sessionId,
          ...(binding.kind === 'TENANT'
            ? {
                tenantId: binding.tenantId,
                membershipId: binding.membershipId,
              }
            : {}),
        } as AccessTokenIdentity,
      };
    });
  }

  async rotateRefresh(
    command: RotateRefreshCommand,
  ): Promise<RotateRefreshResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await lockToken(tx, command.currentTokenHash, 'REFRESH');
      if (!token || !token.sessionId) return { kind: 'INVALID' };
      const session = await lockSession(tx, token.sessionId);
      if (!session || session.userId !== token.userId)
        return { kind: 'INVALID' };

      if (token.consumedAt) {
        await tx.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: {
            revokedAt: command.now,
            revocationReason: 'REFRESH_TOKEN_REPLAY',
          },
        });
        await tx.authToken.updateMany({
          where: { sessionId: session.id, revokedAt: null },
          data: { revokedAt: command.now },
        });
        return { kind: 'REPLAY' };
      }

      if (
        token.revokedAt ||
        token.expiresAt <= command.now ||
        session.revokedAt ||
        session.expiresAt <= command.now
      )
        return { kind: 'SESSION_REVOKED' };

      const user = await lockUser(tx, session.userId);
      if (!user || user.status !== ACTIVE) return { kind: 'SESSION_REVOKED' };

      if (session.kind === 'PLATFORM') {
        if (user.platformRole !== 'PLATFORM_ADMIN')
          return { kind: 'SESSION_REVOKED' };
      } else {
        if (!session.tenantId || !session.membershipId)
          return { kind: 'SESSION_REVOKED' };
        await setTenant(tx, session.tenantId);
        const authority = await tx.membership.findFirst({
          where: {
            id: session.membershipId,
            tenantId: session.tenantId,
            userId: session.userId,
            status: ACTIVE,
            tenant: { status: ACTIVE },
          },
          select: { id: true },
        });
        if (!authority) return { kind: 'SESSION_REVOKED' };
      }

      const consumed = await tx.authToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: command.now },
        },
        data: { consumedAt: command.now },
      });
      if (consumed.count !== 1) return { kind: 'INVALID' };

      await tx.authToken.create({
        data: {
          id: command.successorTokenId,
          tokenHash: command.successorTokenHash,
          purpose: 'REFRESH',
          userId: session.userId,
          sessionId: session.id,
          tenantId: session.tenantId,
          membershipId: session.membershipId,
          predecessorId: token.id,
          expiresAt: command.expiresAt,
        },
      });
      await tx.session.update({
        where: { id: session.id },
        data: {
          lastUsedAt: command.now,
          expiresAt: command.expiresAt,
        },
      });
      const identity = identityFrom(session);
      return identity ? { kind: 'ROTATED', identity } : { kind: 'INVALID' };
    });
  }

  async logoutSession(userId: UUID, sessionId: UUID, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now, revocationReason: 'LOGOUT' },
      });
      await tx.authToken.updateMany({
        where: { sessionId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  async revokeUserSessions(userId: UUID, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revocationReason: 'USER_REVOKED_SESSIONS' },
      });
      await tx.authToken.updateMany({
        where: { userId, purpose: 'REFRESH', revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  async createPasswordReset(
    command: CreatePasswordResetCommand,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await lockUser(tx, command.userId);
      if (!user || user.status !== ACTIVE)
        throw new Error('Password reset identity is not active');
      await tx.authToken.create({
        data: {
          id: command.tokenId,
          tokenHash: command.tokenHash,
          purpose: 'PASSWORD_RESET',
          userId: command.userId,
          expiresAt: command.expiresAt,
        },
      });
    });
  }

  async resetPassword(
    command: ResetPasswordCommand,
  ): Promise<ResetPasswordResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await lockToken(tx, command.tokenHash, 'PASSWORD_RESET');
      if (
        !token ||
        token.consumedAt ||
        token.revokedAt ||
        token.expiresAt <= command.now
      )
        return { kind: 'INVALID' };
      const user = await lockUser(tx, token.userId);
      if (!user || user.status !== ACTIVE) {
        await tx.authToken.update({
          where: { id: token.id },
          data: { revokedAt: command.now },
        });
        return { kind: 'USER_INACTIVE' };
      }

      const consumed = await tx.authToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: command.now },
        },
        data: { consumedAt: command.now },
      });
      if (consumed.count !== 1) return { kind: 'INVALID' };
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: command.passwordHash },
      });
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          id: { not: token.id },
          revokedAt: null,
        },
        data: { revokedAt: command.now },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: command.now, revocationReason: 'PASSWORD_RESET' },
      });
      await tx.authToken.updateMany({
        where: { userId: user.id, purpose: 'REFRESH', revokedAt: null },
        data: { revokedAt: command.now },
      });
      return { kind: 'RESET', userId: user.id };
    });
  }

  async acceptInvitation(
    command: AcceptInvitationCommand,
  ): Promise<AcceptInvitationResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await lockToken(tx, command.tokenHash, 'INVITATION');
      if (
        !token ||
        !token.tenantId ||
        !token.membershipId ||
        token.consumedAt ||
        token.revokedAt ||
        token.expiresAt <= command.now
      )
        return { kind: 'INVALID' };
      const user = await lockUser(tx, token.userId);
      if (!user || user.status !== ACTIVE) {
        await tx.authToken.update({
          where: { id: token.id },
          data: { revokedAt: command.now },
        });
        return { kind: 'USER_INACTIVE' };
      }
      if (user.passwordHash && command.passwordHash)
        return { kind: 'PASSWORD_NOT_ALLOWED' };
      if (!user.passwordHash && !command.passwordHash)
        return { kind: 'AUTHENTICATION_REQUIRED' };

      await setTenant(tx, token.tenantId);
      const [membership] = await tx.$queryRaw<
        Array<{ id: string; status: string; userId: string }>
      >`
        SELECT id, status, user_id AS "userId"
        FROM memberships
        WHERE id = ${token.membershipId}::uuid
          AND tenant_id = ${token.tenantId}::uuid
        FOR UPDATE
      `;
      if (
        !membership ||
        membership.userId !== user.id ||
        membership.status !== 'INVITED'
      ) {
        await tx.authToken.update({
          where: { id: token.id },
          data: { revokedAt: command.now },
        });
        return { kind: 'INVALID' };
      }

      const consumed = await tx.authToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: command.now },
        },
        data: { consumedAt: command.now },
      });
      if (consumed.count !== 1) return { kind: 'INVALID' };
      if (command.passwordHash)
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: command.passwordHash },
        });
      await tx.membership.update({
        where: { id: membership.id },
        data: { status: ACTIVE, version: { increment: 1 } },
      });
      return { kind: 'ACCEPTED' };
    });
  }

  async listMemberships(
    tenantId: UUID,
  ): Promise<readonly MembershipListItem[]> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const rows = await tx.membership.findMany({
        where: { tenantId },
        include: {
          user: { select: { email: true } },
          roleGrants: {
            select: { role: true, departmentId: true },
            orderBy: [{ role: 'asc' }, { departmentId: 'asc' }],
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(memberFrom);
    });
  }

  async createInvitation(
    command: CreateInvitationCommand,
  ): Promise<CreateInvitationResult> {
    return withTenant(this.prisma, command.tenantId, async (tx) => {
      const actor = await tx.membership.findFirst({
        where: {
          id: command.actorMembershipId,
          tenantId: command.tenantId,
          status: ACTIVE,
          roleGrants: {
            some: { role: 'INSTITUTION_ADMIN', departmentId: null },
          },
        },
        select: { id: true },
      });
      if (!actor) return { kind: 'INELIGIBLE' };
      const user = await tx.user.upsert({
        where: { email: command.email },
        update: {},
        create: { email: command.email, status: ACTIVE },
        select: { id: true, status: true },
      });
      if (user.status !== ACTIVE) return { kind: 'INELIGIBLE' };

      let membership = await tx.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: command.tenantId, userId: user.id },
        },
        select: { id: true, status: true },
      });
      if (membership && membership.status !== 'INVITED')
        return { kind: 'INELIGIBLE' };
      if (!membership) {
        membership = await tx.membership.create({
          data: {
            tenantId: command.tenantId,
            userId: user.id,
            status: 'INVITED',
          },
          select: { id: true, status: true },
        });
      } else {
        await tx.roleGrant.deleteMany({
          where: { tenantId: command.tenantId, membershipId: membership.id },
        });
        await tx.authToken.updateMany({
          where: {
            purpose: 'INVITATION',
            tenantId: command.tenantId,
            membershipId: membership.id,
            consumedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: command.now },
        });
      }
      await tx.roleGrant.createMany({
        data: command.grants.map((grant) => ({
          tenantId: command.tenantId,
          membershipId: membership!.id,
          role: grant.role,
          departmentId: grant.departmentId,
        })),
      });
      await tx.authToken.create({
        data: {
          id: command.invitationTokenId,
          tokenHash: command.invitationTokenHash,
          purpose: 'INVITATION',
          userId: user.id,
          tenantId: command.tenantId,
          membershipId: membership.id,
          expiresAt: command.expiresAt,
        },
      });
      const created = await tx.membership.findUniqueOrThrow({
        where: { id: membership.id },
        include: {
          user: { select: { email: true } },
          roleGrants: { select: { role: true, departmentId: true } },
        },
      });
      return { kind: 'CREATED', membership: memberFrom(created) };
    });
  }

  async replaceRoleGrants(
    command: ReplaceMembershipRoleGrantsCommand,
  ): Promise<MembershipMutationResult> {
    return withTenant(this.prisma, command.tenantId, async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{ id: string; version: number }>
      >`
        SELECT id, version
        FROM memberships
        WHERE id = ${command.membershipId}::uuid
          AND tenant_id = ${command.tenantId}::uuid
        FOR UPDATE
      `;
      if (!locked) return { kind: 'NOT_FOUND' };
      if (
        command.expectedVersion !== null &&
        locked.version !== command.expectedVersion
      )
        return { kind: 'VERSION_CONFLICT' };
      const current = await tx.membership.findUniqueOrThrow({
        where: { id: command.membershipId },
        include: {
          user: { select: { email: true } },
          roleGrants: { select: { role: true, departmentId: true } },
        },
      });
      const actorMembership = await tx.membership.findFirst({
        where: {
          id: command.actorMembershipId,
          tenantId: command.tenantId,
          status: ACTIVE,
        },
        include: {
          roleGrants: { select: { role: true, departmentId: true } },
        },
      });
      if (!actorMembership) return { kind: 'FORBIDDEN' };
      const actor: AuthenticatedContext = {
        kind: 'TENANT',
        userId: command.actorUserId,
        tenantId: command.tenantId,
        membershipId: command.actorMembershipId,
        grants: grantsFrom(actorMembership.roleGrants),
      };
      if (
        !canReplaceRoleGrants(
          actor,
          {
            userId: current.userId,
            tenantId: command.tenantId,
            membershipId: current.id,
            grants: grantsFrom(current.roleGrants),
          },
          command.grants,
        )
      )
        return { kind: 'FORBIDDEN' };
      await tx.roleGrant.deleteMany({
        where: { tenantId: command.tenantId, membershipId: current.id },
      });
      await tx.roleGrant.createMany({
        data: command.grants.map((grant) => ({
          tenantId: command.tenantId,
          membershipId: current.id,
          role: grant.role,
          departmentId: grant.departmentId,
        })),
      });
      const updated = await tx.membership.update({
        where: { id: current.id },
        data: { version: { increment: 1 } },
        include: {
          user: { select: { email: true } },
          roleGrants: { select: { role: true, departmentId: true } },
        },
      });
      return { kind: 'UPDATED', membership: memberFrom(updated) };
    });
  }

  async setMembershipActive(
    tenantId: UUID,
    actorMembershipId: UUID,
    membershipId: UUID,
    active: boolean,
    now: Date,
  ): Promise<MembershipMutationResult> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const [locked] = await tx.$queryRaw<
        Array<{ id: string; status: string; userId: string }>
      >`
        SELECT id, status, user_id AS "userId"
        FROM memberships
        WHERE id = ${membershipId}::uuid AND tenant_id = ${tenantId}::uuid
        FOR UPDATE
      `;
      if (!locked) return { kind: 'NOT_FOUND' };
      const actor = await tx.membership.findFirst({
        where: {
          id: actorMembershipId,
          tenantId,
          status: ACTIVE,
          roleGrants: {
            some: { role: 'INSTITUTION_ADMIN', departmentId: null },
          },
        },
        select: { id: true },
      });
      if (!actor) return { kind: 'FORBIDDEN' };
      if (!active && locked.id === actorMembershipId)
        return { kind: 'FORBIDDEN' };
      const allowed = active
        ? locked.status === 'INACTIVE'
        : locked.status === ACTIVE;
      if (!allowed) return { kind: 'INELIGIBLE' };

      const updated = await tx.membership.update({
        where: { id: locked.id },
        data: {
          status: active ? ACTIVE : 'INACTIVE',
          version: { increment: 1 },
        },
        include: {
          user: { select: { email: true } },
          roleGrants: { select: { role: true, departmentId: true } },
        },
      });
      if (!active) {
        const sessions = await tx.session.findMany({
          where: { tenantId, membershipId: locked.id, revokedAt: null },
          select: { id: true },
        });
        const ids = sessions.map((session) => session.id);
        await tx.session.updateMany({
          where: { id: { in: ids }, revokedAt: null },
          data: { revokedAt: now, revocationReason: 'MEMBERSHIP_DEACTIVATED' },
        });
        await tx.authToken.updateMany({
          where: { sessionId: { in: ids }, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      return { kind: 'UPDATED', membership: memberFrom(updated) };
    });
  }
}

@Injectable()
export class PrismaCurrentAuthorityRepository extends CurrentAuthorityRepository {
  constructor(private readonly prisma: PrismaClient) {
    super();
  }

  async resolveCurrentAuthority(
    identity: AccessTokenIdentity,
    now: Date,
  ): Promise<AuthenticatedContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: identity.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== identity.userId ||
      session.user.status !== ACTIVE ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.kind !== identity.kind
    )
      return null;
    if (identity.kind === 'PLATFORM')
      return session.tenantId === null &&
        session.membershipId === null &&
        session.user.platformRole === 'PLATFORM_ADMIN'
        ? { kind: 'PLATFORM', userId: identity.userId, role: 'PLATFORM_ADMIN' }
        : null;
    if (
      session.tenantId !== identity.tenantId ||
      session.membershipId !== identity.membershipId
    )
      return null;
    return withTenant(this.prisma, identity.tenantId, async (tx) => {
      const membership = await tx.membership.findFirst({
        where: {
          id: identity.membershipId,
          tenantId: identity.tenantId,
          userId: identity.userId,
          status: ACTIVE,
          tenant: { status: ACTIVE },
        },
        include: {
          roleGrants: { select: { role: true, departmentId: true } },
        },
      });
      return membership
        ? {
            kind: 'TENANT',
            userId: identity.userId,
            tenantId: identity.tenantId,
            membershipId: identity.membershipId,
            grants: grantsFrom(membership.roleGrants),
          }
        : null;
    });
  }
}
