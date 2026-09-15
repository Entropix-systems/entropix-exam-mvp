import type { UUID } from './common.js';
import type { Role } from './roles.js';

export type TenantRole = Exclude<Role, 'PLATFORM_ADMIN'>;

export interface ScopedRoleGrant {
  readonly role: TenantRole;
  readonly departmentId: UUID | null;
}

export interface TenantAuthContext {
  readonly kind: 'TENANT';
  readonly userId: UUID;
  readonly tenantId: UUID;
  readonly membershipId: UUID;
  /** The server-verified role bundle currently governing authorization. */
  readonly activeRole: TenantRole;
  /** All grants available to this membership; activeRole selects the effective bundle. */
  readonly grants: readonly ScopedRoleGrant[];
}

export interface PlatformAuthContext {
  readonly kind: 'PLATFORM';
  readonly userId: UUID;
  readonly role: 'PLATFORM_ADMIN';
  /** A platform-authorized institution selection, never a tenant membership. */
  readonly tenantId?: UUID;
}

/** Server-resolved authority, never copied directly from request/JWT claims. */
export type AuthenticatedContext = TenantAuthContext | PlatformAuthContext;

export type RequestContext = AuthenticatedContext & {
  readonly requestId: string;
};
