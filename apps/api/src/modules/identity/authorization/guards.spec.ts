import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { IAM_PERMISSIONS as P } from '@entropix/contracts';
import type { AuthenticatedContext } from '@entropix/contracts';
import {
  Authenticated,
  PublicRoute,
  RequirePermissions,
} from './decorators.js';
import {
  AuthenticationGuard,
  currentAuthContext,
  PermissionGuard,
} from './guards.js';
import { REQUIRED_PERMISSIONS } from './metadata.js';

const context: AuthenticatedContext = {
  kind: 'TENANT',
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: '11111111-1111-4111-8111-111111111111',
  membershipId: '22222222-2222-4222-8222-222222222222',
  grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }],
};

@RequirePermissions(P.MEMBERSHIPS_READ)
class AdminController {
  @RequirePermissions(P.MEMBERSHIPS_MANAGE)
  manage() {}
  @PublicRoute()
  contradictory() {}
}
class Routes {
  @PublicRoute()
  public() {}
  @Authenticated()
  authenticated() {}
  @RequirePermissions(P.MEMBERSHIPS_READ)
  read() {}
  @SetMetadata(REQUIRED_PERMISSIONS, ['iam.unknown'])
  unknown() {}
}
function execution(
  request: Request,
  handler: () => void = Routes.prototype.read,
  controller: new () => object = Routes,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
const requestWith = (authorization?: string): Request =>
  ({
    headers: { authorization },
    body: { context, tenantId: context.tenantId },
  }) as unknown as Request;

describe('identity guards', () => {
  const reflector = new Reflector();
  it('allows an explicitly public route without resolving authentication', async () => {
    const resolveAccessToken = vi.fn();
    const guard = new AuthenticationGuard(reflector, { resolveAccessToken });
    expect(
      await guard.canActivate(
        execution(requestWith(), Routes.prototype.public),
      ),
    ).toBe(true);
    expect(resolveAccessToken).not.toHaveBeenCalled();
  });
  it('denies missing/malformed authorization and ignores request-provided context', async () => {
    const resolveAccessToken = vi.fn().mockResolvedValue(context);
    const guard = new AuthenticationGuard(reflector, { resolveAccessToken });
    for (const value of [
      undefined,
      '',
      'Basic secret',
      'Bearer',
      'Bearer one two',
    ]) {
      await expect(
        guard.canActivate(execution(requestWith(value))),
      ).rejects.toMatchObject({ status: 401 });
    }
    expect(resolveAccessToken).not.toHaveBeenCalled();
  });
  it('accepts only resolver-verified context and freezes a detached snapshot', async () => {
    const request = requestWith('Bearer test-access-token');
    const resolveAccessToken = vi.fn().mockResolvedValue(context);
    expect(
      await new AuthenticationGuard(reflector, {
        resolveAccessToken,
      }).canActivate(execution(request)),
    ).toBe(true);
    expect(resolveAccessToken).toHaveBeenCalledWith('test-access-token');
    expect(currentAuthContext(request)).toEqual(context);
    expect(currentAuthContext(request)).not.toBe(context);
    expect(Object.isFrozen(currentAuthContext(request))).toBe(true);
  });
  it('fails closed on revoked/invalid authority and resolver failures', async () => {
    for (const result of [
      null,
      { ...context, grants: [{ role: 'UNKNOWN', departmentId: null }] },
    ]) {
      const guard = new AuthenticationGuard(reflector, {
        resolveAccessToken: async () => result as AuthenticatedContext,
      });
      await expect(
        guard.canActivate(execution(requestWith('Bearer test'))),
      ).rejects.toMatchObject({ status: 401 });
    }
    const guard = new AuthenticationGuard(reflector, {
      resolveAccessToken: async () => {
        throw new Error('private database detail');
      },
    });
    await expect(
      guard.canActivate(execution(requestWith('Bearer test'))),
    ).rejects.toThrow('Authentication required');
  });
  it('re-resolves on each request and clears prior authority after revocation', async () => {
    const resolveAccessToken = vi
      .fn()
      .mockResolvedValueOnce(context)
      .mockResolvedValueOnce(null);
    const guard = new AuthenticationGuard(reflector, { resolveAccessToken });
    const request = requestWith('Bearer test');
    await guard.canActivate(execution(request));
    await expect(guard.canActivate(execution(request))).rejects.toMatchObject({
      status: 401,
    });
    expect(() => currentAuthContext(request)).toThrow(
      'Authentication required',
    );
    expect(resolveAccessToken).toHaveBeenCalledTimes(2);
  });
  it('requires authentication before permission checking', async () => {
    const guard = new PermissionGuard(reflector, {
      resolve: async () => ({
        kind: 'TENANT',
        tenantId: context.tenantId,
        departmentId: null,
      }),
    });
    await expect(
      guard.canActivate(execution(requestWith('Bearer test'))),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('uses server-resolved resource scope, denying foreign tenant IDs', async () => {
    const request = requestWith('Bearer test');
    await new AuthenticationGuard(reflector, {
      resolveAccessToken: async () => context,
    }).canActivate(execution(request));
    const valid = new PermissionGuard(reflector, {
      resolve: async () => ({
        kind: 'TENANT',
        tenantId: context.tenantId,
        departmentId: null,
      }),
    });
    expect(await valid.canActivate(execution(request))).toBe(true);
    const foreign = new PermissionGuard(reflector, {
      resolve: async () => ({
        kind: 'TENANT',
        tenantId: '33333333-3333-4333-8333-333333333333',
        departmentId: null,
      }),
    });
    await expect(foreign.canActivate(execution(request))).rejects.toMatchObject(
      { status: 403 },
    );
  });
  it('denies missing resource scope, missing permission metadata, and unknown permission', async () => {
    const request = requestWith('Bearer test');
    await new AuthenticationGuard(reflector, {
      resolveAccessToken: async () => context,
    }).canActivate(execution(request));
    const missing = new PermissionGuard(reflector, {
      resolve: async () => null,
    });
    await expect(missing.canActivate(execution(request))).rejects.toMatchObject(
      { status: 403 },
    );
    const valid = new PermissionGuard(reflector, {
      resolve: async () => ({
        kind: 'TENANT',
        tenantId: context.tenantId,
        departmentId: null,
      }),
    });
    await expect(
      valid.canActivate(execution(request, Routes.prototype.authenticated)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      valid.canActivate(execution(request, Routes.prototype.unknown)),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('requires both class and method permissions; public metadata cannot bypass required permissions', async () => {
    const request = requestWith('Bearer test');
    const exec = execution(
      request,
      AdminController.prototype.manage,
      AdminController,
    );
    await new AuthenticationGuard(reflector, {
      resolveAccessToken: async () => context,
    }).canActivate(exec);
    const resolve = vi.fn().mockResolvedValue({
      kind: 'TENANT',
      tenantId: context.tenantId,
      departmentId: null,
    });
    await new PermissionGuard(reflector, { resolve }).canActivate(exec);
    expect(resolve.mock.calls.map((call) => call[0]).sort()).toEqual(
      [P.MEMBERSHIPS_MANAGE, P.MEMBERSHIPS_READ].sort(),
    );
    const guard = new AuthenticationGuard(reflector, {
      resolveAccessToken: async () => context,
    });
    await expect(
      guard.canActivate(
        execution(
          requestWith(),
          AdminController.prototype.contradictory,
          AdminController,
        ),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
