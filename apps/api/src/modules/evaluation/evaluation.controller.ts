import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { EvaluationService } from './evaluation.service.js';

@Authenticated()
@Controller('evaluation')
export class EvaluationController {
  constructor(private readonly evaluation: EvaluationService) {}

  @Get()
  list(@CurrentAuthContext() context: AuthenticatedContext) { return this.evaluation.list(context); }

  @Put('subjects/:id/assignment')
  assign(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.evaluation.assign(context, id, body); }

  @Put('subjects/:id/marks')
  save(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.evaluation.save(context, id, body); }

  @Post('subjects/:id/submit')
  submit(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.evaluation.submit(context, id, body); }

  @Post('subjects/:id/return')
  returnBatch(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.evaluation.returnBatch(context, id, body); }

  @Post('subjects/:id/approve')
  approve(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.evaluation.approve(context, id, body); }

  @Post('subjects/:id/reopen')
  reopen(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.evaluation.reopen(context, id, body); }
}
