import { TextEncoder } from 'node:util';
import { createPrismaClient, PrismaClient } from '@entropix/db';
import { createEmailSenderFromEnv } from '@entropix/notifications';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import {
  AUTH_CLOCK,
  AUTH_SERVICE_CONFIGURATION,
} from './application/auth.service.js';
import { IDENTITY_ADMIN_CONFIGURATION } from './application/identity-admin.service.js';
import {
  EMAIL_SENDER,
  EmailIdentityNotificationSender,
  IdentityNotificationSender,
} from './application/identity-notifications.js';
import { IdentityPermissionScopeResolver } from './authorization/identity-permission-scope.resolver.js';
import { PermissionScopeResolver } from './authorization/guards.js';
import { RefreshCookieConfigurationProvider } from './http/auth.controller.js';
import { CookieMutationSecurityConfiguration } from './http/cookie-mutation.guard.js';
import {
  AuthenticatedContextResolver,
  CurrentAuthorityRepository,
  IdentityAdminRepository,
  IdentityWorkflowRepository,
} from './identity.repository.js';
import { PersistentAuthenticatedContextResolver } from './persistence/persistent-context.resolver.js';
import {
  PrismaCurrentAuthorityRepository,
  PrismaIdentityRepository,
} from './persistence/prisma-identity.repository.js';
import {
  AccessTokenCodec,
  JoseAccessTokenCodec,
} from './security/access-token.js';
import {
  Argon2PasswordHasher,
  PasswordHasher,
} from './security/password-hasher.js';
import { tokenPolicyFromEnv } from './security/token-policy.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Missing required identity configuration: ${name}`);
  return value;
}

function webUrl(path: string): string {
  return new URL(
    path,
    `${required('WEB_ORIGIN').replace(/\/$/, '')}/`,
  ).toString();
}

@Injectable()
class IdentityDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () =>
        createPrismaClient(required('DATABASE_URL'), {
          sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
        }),
    },
    IdentityDatabaseLifecycle,
    PrismaIdentityRepository,
    PrismaCurrentAuthorityRepository,
    {
      provide: IdentityWorkflowRepository,
      useExisting: PrismaIdentityRepository,
    },
    { provide: IdentityAdminRepository, useExisting: PrismaIdentityRepository },
    {
      provide: CurrentAuthorityRepository,
      useExisting: PrismaCurrentAuthorityRepository,
    },
    { provide: AUTH_CLOCK, useValue: () => new Date() },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    {
      provide: AccessTokenCodec,
      inject: [AUTH_CLOCK],
      useFactory: (clock: () => Date) => {
        const secret = new TextEncoder().encode(
          required('ACCESS_TOKEN_SECRET'),
        );
        return new JoseAccessTokenCodec(
          {
            algorithm: 'HS256',
            issuer: process.env.ACCESS_TOKEN_ISSUER || 'entropix-exam-api',
            audience: process.env.ACCESS_TOKEN_AUDIENCE || 'entropix-exam-web',
            secret,
            ttlSeconds: tokenPolicyFromEnv(process.env).accessTtlSeconds,
          },
          clock,
        );
      },
    },
    {
      provide: EMAIL_SENDER,
      useFactory: () => createEmailSenderFromEnv(process.env),
    },
    EmailIdentityNotificationSender,
    {
      provide: IdentityNotificationSender,
      useExisting: EmailIdentityNotificationSender,
    },
    {
      provide: AUTH_SERVICE_CONFIGURATION,
      inject: [PasswordHasher],
      useFactory: async (passwords: PasswordHasher) => ({
        tokenPolicy: tokenPolicyFromEnv(process.env),
        passwordResetUrl:
          process.env.PASSWORD_RESET_URL || webUrl('/reset-password'),
        dummyPasswordHash: await passwords.hash(
          'identity-timing-equalizer-not-a-user-password',
        ),
      }),
    },
    {
      provide: IDENTITY_ADMIN_CONFIGURATION,
      useFactory: () => ({
        tokenPolicy: tokenPolicyFromEnv(process.env),
        invitationUrl:
          process.env.INVITATION_ACCEPT_URL || webUrl('/accept-invitation'),
      }),
    },
    {
      provide: RefreshCookieConfigurationProvider,
      useFactory: () => {
        const environment =
          process.env.NODE_ENV === 'production'
            ? 'production'
            : process.env.NODE_ENV === 'test'
              ? 'test'
              : 'development';
        return {
          value: {
            environment,
            localDevelopment: environment === 'development',
            refreshTtlSeconds: tokenPolicyFromEnv(process.env)
              .refreshTtlSeconds,
          },
        };
      },
    },
    {
      provide: CookieMutationSecurityConfiguration,
      useFactory: () => ({
        allowedOrigins: new Set(
          required('WEB_ORIGIN')
            .split(',')
            .map((origin) => new URL(origin.trim()).origin),
        ),
      }),
    },
    {
      provide: PermissionScopeResolver,
      useClass: IdentityPermissionScopeResolver,
    },
    {
      provide: AuthenticatedContextResolver,
      useClass: PersistentAuthenticatedContextResolver,
    },
  ],
  exports: [
    IdentityWorkflowRepository,
    IdentityAdminRepository,
    AuthenticatedContextResolver,
    PermissionScopeResolver,
    PasswordHasher,
    AccessTokenCodec,
    IdentityNotificationSender,
    AUTH_SERVICE_CONFIGURATION,
    IDENTITY_ADMIN_CONFIGURATION,
    AUTH_CLOCK,
    RefreshCookieConfigurationProvider,
    CookieMutationSecurityConfiguration,
  ],
})
export class IdentityModule {}
