import type {
  AuthenticatedContext,
  CreateInvitationRequest,
} from '@entropix/contracts';
import { IAM_PERMISSIONS } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { IdentityAdminService } from '../application/identity-admin.service.js';
import {
  CurrentAuthContext,
  RequirePermissions,
} from '../authorization/decorators.js';

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Controller('identity')
export class IdentityAdminController {
  constructor(private readonly identity: IdentityAdminService) {}

  @RequirePermissions(IAM_PERMISSIONS.MEMBERSHIPS_READ)
  @Get('memberships')
  list(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.identity.list(context);
  }

  @RequirePermissions(IAM_PERMISSIONS.INVITATIONS_MANAGE)
  @Post('invitations')
  invite(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Body() rawBody: unknown,
  ) {
    const body = bodyRecord(rawBody);
    return this.identity.invite(context, {
      email: body.email,
      grants: body.grants,
    } as CreateInvitationRequest);
  }

  @RequirePermissions(IAM_PERMISSIONS.ROLE_GRANTS_MANAGE)
  @Put('memberships/:id/role-grants')
  replaceRoleGrants(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('id') membershipId: string,
    @Body() rawBody: unknown,
  ) {
    const body = bodyRecord(rawBody);
    return this.identity.replaceRoleGrants(
      context,
      membershipId,
      body.grants,
      body.expectedVersion,
    );
  }

  @RequirePermissions(IAM_PERMISSIONS.MEMBERSHIPS_MANAGE)
  @Post('memberships/:id/deactivate')
  deactivate(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('id') membershipId: string,
  ) {
    return this.identity.setActive(context, membershipId, false);
  }

  @RequirePermissions(IAM_PERMISSIONS.MEMBERSHIPS_MANAGE)
  @Post('memberships/:id/activate')
  activate(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('id') membershipId: string,
  ) {
    return this.identity.setActive(context, membershipId, true);
  }
}
