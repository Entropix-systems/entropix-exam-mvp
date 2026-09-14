import { describe, expect, it } from 'vitest';
import { IAM_PERMISSIONS as P, ROLES } from '@entropix/contracts';
import type { ScopedRoleGrant, TenantAuthContext, TenantRole } from '@entropix/contracts';
import { isAccessTokenIdentity, isAuthenticatedContext } from './context.js';
import { canReplaceRoleGrants, hasPermission } from './permissions.js';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tenantId = '11111111-1111-4111-8111-111111111111';
const foreignTenant = '22222222-2222-4222-8222-222222222222';
const membershipId = '33333333-3333-4333-8333-333333333333';
const departmentA = '44444444-4444-4444-8444-444444444444';
const departmentB = '55555555-5555-4555-8555-555555555555';
const departmentC = '66666666-6666-4666-8666-666666666666';
const tenant = (grants: readonly ScopedRoleGrant[]): TenantAuthContext => ({
  kind: 'TENANT',
  userId,
  tenantId,
  membershipId,
  activeRole: (grants[0]?.role ?? 'STUDENT') as TenantRole,
  grants,
});
const platform = { kind: 'PLATFORM', userId, role: 'PLATFORM_ADMIN' } as const;
const scope = (departmentId: string | null = null) =>
  ({ kind: 'TENANT', tenantId, departmentId }) as const;

describe('canonical identity contexts', () => {
  it('has exactly the eight canonical role bundles', () => {
    expect(Object.values(ROLES).sort()).toEqual(
      [
        'PLATFORM_ADMIN',
        'INSTITUTION_ADMIN',
        'EXAM_CONTROLLER',
        'DEPARTMENT_ADMIN',
        'FACULTY',
        'INVIGILATOR',
        'STUDENT',
        'AUDITOR',
      ].sort(),
    );
  });
  it('distinguishes platform authority without fabricating tenant records', () => {
    expect(isAuthenticatedContext(platform)).toBe(true);
    expect(isAuthenticatedContext({ ...platform, tenantId })).toBe(true);
    expect(isAuthenticatedContext(tenant([]))).toBe(false);
    expect(
      isAuthenticatedContext({ ...tenant([]), membershipId: undefined }),
    ).toBe(false);
    expect(
      isAuthenticatedContext(
        tenant([{ role: 'PLATFORM_ADMIN', departmentId: null } as never]),
      ),
    ).toBe(false);
  });
  it('rejects malformed IDs, roles, and department grants', () => {
    for (const role of [
      'HOD',
      'EXAMINER',
      'OBSERVER',
      'FACULTY_EXAMINER',
      'INVIGILATOR_OBSERVER',
      'toString',
    ]) {
      expect(
        isAuthenticatedContext(tenant([{ role, departmentId: null } as never])),
      ).toBe(false);
    }
    expect(isAuthenticatedContext({ ...platform, userId: 'not-a-uuid' })).toBe(
      false,
    );
    expect(
      isAuthenticatedContext(
        tenant([{ role: 'DEPARTMENT_ADMIN', departmentId: null }]),
      ),
    ).toBe(false);
    expect(
      isAuthenticatedContext(
        tenant([{ role: 'INSTITUTION_ADMIN', departmentId: departmentA }]),
      ),
    ).toBe(false);
  });
  it('validates access identity hints independently from authority', () => {
    const identity = { kind: 'PLATFORM', userId, sessionId: membershipId };
    expect(isAccessTokenIdentity(identity)).toBe(true);
    expect(isAccessTokenIdentity({ ...identity, tenantId })).toBe(true);
    expect(
      isAccessTokenIdentity({
        ...identity,
        kind: 'TENANT',
        tenantId,
        membershipId,
      }),
    ).toBe(true);
    expect(
      isAccessTokenIdentity({ ...identity, kind: 'TENANT', tenantId }),
    ).toBe(false);
  });
});

