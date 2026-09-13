import {
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export abstract class CookieMutationSecurityConfiguration {
  abstract readonly allowedOrigins: ReadonlySet<string>;
}

@Injectable()
export class CookieMutationGuard implements CanActivate {
  constructor(
    @Inject(CookieMutationSecurityConfiguration)
    private readonly configuration: CookieMutationSecurityConfiguration,
  ) {}

  canActivate(execution: ExecutionContext): boolean {
    const request = execution.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    const csrf = request.headers['x-csrf-protection'];
    if (
      typeof origin !== 'string' ||
      !this.configuration.allowedOrigins.has(origin) ||
      csrf !== '1'
    )
      throw new ForbiddenException('Request origin is not allowed');
    return true;
  }
}

