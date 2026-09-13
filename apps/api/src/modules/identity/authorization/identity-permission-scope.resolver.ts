import { IAM_PERMISSIONS } from '@entropix/contracts';
import type {
  AuthenticatedContext,
  PermissionScope,
} from '@entropix/contracts';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PermissionScopeResolver } from './guards.js';

const tenantPermissions = new Set<string>([
  IAM_PERMISSIONS.MEMBERSHIPS_READ,
  IAM_PERMISSIONS.MEMBERSHIPS_MANAGE,
  IAM_PERMISSIONS.INVITATIONS_MANAGE,
  IAM_PERMISSIONS.ROLE_GRANTS_MANAGE,
  IAM_PERMISSIONS.TENANT_SESSIONS_REVOKE,
]);

@Injectable()
export class IdentityPermissionScopeResolver extends PermissionScopeResolver {
  async resolve(
    permission: string,
    _request: Request,
    context: AuthenticatedContext,
  ): Promise<PermissionScope | null> {
    if (context.kind === 'TENANT' && tenantPermissions.has(permission))
      return {
        kind: 'TENANT',
        tenantId: context.tenantId,
        departmentId: null,
      };
    if (
      context.kind === 'PLATFORM' &&
      permission === IAM_PERMISSIONS.PLATFORM_USERS_MANAGE
    )
      return { kind: 'PLATFORM' };
    return null;
  }
}
