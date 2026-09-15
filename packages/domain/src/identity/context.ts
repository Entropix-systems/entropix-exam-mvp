import { ROLES } from '@entropix/contracts';
import type {
  AccessTokenIdentity,
  AuthenticatedContext,
  ScopedRoleGrant,
} from '@entropix/contracts';

const roleValues: readonly string[] = Object.values(ROLES);
const tenantRoleValues = roleValues.filter(
  (role) => role !== ROLES.PLATFORM_ADMIN,
);
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isScopedRoleGrant(value: unknown): value is ScopedRoleGrant {
  if (
    !record(value) ||
    typeof value.role !== 'string' ||
    !roleValues.includes(value.role) ||
    value.role === ROLES.PLATFORM_ADMIN
  )
    return false;
  if (value.departmentId !== null && !isUuid(value.departmentId)) return false;
  if (value.role === ROLES.DEPARTMENT_ADMIN && value.departmentId === null)
    return false;
  if (value.role === ROLES.INSTITUTION_ADMIN && value.departmentId !== null)
    return false;
  return true;
}
export function isAuthenticatedContext(
  value: unknown,
): value is AuthenticatedContext {
  if (!record(value) || !isUuid(value.userId)) return false;
  if (value.kind === 'PLATFORM') {
    return (
      value.role === ROLES.PLATFORM_ADMIN &&
      (!('tenantId' in value) || isUuid(value.tenantId)) &&
      !('membershipId' in value) &&
      !('grants' in value)
    );
  }
  return (
    value.kind === 'TENANT' &&
    !('role' in value) &&
    isUuid(value.tenantId) &&
    isUuid(value.membershipId) &&
    typeof value.activeRole === 'string' &&
    tenantRoleValues.includes(value.activeRole) &&
    Array.isArray(value.grants) &&
    value.grants.every(isScopedRoleGrant) &&
    value.grants.some((grant) => grant.role === value.activeRole)
  );
}
export function isAccessTokenIdentity(
  value: unknown,
): value is AccessTokenIdentity {
  if (!record(value) || !isUuid(value.userId) || !isUuid(value.sessionId))
    return false;
  if (value.kind === 'PLATFORM')
    return (!('tenantId' in value) || isUuid(value.tenantId)) && !('membershipId' in value);
  return (
    value.kind === 'TENANT' &&
    isUuid(value.tenantId) &&
    isUuid(value.membershipId)
  );
}
