import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthApplicationService } from './application/auth.service.js';
import { AuthenticationGuard } from './authorization/guards.js';
import { AuthController } from './http/auth.controller.js';
import { ApiEnvelopeInterceptor, ApiExceptionFilter } from './http/api-envelope.js';
import { CookieMutationGuard } from './http/cookie-mutation.guard.js';

/**
 * Phase 3 imports this module only after supplying real workflow/context,
 * notification, crypto, cookie, origin and service configuration providers.
 * It is intentionally absent from AppModule so the application never pretends
 * IAM persistence exists.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthApplicationService,
    AuthenticationGuard,
    CookieMutationGuard,
    { provide: APP_INTERCEPTOR, useClass: ApiEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class IdentityHttpModule {}

