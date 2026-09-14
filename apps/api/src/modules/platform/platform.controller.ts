import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedContext } from '@entropix/contracts';
import type { Request } from 'express';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { requestIdFor } from '../identity/http/request-context.js';
import { PlatformService } from './platform.service.js';

@Authenticated()
@Controller('platform')
export class PlatformController {
  constructor(private readonly service: PlatformService) {}
  @Get('institutions') list(@CurrentAuthContext() context: AuthenticatedContext) { return this.service.list(context); }
  @Post('institutions') onboard(@CurrentAuthContext() context: AuthenticatedContext, @Body() body: object, @Req() request: Request) {
    return this.service.onboard(context, { ...(body as object), requestId: requestIdFor(request) });
  }
  @Post('institutions/:id/status') status(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: { status?: unknown }, @Req() request: Request) {
    return this.service.setStatus(context, id as `${string}-${string}-${string}-${string}-${string}`, body.status, requestIdFor(request));
  }
}
