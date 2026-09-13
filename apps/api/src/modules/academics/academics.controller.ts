import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  Authenticated,
  CurrentAuthContext,
} from '../identity/authorization/decorators.js';
import { AcademicsService } from './academics.service.js';

@Authenticated()
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academics: AcademicsService) {}

  @Get()
  list(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.academics.list(context);
  }

  @Get(':resource/:id')
  get(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return this.academics.get(context, resource, id);
  }

  @Post(':resource')
  create(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('resource') resource: string,
    @Body() body: unknown,
  ) {
    return this.academics.create(context, resource, body);
  }

  @Put(':resource/:id')
  update(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.academics.update(context, resource, id, body);
  }
}
