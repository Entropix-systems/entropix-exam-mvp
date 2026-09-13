import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { ExamsService } from './exams.service.js';

@Authenticated()
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}
  @Get() list(@CurrentAuthContext() context: AuthenticatedContext) { return this.exams.list(context); }
  @Post() create(@CurrentAuthContext() context: AuthenticatedContext, @Body() body: unknown) { return this.exams.create(context, body); }
  @Post(':id/open-registration') open(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.exams.open(context, id); }
  @Post(':id/close-registration') close(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.exams.close(context, id); }
  @Post(':id/auto-enrol') autoEnrol(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.exams.autoEnrol(context, id); }
  @Put(':id/my-registration') saveDraft(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.exams.saveDraft(context, id, body); }
  @Post('registrations/:id/submit') submit(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.exams.submit(context, id); }
  @Post('registrations/:id/approve') approve(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.exams.approve(context, id, body); }
  @Post('registrations/:id/reject') reject(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.exams.reject(context, id, body); }
  @Post('registrations/:id/cancel') cancel(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.exams.cancel(context, id, body); }
  @Post('registrations/:id/eligibility') eligibility(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.exams.setEligibility(context, id, body); }
}
