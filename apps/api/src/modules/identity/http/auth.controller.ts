import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  AcceptInvitationRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  SwitchAuthContextRequest,
} from '@entropix/contracts';
import { AuthApplicationService } from '../application/auth.service.js';
import type { AuthenticatedPrincipal } from '../identity.repository.js';
import {
  Authenticated,
  CurrentAuthPrincipal,
  PublicRoute,
} from '../authorization/decorators.js';
import { refreshCookiePolicy } from '../security/cookie-policy.js';
import type { RefreshCookieConfiguration } from '../security/cookie-policy.js';
import { AuthApplicationError } from '../application/auth.errors.js';
import { CookieMutationGuard } from './cookie-mutation.guard.js';
import { requestIdFor } from './request-context.js';

export abstract class RefreshCookieConfigurationProvider {
  abstract readonly value: RefreshCookieConfiguration;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.cookie;
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AuthApplicationError('VALIDATION', 'Request body is invalid');
  return value as Record<string, unknown>;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthApplicationService,
    @Inject(RefreshCookieConfigurationProvider)
    private readonly cookieConfiguration: RefreshCookieConfigurationProvider,
  ) {}

  @PublicRoute()
  @Post('login')
  async login(
    @Body() rawBody: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = objectBody(rawBody);
    const issued = await this.auth.login({
      email: body.email,
      password: body.password,
    } as LoginRequest);
    this.setRefreshCookie(response, issued.refreshToken);
    const { refreshToken: _secret, ...publicResult } = issued;
    return publicResult;
  }

  @PublicRoute()
  @UseGuards(CookieMutationGuard)
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookie = refreshCookiePolicy(this.cookieConfiguration.value);
    const rawToken = cookieValue(request, cookie.name);
    if (!rawToken) {
      response.clearCookie(cookie.name, cookie.clearOptions);
      throw new AuthApplicationError('UNAUTHENTICATED', 'Session is not valid');
    }
    try {
      const issued = await this.auth.refresh(rawToken);
      this.setRefreshCookie(response, issued.refreshToken);
      const { refreshToken: _secret, ...publicResult } = issued;
      return publicResult;
    } catch (error) {
      response.clearCookie(cookie.name, cookie.clearOptions);
      throw error;
    }
  }

  @Authenticated()
  @UseGuards(CookieMutationGuard)
  @Post('logout')
  async logout(
    @CurrentAuthPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookie = refreshCookiePolicy(this.cookieConfiguration.value);
    try {
      await this.auth.logout(principal);
      return { loggedOut: true as const };
    } finally {
      response.clearCookie(cookie.name, cookie.clearOptions);
    }
  }

  @PublicRoute()
  @Post('forgot-password')
  forgotPassword(@Body() rawBody: unknown) {
    const body = objectBody(rawBody);
    return this.auth.forgotPassword({ email: body.email } as ForgotPasswordRequest);
  }

  @PublicRoute()
  @Post('reset-password')
  resetPassword(@Body() rawBody: unknown) {
    const body = objectBody(rawBody);
    return this.auth.resetPassword({
      token: body.token,
      password: body.password,
    } as ResetPasswordRequest);
  }

  @PublicRoute()
  @Post('invitations/accept')
  acceptInvitation(@Body() rawBody: unknown) {
    const body = objectBody(rawBody);
    return this.auth.acceptInvitation({
      token: body.token,
      password: body.password,
    } as AcceptInvitationRequest);
  }

  @Authenticated()
  @Post('context')
  switchContext(
    @CurrentAuthPrincipal() principal: AuthenticatedPrincipal,
    @Body() rawBody: unknown,
    @Req() request: Request,
  ) {
    const body = objectBody(rawBody);
    return this.auth.switchContext(principal, {
      institutionId: body.institutionId,
      role: body.role,
      returnToPlatform: body.returnToPlatform,
      requestId: requestIdFor(request),
    } as SwitchAuthContextRequest);
  }

  @Authenticated()
  @Get('me')
  me(@CurrentAuthPrincipal() principal: AuthenticatedPrincipal) {
    return this.auth.me(principal);
  }

  private setRefreshCookie(response: Response, rawToken: string): void {
    const cookie = refreshCookiePolicy(this.cookieConfiguration.value);
    response.cookie(cookie.name, rawToken, cookie.options);
  }
}
