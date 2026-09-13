import { IAM_PERMISSIONS as P } from '@entropix/contracts';
import type {
  AuthenticatedContext,
  IamPermission,
  PermissionScope,
  ScopedRoleGrant,
  TenantRole,
} from '@entropix/contracts';
import {
  isAuthenticatedContext,
  isScopedRoleGrant,
  isUuid,
} from './context.js';

const selfPermissions: readonly string[] = [
  P.CURRENT_USER_READ,
  P.OWN_SESSIONS_MANAGE,
];
const sameUuid = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();
const tenantPermissions: Readonly<
  Record<TenantRole, readonly IamPermission[]>
> = {
  INSTITUTION_ADMIN: [
    P.MEMBERSHIPS_READ,
    P.MEMBERSHIPS_MANAGE,
    P.INVITATIONS_MANAGE,
    P.ROLE_GRANTS_MANAGE,
    P.TENANT_SESSIONS_REVOKE,
  ],
  DEPARTMENT_ADMIN: [P.MEMBERSHIPS_READ],
  EXAM_CONTROLLER: [],
  FACULTY: [],
  INVIGILATOR: [],
  STUDENT: [],
  AUDITOR: [],
};

export function hasActiveRole(
  context: AuthenticatedContext,
  roles: readonly TenantRole[],
): boolean {
  return context.kind === 'TENANT' && roles.includes(context.activeRole);
}

/** Scope is loaded by the server. A role check never replaces domain ownership/assignment checks. */
export function hasPermission(
  context: unknown,
  permission: string,
  scope: PermissionScope,
): boolean {
  if (
    !isAuthenticatedContext(context) ||
    !Object.values(P).some((value) => value === permission) ||
    !scope
  )
    return false;
  if (scope.kind === 'SELF')
    return (
      isUuid(scope.userId) &&
      sameUuid(scope.userId, context.userId) &&
      selfPermissions.includes(permission)
    );
  if (scope.kind === 'PLATFORM')
    return (
      context.kind === 'PLATFORM' && permission === P.PLATFORM_USERS_MANAGE
    );
  if (
    scope.kind !== 'TENANT' ||
    context.kind !== 'TENANT' ||
    !isUuid(scope.tenantId) ||
    !sameUuid(scope.tenantId, context.tenantId)
  )
    return false;
  if (scope.departmentId !== null && !isUuid(scope.departmentId)) return false;
  // Evaluate permission AND scope on the same grant; never flatten into separate sets.
  return context.grants.some(
    (grant) =>
      grant.role === context.activeRole &&
      tenantPermissions[grant.role].some((value) => value === permission) &&
      (grant.departmentId === null ||
        (scope.departmentId !== null &&
          sameUuid(grant.departmentId, scope.departmentId))),
  );
}

export interface RoleGrantTarget {
  userId: string;
  tenantId: string;
  membershipId: string;
  grants: readonly ScopedRoleGrant[];
}

/** Defense against self-escalation; target and existing grants must be server-loaded. */
export function canReplaceRoleGrants(
  context: AuthenticatedContext,
  target: RoleGrantTarget,
  proposed: readonly ScopedRoleGrant[],
): boolean {
  if (
    !target ||
    !isUuid(target.userId) ||
    !isUuid(target.membershipId) ||
    !Array.isArray(proposed) ||
    !proposed.every(isScopedRoleGrant) ||
    !Array.isArray(target.grants) ||
    !target.grants.every(isScopedRoleGrant)
  )
    return false;
  if (
    !hasPermission(context, P.ROLE_GRANTS_MANAGE, {
      kind: 'TENANT',
      tenantId: target.tenantId,
      departmentId: null,
    })
  )
    return false;
  const keys = (grants: readonly ScopedRoleGrant[]) =>
    grants
      .map((g) => `${g.role}:${g.departmentId?.toLowerCase() ?? '*'}`)
      .sort();
  const next = keys(proposed);
  if (new Set(next).size !== next.length) return false;
  // Even an administrator cannot rewrite their own grants through this command.
  if (
    sameUuid(context.userId, target.userId) ||
    (context.kind === 'TENANT' &&
      sameUuid(context.membershipId, target.membershipId))
  )
    return JSON.stringify(keys(target.grants)) === JSON.stringify(next);
  return true;
}
