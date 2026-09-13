import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { SchedulingService } from './scheduling.service.js';

@Authenticated()
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  list(@CurrentAuthContext() context: AuthenticatedContext) { return this.scheduling.list(context); }

  @Post('halls')
  createHall(@CurrentAuthContext() context: AuthenticatedContext, @Body() body: unknown) { return this.scheduling.createHall(context, body); }

  @Post('exams/:id/initialize')
  initialize(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.scheduling.initialize(context, id); }

  @Put('papers/:id/schedule')
  updatePaper(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.scheduling.updatePaper(context, id, body); }

  @Post('papers/:id/allocations/preview')
  preview(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.scheduling.preview(context, id, body); }

  @Post('papers/:id/allocations/commit')
  commit(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.scheduling.commit(context, id, body); }

  @Post('exams/:id/publish')
  publish(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.scheduling.publish(context, id, body); }
}
