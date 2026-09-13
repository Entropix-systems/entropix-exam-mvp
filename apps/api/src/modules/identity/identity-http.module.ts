import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthApplicationService } from './application/auth.service.js';
import { IdentityAdminService } from './application/identity-admin.service.js';
import { AuthenticationGuard } from './authorization/guards.js';
import { PermissionGuard } from './authorization/guards.js';
import { AuthController } from './http/auth.controller.js';
import { IdentityAdminController } from './http/identity-admin.controller.js';
import {
  ApiEnvelopeInterceptor,
  ApiExceptionFilter,
} from './http/api-envelope.js';
import { CookieMutationGuard } from './http/cookie-mutation.guard.js';
import { IdentityModule } from './identity.module.js';

/** Production HTTP surface backed by IdentityModule's PostgreSQL providers. */
@Module({
  imports: [IdentityModule],
  controllers: [AuthController, IdentityAdminController],
  providers: [
    AuthApplicationService,
    IdentityAdminService,
    AuthenticationGuard,
    PermissionGuard,
    CookieMutationGuard,
    { provide: APP_INTERCEPTOR, useClass: ApiEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class IdentityHttpModule {}
