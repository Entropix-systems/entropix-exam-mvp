import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { AuthApplicationService } from '../application/auth.service.js';
import { AuthApplicationError } from '../application/auth.errors.js';
import {
  AuthenticatedContextResolver,
  type AuthenticatedPrincipal,
} from '../identity.repository.js';
import { AuthenticationGuard } from '../authorization/guards.js';
import { AuthController, RefreshCookieConfigurationProvider } from './auth.controller.js';
import { ApiEnvelopeInterceptor, ApiExceptionFilter } from './api-envelope.js';
import {
  CookieMutationGuard,
  CookieMutationSecurityConfiguration,
} from './cookie-mutation.guard.js';

const principal: AuthenticatedPrincipal = {
  identity: {
    kind: 'TENANT',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    tenantId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
  },
  context: {
    kind: 'TENANT',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    activeRole: 'STUDENT',
    grants: [{ role: 'STUDENT', departmentId: null }],
  },
};

describe('auth HTTP surface', () => {
  let app: INestApplication;
  const auth = {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    acceptInvitation: vi.fn(),
    switchContext: vi.fn(),
    me: vi.fn(),
  };
  const contextResolver = { resolveAccessToken: vi.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthenticationGuard,
        CookieMutationGuard,
        { provide: AuthApplicationService, useValue: auth },
        {
          provide: AuthenticatedContextResolver,
          useValue: contextResolver,
        },
        {
          provide: RefreshCookieConfigurationProvider,
          useValue: { value: { environment: 'test' } },
        },
        {
          provide: CookieMutationSecurityConfiguration,
          useValue: {
            allowedOrigins: new Set(['https://app.example.test']),
          },
        },
        { provide: APP_INTERCEPTOR, useClass: ApiEnvelopeInterceptor },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => app.close());

  it('returns login envelope and secure refresh cookie without the raw token in JSON', async () => {
    auth.login.mockResolvedValueOnce({
      accessToken: 'access-token',
      expiresInSeconds: 900,
      refreshToken: 'R'.repeat(43),
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-request-id', 'request-login-1')
      .send({
        email: 'student@example.test',
        password: 'correct password',
      })
      .expect(201);
    expect(response.body).toEqual({
      data: { accessToken: 'access-token', expiresInSeconds: 900 },
      requestId: 'request-login-1',
    });
    expect(response.headers['set-cookie'][0]).toContain(
      `__Host-iam-refresh=${'R'.repeat(43)}`,
    );
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Secure');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie'][0]).toContain('Path=/');
    expect(JSON.stringify(response.body)).not.toContain('R'.repeat(43));
    expect(auth.login).toHaveBeenLastCalledWith({
      email: 'student@example.test',
      password: 'correct password',
    });
  });

  it('switches context only for an authenticated session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/context')
      .send({
        institutionId: '11111111-1111-4111-8111-111111111111',
        role: 'AUDITOR',
      })
      .expect(401);
    contextResolver.resolveAccessToken.mockResolvedValueOnce(principal);
    auth.switchContext.mockResolvedValueOnce({
      accessToken: 'switched-access-token',
      expiresInSeconds: 900,
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/context')
      .set('Authorization', 'Bearer access-token')
      .send({
        institutionId: '11111111-1111-4111-8111-111111111111',
        role: 'AUDITOR',
      })
      .expect(201);
    expect(auth.switchContext).toHaveBeenCalledWith(principal, {
      institutionId: '11111111-1111-4111-8111-111111111111',
      role: 'AUDITOR',
    });
    expect(response.body.data).toEqual({
      accessToken: 'switched-access-token',
      expiresInSeconds: 900,
    });
  });

  it('uses the shared safe error envelope without internal error details', async () => {
    auth.login.mockRejectedValueOnce(
      new AuthApplicationError('UNAUTHENTICATED', 'Invalid credentials'),
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.test', password: 'wrong password' })
      .expect(401);
    expect(response.body).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Invalid credentials',
      fieldErrors: [],
    });
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(response.body)).not.toMatch(/Prisma|SQL|database detail/i);
  });

  it('enforces exact allowed Origin plus a non-simple CSRF header for refresh', async () => {
    auth.refresh.mockResolvedValue({
      accessToken: 'rotated-access',
      expiresInSeconds: 900,
      refreshToken: 'S'.repeat(43),
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `__Host-iam-refresh=${'R'.repeat(43)}`)
      .set('Origin', 'https://evil.example.test')
      .set('x-csrf-protection', '1')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `__Host-iam-refresh=${'R'.repeat(43)}`)
      .set('Origin', 'https://app.example.test')
      .expect(403);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `__Host-iam-refresh=${'R'.repeat(43)}`)
      .set('Origin', 'https://app.example.test')
      .set('x-csrf-protection', '1')
      .expect(201);
    expect(auth.refresh).toHaveBeenLastCalledWith('R'.repeat(43));
    expect(response.body.data.accessToken).toBe('rotated-access');
  });

  it('clears the refresh cookie after refresh failure', async () => {
    auth.refresh.mockRejectedValueOnce(
      new AuthApplicationError('UNAUTHENTICATED', 'Session is not valid'),
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `__Host-iam-refresh=${'R'.repeat(43)}`)
      .set('Origin', 'https://app.example.test')
      .set('x-csrf-protection', '1')
      .expect(401);
    expect(response.headers['set-cookie'][0]).toContain(
      '__Host-iam-refresh=;',
    );
    expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('requires cookie-mutation defenses and clears the cookie on logout', async () => {
    contextResolver.resolveAccessToken.mockResolvedValue(principal);
    auth.logout.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .set('Origin', 'https://evil.example.test')
      .set('x-csrf-protection', '1')
      .expect(403);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .set('Origin', 'https://app.example.test')
      .set('x-csrf-protection', '1')
      .expect(201);
    expect(auth.logout).toHaveBeenCalledWith(principal);
    expect(response.body.data).toEqual({ loggedOut: true });
    expect(response.headers['set-cookie'][0]).toContain(
      '__Host-iam-refresh=;',
    );
  });

  it('/auth/me requires server-resolved current authority', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    contextResolver.resolveAccessToken.mockResolvedValueOnce(principal);
    auth.me.mockReturnValueOnce({
      context: principal.context,
      sessionId: principal.identity.sessionId,
      email: 'student@example.test',
      institutions: [{
        id: principal.context.kind === 'TENANT' ? principal.context.tenantId : '',
        name: 'Northstar College',
        slug: 'northstar-college',
      }],
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer access-token')
      .expect(200);
    expect(response.body.data).toEqual({
      context: principal.context,
      sessionId: principal.identity.sessionId,
      email: 'student@example.test',
      institutions: [{
        id: principal.context.kind === 'TENANT' ? principal.context.tenantId : '',
        name: 'Northstar College',
        slug: 'northstar-college',
      }],
    });
  });

  it('wires the remaining public Day-1 commands through envelopes', async () => {
    auth.forgotPassword.mockResolvedValueOnce({ accepted: true });
    auth.resetPassword.mockResolvedValueOnce({ reset: true });
    auth.acceptInvitation.mockResolvedValueOnce({ accepted: true });
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'anyone@example.test' })
      .expect(201)
      .expect((response) => expect(response.body.data).toEqual({ accepted: true }));
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'T'.repeat(43), password: 'new secure password' })
      .expect(201)
      .expect((response) => expect(response.body.data).toEqual({ reset: true }));
    await request(app.getHttpServer())
      .post('/api/v1/auth/invitations/accept')
      .send({ token: 'T'.repeat(43), password: 'first secure password' })
      .expect(201)
      .expect((response) => expect(response.body.data).toEqual({ accepted: true }));
  });
});
