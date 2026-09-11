import type { Role } from './roles.js';

export interface RequestContext {
  requestId: string;
  userId: string;
  tenantId: string;
  membershipId: string;
  roles: readonly Role[];
}
