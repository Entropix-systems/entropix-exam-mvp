import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { ConductService } from './conduct.service.js';

@Authenticated()
@Controller('conduct')
export class ConductController {
  constructor(private readonly conduct: ConductService) {}

  @Get()
  list(@CurrentAuthContext() context: AuthenticatedContext) { return this.conduct.list(context); }

  @Post('sittings/:id/duties')
  assign(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.assign(context, id, body); }

  @Post('duties/:id/accept')
  accept(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.conduct.accept(context, id); }

  @Post('duties/:id/decline')
  decline(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.decline(context, id, body); }

  @Put('sittings/:id/attendance')
  saveAttendance(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.saveAttendance(context, id, body); }

  @Post('sittings/:id/attendance/submit')
  submitAttendance(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.submitAttendance(context, id, body); }

  @Post('sittings/:id/attendance/reopen')
  reopenAttendance(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.reopenAttendance(context, id, body); }

  @Post('sittings/:id/incidents')
  createIncident(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.createIncident(context, id, body); }

  @Post('incidents/:id/disposition')
  disposeIncident(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string, @Body() body: unknown) { return this.conduct.disposeIncident(context, id, body); }

  @Get('exams/:id/result-state')
  resultState(@CurrentAuthContext() context: AuthenticatedContext, @Param('id') id: string) { return this.conduct.resultState(context, id); }
}
