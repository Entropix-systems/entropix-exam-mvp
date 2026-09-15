import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { ResultsService } from './results.service.js';

@Authenticated()
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  snapshot(@CurrentAuthContext() context: AuthenticatedContext) { return this.results.snapshot(context); }

  @Get('student/current')
  currentStudent(@CurrentAuthContext() context: AuthenticatedContext) { return this.results.currentStudent(context); }

  @Post('exams/:id/compute')
  compute(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.results.compute(context, id); }

  @Post('exams/:id/withdraw')
  withdraw(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.results.withdraw(context, id, body); }

  @Get('runs/:id')
  readRun(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.results.readRun(context, id); }

  @Post('runs/:id/publish')
  publish(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.results.publish(context, id); }
}
