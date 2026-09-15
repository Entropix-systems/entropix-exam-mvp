import type {
  AccessTokenIdentity,
  AuthenticatedContext,
  ScopedRoleGrant,
  TenantRole,
  UUID,
} from '@entropix/contracts';
import { ROLES } from '@entropix/contracts';
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
  type SwitchSessionContextCommand,
  type SwitchSessionContextResult,
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
  activeRole: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

const ACTIVE = 'ACTIVE';
const rolePriority: readonly TenantRole[] = [
  ROLES.INSTITUTION_ADMIN,
  ROLES.EXAM_CONTROLLER,
  ROLES.DEPARTMENT_ADMIN,
  ROLES.FACULTY,
  ROLES.INVIGILATOR,
  ROLES.STUDENT,
  ROLES.AUDITOR,
];

function defaultRole(
  grants: readonly { role: string }[],
): TenantRole | null {
  return rolePriority.find((role) => grants.some((grant) => grant.role === role)) ?? null;
}

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
  user: { name: string | null; email: string };
  roleGrants: readonly { role: string; departmentId: string | null }[];
}): MembershipListItem {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    name: row.user.name,
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

async function setIdentityUser(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw<Array<{ set_config: string }>>`
    SELECT set_config('app.identity_user_id', ${userId}, true)
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
           membership_id AS "membershipId", active_role AS "activeRole",
           expires_at AS "expiresAt",
           revoked_at AS "revokedAt"
    FROM sessions
    WHERE id = ${sessionId}::uuid
    FOR UPDATE
  `;
  return session ?? null;
}

function identityFrom(session: LockedSessionRow): AccessTokenIdentity | null {
  if (session.kind === 'PLATFORM' && !session.membershipId)
    return {
      kind: 'PLATFORM',
      userId: session.userId,
      sessionId: session.id,
      ...(session.tenantId ? { tenantId: session.tenantId } : {}),
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

      await setIdentityUser(tx, command.userId);
      const membership = await tx.membership.findFirst({
        where: {
          userId: command.userId,
          status: ACTIVE,
          tenant: { status: ACTIVE },
          roleGrants: { some: {} },
        },
        select: {
          id: true,
          tenantId: true,
          roleGrants: { select: { role: true }, orderBy: { role: 'asc' } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const activeRole = membership ? defaultRole(membership.roleGrants) : null;
      const binding =
        membership && activeRole
          ? {
              kind: 'TENANT' as const,
              tenantId: membership.tenantId,
              membershipId: membership.id,
              activeRole,
            }
          : user.platformRole === ROLES.PLATFORM_ADMIN
            ? {
                kind: 'PLATFORM' as const,
                tenantId: null,
                membershipId: null,
                activeRole: null,
              }
            : null;
      if (!binding) return { kind: 'NO_ACCESS' };

      await tx.session.create({
        data: {
          id: command.sessionId,
          userId: command.userId,
          kind: binding.kind,
          tenantId: binding.tenantId,
          membershipId: binding.membershipId,
          activeRole: binding.activeRole,
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

  async switchSessionContext(
    command: SwitchSessionContextCommand,
  ): Promise<SwitchSessionContextResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await lockSession(tx, command.sessionId);
      if (
        !session ||
        session.userId !== command.userId ||
        session.revokedAt ||
        session.expiresAt <= command.now
      )
        return { kind: 'SESSION_INVALID' };
      const user = await lockUser(tx, command.userId);
      if (!user || user.status !== ACTIVE) return { kind: 'SESSION_INVALID' };

      if (user.platformRole === ROLES.PLATFORM_ADMIN) {
        const tenant = command.returnToPlatform
          ? null
          : await tx.tenant.findFirst({
              where: { id: command.institutionId ?? undefined, status: ACTIVE },
              select: { id: true },
            });
        if (!command.returnToPlatform && !tenant) return { kind: 'FORBIDDEN' };
        const tenantId = tenant?.id ?? null;
        await tx.session.update({
          where: { id: session.id },
          data: { kind: 'PLATFORM', tenantId, membershipId: null, activeRole: null, lastUsedAt: command.now },
        });
        await tx.authToken.updateMany({
          where: { sessionId: session.id, purpose: 'REFRESH', consumedAt: null, revokedAt: null },
          data: { tenantId, membershipId: null },
        });
        await tx.platformAuditEvent.create({
          data: {
            actorUserId: command.userId,
            tenantId,
            action: command.returnToPlatform ? 'PLATFORM_CONTEXT_RETURNED' : 'PLATFORM_INSTITUTION_CONTEXT_SELECTED',
            requestId: command.requestId,
            previous: session.tenantId ? { tenantId: session.tenantId } : undefined,
            next: tenantId ? { tenantId } : undefined,
          },
        });
        return {
          kind: 'SWITCHED',
          identity: { kind: 'PLATFORM', userId: command.userId, sessionId: session.id, ...(tenantId ? { tenantId } : {}) },
        };
      }
      if (!command.institutionId || command.returnToPlatform) return { kind: 'FORBIDDEN' };

      await setIdentityUser(tx, command.userId);
      const membership = await tx.membership.findFirst({
        where: {
          tenantId: command.institutionId,
          userId: command.userId,
          status: ACTIVE,
          tenant: { status: ACTIVE },
          roleGrants: command.role
            ? { some: { role: command.role } }
            : { some: {} },
        },
        select: {
          id: true,
          tenantId: true,
          roleGrants: { select: { role: true }, orderBy: { role: 'asc' } },
        },
      });
      if (!membership) return { kind: 'FORBIDDEN' };
      const activeRole = command.role ?? defaultRole(membership.roleGrants);
      if (!activeRole) return { kind: 'FORBIDDEN' };

      await tx.session.update({
        where: { id: session.id },
        data: {
          kind: 'TENANT',
          tenantId: membership.tenantId,
          membershipId: membership.id,
          activeRole,
          lastUsedAt: command.now,
        },
      });
      await tx.authToken.updateMany({
        where: {
          sessionId: session.id,
          purpose: 'REFRESH',
          consumedAt: null,
          revokedAt: null,
        },
        data: {
          tenantId: membership.tenantId,
          membershipId: membership.id,
        },
      });
      return {
        kind: 'SWITCHED',
        identity: {
          kind: 'TENANT',
          userId: command.userId,
          sessionId: session.id,
          tenantId: membership.tenantId,
          membershipId: membership.id,
        },
      };
    });
  }

  async currentUserAccess(userId: UUID) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, status: ACTIVE },
        select: { name: true, email: true, platformRole: true },
      });
      if (!user) return null;
      if (user.platformRole === ROLES.PLATFORM_ADMIN) {
        const institutions = await tx.tenant.findMany({
          where: { status: ACTIVE },
          select: { id: true, name: true, slug: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        return { name: user.name, email: user.email, institutions };
      }
      await setIdentityUser(tx, userId);
      const memberships = await tx.membership.findMany({
        where: {
          userId,
          status: ACTIVE,
          tenant: { status: ACTIVE },
          roleGrants: { some: {} },
        },
        select: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return {
        name: user.name,
        email: user.email,
        institutions: memberships.map(({ tenant }) => tenant),
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
        if (session.activeRole !== null || user.platformRole !== ROLES.PLATFORM_ADMIN)
          return { kind: 'SESSION_REVOKED' };
        if (session.tenantId) {
          const tenant = await tx.tenant.findFirst({ where: { id: session.tenantId, status: ACTIVE }, select: { id: true } });
          if (!tenant) return { kind: 'SESSION_REVOKED' };
        }
      } else {
        if (!session.tenantId || !session.membershipId || !session.activeRole)
          return { kind: 'SESSION_REVOKED' };
        if (
          token.tenantId !== session.tenantId ||
          token.membershipId !== session.membershipId
        )
          return { kind: 'SESSION_REVOKED' };
        await setTenant(tx, session.tenantId);
        const authority = await tx.membership.findFirst({
          where: {
            id: session.membershipId,
            tenantId: session.tenantId,
            userId: session.userId,
            status: ACTIVE,
            tenant: { status: ACTIVE },
            roleGrants: { some: { role: session.activeRole } },
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
    pageSize: number,
    cursor: UUID | null,
  ) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const staffWhere: Prisma.MembershipWhereInput = {
        tenantId,
        student: { is: null },
        roleGrants: { none: { role: ROLES.STUDENT } },
      };
      if (cursor) {
        const cursorExists = await tx.membership.findFirst({
          where: { ...staffWhere, id: cursor },
          select: { id: true },
        });
        if (!cursorExists) return null;
      }
      const [institution, departments, rows] = await Promise.all([
        tx.tenant.findFirst({
          where: { id: tenantId, status: ACTIVE },
          select: { name: true },
        }),
        tx.department.findMany({
          where: { tenantId },
          select: { id: true, name: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        tx.membership.findMany({
          where: staffWhere,
          include: {
            user: { select: { name: true, email: true } },
            roleGrants: {
              select: { role: true, departmentId: true },
              orderBy: [{ role: 'asc' }, { departmentId: 'asc' }],
            },
          },
          orderBy: { id: 'asc' },
          take: pageSize + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      ]);
      if (!institution) return null;
      const hasMore = rows.length > pageSize;
      const visibleRows = hasMore ? rows.slice(0, pageSize) : rows;
      return {
        institutionName: institution.name,
        departments,
        memberships: {
          items: visibleRows.map(memberFrom),
          nextCursor: hasMore
            ? visibleRows[visibleRows.length - 1]?.id ?? null
            : null,
        },
      };
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
      const existingUser = await tx.user.findUnique({
        where: { email: command.email },
        select: { id: true, name: true, status: true },
      });
      const user = existingUser
        ? existingUser.name
          ? existingUser
          : await tx.user.update({
              where: { id: existingUser.id },
              data: { name: command.name },
              select: { id: true, name: true, status: true },
            })
        : await tx.user.create({
            data: { name: command.name, email: command.email, status: ACTIVE },
            select: { id: true, name: true, status: true },
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
          user: { select: { name: true, email: true } },
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
          user: { select: { name: true, email: true } },
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
        activeRole: ROLES.INSTITUTION_ADMIN,
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
          user: { select: { name: true, email: true } },
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
          user: { select: { name: true, email: true } },
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
    if (identity.kind === 'PLATFORM') {
      if (session.tenantId && !await this.prisma.tenant.findFirst({ where: { id: session.tenantId, status: ACTIVE }, select: { id: true } })) return null;
      return session.tenantId === (identity.tenantId ?? null) &&
        session.membershipId === null &&
        session.activeRole === null &&
        session.user.platformRole === 'PLATFORM_ADMIN'
        ? { kind: 'PLATFORM', userId: identity.userId, role: 'PLATFORM_ADMIN', ...(session.tenantId ? { tenantId: session.tenantId } : {}) }
        : null;
    }
    if (
      session.tenantId !== identity.tenantId ||
      session.membershipId !== identity.membershipId ||
      !session.activeRole
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
      if (!membership) return null;
      const grants = grantsFrom(membership.roleGrants);
      if (!grants.some((grant) => grant.role === session.activeRole))
        return null;
      return {
        kind: 'TENANT',
        userId: identity.userId,
        tenantId: identity.tenantId,
        membershipId: identity.membershipId,
        activeRole: session.activeRole as TenantRole,
        grants,
      };
    });
  }
}
