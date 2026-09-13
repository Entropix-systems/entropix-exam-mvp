import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { IamPermission } from '@entropix/contracts';
import {
  AuthenticationGuard,
  currentAuthContext,
  PermissionGuard,
} from './guards.js';
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from './metadata.js';

export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE, true);
export const Authenticated = () =>
  applyDecorators(
    SetMetadata(PUBLIC_ROUTE, false),
    UseGuards(AuthenticationGuard),
  );
export const RequirePermissions = (
  ...permissions: [IamPermission, ...IamPermission[]]
) =>
  applyDecorators(
    SetMetadata(PUBLIC_ROUTE, false),
    SetMetadata(REQUIRED_PERMISSIONS, permissions),
    UseGuards(AuthenticationGuard, PermissionGuard),
  );
export const CurrentAuthContext = createParamDecorator(
  (_data: unknown, execution: ExecutionContext) =>
    currentAuthContext(execution.switchToHttp().getRequest<object>()),
);
