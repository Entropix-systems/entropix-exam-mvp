import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type {
  AuthenticatedContext,
  PermissionScope,
} from '@entropix/contracts';
import { hasPermission, isAuthenticatedContext } from '@entropix/domain';
import {
  AuthenticatedContextResolver,
  type AuthenticatedPrincipal,
} from '../identity.repository.js';
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from './metadata.js';

// Not a public request field: body/header/context lookalikes cannot supply authority.
const resolvedContexts = new WeakMap<object, AuthenticatedContext>();
const resolvedPrincipals = new WeakMap<object, AuthenticatedPrincipal>();
export function currentAuthContext(request: object): AuthenticatedContext {
  const context = resolvedContexts.get(request);
  if (!context) throw new UnauthorizedException('Authentication required');
  return context;
}
export function currentAuthPrincipal(request: object): AuthenticatedPrincipal {
  const principal = resolvedPrincipals.get(request);
  if (!principal) throw new UnauthorizedException('Authentication required');
  return principal;
}

/** Resolve target ownership/department from server data; never trust body scope. */
export abstract class PermissionScopeResolver {
  abstract resolve(
    permission: string,
    request: Request,
    context: AuthenticatedContext,
  ): Promise<PermissionScope | null>;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthenticatedContextResolver)
    private readonly resolver: AuthenticatedContextResolver,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<Request>();
    resolvedContexts.delete(request);
    resolvedPrincipals.delete(request);
    const targets = [execution.getHandler(), execution.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ROUTE,
      targets,
    );
    const required =
      this.reflector.getAllAndMerge<readonly string[]>(
        REQUIRED_PERMISSIONS,
        targets,
      ) ?? [];
    if (isPublic && required.length === 0) return true;
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer ([^\s]+)$/i.exec(header) : null;
    if (!match) throw new UnauthorizedException('Authentication required');
    let principal: AuthenticatedPrincipal | null;
    try {
      principal = await this.resolver.resolveAccessToken(match[1]);
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
    if (
      !principal ||
      !isAuthenticatedContext(principal.context) ||
      principal.identity.userId.toLowerCase() !==
        principal.context.userId.toLowerCase() ||
      (principal.identity.kind === 'TENANT') !==
        (principal.context.kind === 'TENANT') ||
      (principal.identity.kind === 'TENANT' &&
        principal.context.kind === 'TENANT' &&
        (principal.identity.tenantId.toLowerCase() !==
          principal.context.tenantId.toLowerCase() ||
          principal.identity.membershipId.toLowerCase() !==
            principal.context.membershipId.toLowerCase()))
    )
      throw new UnauthorizedException('Authentication required');
    // Detach from mutable repository objects; downstream code receives readonly data.
    const snapshot =
      principal.context.kind === 'TENANT'
        ? Object.freeze({
            ...principal.context,
            grants: Object.freeze(
              principal.context.grants.map((grant) => Object.freeze({ ...grant })),
            ),
          })
        : Object.freeze({ ...principal.context });
    const principalSnapshot = Object.freeze({
      identity: Object.freeze({ ...principal.identity }),
      context: snapshot,
    });
    resolvedContexts.set(request, snapshot);
    resolvedPrincipals.set(request, principalSnapshot);
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionScopeResolver)
    private readonly scopes: PermissionScopeResolver,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<Request>();
    const context = currentAuthContext(request);
    const required =
      this.reflector.getAllAndMerge<readonly string[]>(REQUIRED_PERMISSIONS, [
        execution.getHandler(),
        execution.getClass(),
      ]) ?? [];
    if (required.length === 0)
      throw new ForbiddenException('Permission required');
    for (const permission of required) {
      const scope = await this.scopes.resolve(permission, request, context);
      if (!scope || !hasPermission(context, permission, scope))
        throw new ForbiddenException('Permission denied');
    }
    return true;
  }
}