describe('IAM permissions and scopes', () => {
  it('grants self operations only for the authenticated user', () => {
    for (const context of [
      platform,
      tenant([{ role: 'STUDENT', departmentId: null }]),
    ]) {
      expect(
        hasPermission(context, P.OWN_SESSIONS_MANAGE, { kind: 'SELF', userId }),
      ).toBe(true);
      expect(
        hasPermission(context, P.OWN_SESSIONS_MANAGE, {
          kind: 'SELF',
          userId: otherUserId,
        }),
      ).toBe(false);
    }
  });
  it('never treats platform authority as a tenant bypass', () => {
    expect(
      hasPermission(platform, P.PLATFORM_USERS_MANAGE, { kind: 'PLATFORM' }),
    ).toBe(true);
    expect(hasPermission(platform, P.MEMBERSHIPS_MANAGE, scope())).toBe(false);
    expect(
      hasPermission(
        tenant([{ role: 'INSTITUTION_ADMIN', departmentId: null }]),
        P.PLATFORM_USERS_MANAGE,
        { kind: 'PLATFORM' },
      ),
    ).toBe(false);
  });
  it('checks permissions with the SAME grant scope', () => {
    const context = tenant([
      { role: 'DEPARTMENT_ADMIN', departmentId: departmentA },
      { role: 'FACULTY', departmentId: departmentB },
    ]);
    expect(hasPermission(context, P.MEMBERSHIPS_READ, scope(departmentA))).toBe(
      true,
    );
    expect(hasPermission(context, P.MEMBERSHIPS_READ, scope(departmentB))).toBe(
      false,
    );
    expect(hasPermission(context, P.MEMBERSHIPS_READ, scope())).toBe(false);
    expect(
      hasPermission(context, P.MEMBERSHIPS_MANAGE, scope(departmentA)),
    ).toBe(false);
  });
  it('supports multiple department grants without widening their union', () => {
    const context = tenant(
      [departmentA, departmentB].map((departmentId) => ({
        role: 'DEPARTMENT_ADMIN',
        departmentId,
      })),
    );
    for (const department of [departmentA, departmentB])
      expect(
        hasPermission(context, P.MEMBERSHIPS_READ, scope(department)),
      ).toBe(true);
    expect(hasPermission(context, P.MEMBERSHIPS_READ, scope(departmentC))).toBe(
      false,
    );
    expect(
      isAuthenticatedContext(
        tenant(
          [departmentA, departmentB].map((departmentId) => ({
            role: 'FACULTY',
            departmentId,
          })),
        ),
      ),
    ).toBe(true);
  });
  it('uses only the active role bundle when a membership has multiple roles', () => {
    const grants = [
      { role: 'INSTITUTION_ADMIN', departmentId: null },
      { role: 'AUDITOR', departmentId: null },
    ] as const;
    const administrator = { ...tenant(grants), activeRole: 'INSTITUTION_ADMIN' as const };
    const auditor = { ...tenant(grants), activeRole: 'AUDITOR' as const };

    expect(hasPermission(administrator, P.MEMBERSHIPS_MANAGE, scope())).toBe(true);
    expect(hasPermission(auditor, P.MEMBERSHIPS_MANAGE, scope())).toBe(false);
    expect(isAuthenticatedContext(auditor)).toBe(true);
  });
  it('denies foreign tenants and unknown permissions, roles, and scopes', () => {
    const admin = tenant([{ role: 'INSTITUTION_ADMIN', departmentId: null }]);
    expect(hasPermission(admin, P.MEMBERSHIPS_MANAGE, scope())).toBe(true);
    expect(
      hasPermission(admin, P.MEMBERSHIPS_MANAGE, {
        ...scope(),
        tenantId: foreignTenant,
      }),
    ).toBe(false);
    for (const permission of ['toString', '__proto__', 'iam.magic'])
      expect(hasPermission(admin, permission, scope())).toBe(false);
    expect(
      hasPermission(
        tenant([{ role: 'UNKNOWN', departmentId: null } as never]),
        P.MEMBERSHIPS_READ,
        scope(),
      ),
    ).toBe(false);
    expect(
      hasPermission(admin, P.MEMBERSHIPS_READ, { kind: 'UNKNOWN' } as never),
    ).toBe(false);
  });
  it('does not give ordinary tenant roles IAM administration', () => {
    for (const role of [
      'EXAM_CONTROLLER',
      'FACULTY',
      'INVIGILATOR',
      'STUDENT',
      'AUDITOR',
    ] as const) {
      expect(
        hasPermission(
          tenant([{ role, departmentId: null }]),
          P.ROLE_GRANTS_MANAGE,
          scope(),
        ),
      ).toBe(false);
    }
  });
});

describe('role replacement', () => {
  const admin = tenant([{ role: 'INSTITUTION_ADMIN', departmentId: null }]);
  const target = {
    userId: otherUserId,
    membershipId: departmentC,
    tenantId,
    grants: [{ role: 'FACULTY', departmentId: departmentA }] as const,
  };
  it('allows an institution administrator to manage another tenant member', () => {
    expect(
      canReplaceRoleGrants(admin, target, [
        { role: 'FACULTY', departmentId: departmentB },
      ]),
    ).toBe(true);
  });
  it('denies self-escalation and platform privilege injection', () => {
    expect(
      canReplaceRoleGrants(
        tenant(target.grants),
        { ...target, userId },
        admin.grants,
      ),
    ).toBe(false);
    expect(
      canReplaceRoleGrants(
        admin,
        { ...target, userId, membershipId, grants: admin.grants },
        [...admin.grants, ...target.grants],
      ),
    ).toBe(false);
    expect(
      canReplaceRoleGrants(admin, target, [
        { role: 'PLATFORM_ADMIN', departmentId: null } as never,
      ]),
    ).toBe(false);
  });
  it('rejects cross-tenant and duplicate grants', () => {
    expect(
      canReplaceRoleGrants(
        admin,
        { ...target, tenantId: foreignTenant },
        target.grants,
      ),
    ).toBe(false);
    expect(
      canReplaceRoleGrants(admin, target, [target.grants[0], target.grants[0]]),
    ).toBe(false);
  });
  it('does not let UUID casing bypass self-change or duplicate-scope checks', () => {
    expect(
      canReplaceRoleGrants(
        admin,
        { ...target, userId: userId.toUpperCase() },
        admin.grants,
      ),
    ).toBe(false);
    expect(
      canReplaceRoleGrants(admin, target, [
        { role: 'FACULTY', departmentId: userId },
        { role: 'FACULTY', departmentId: userId.toUpperCase() },
      ]),
    ).toBe(false);
    expect(
      hasPermission(admin, P.OWN_SESSIONS_MANAGE, {
        kind: 'SELF',
        userId: userId.toUpperCase(),
      }),
    ).toBe(true);
  });
});
