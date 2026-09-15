import type { AuthenticatedContext } from '@entropix/contracts';
import { Controller, Get } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { StudentPortalService } from './student-portal.service.js';

@Authenticated()
@Controller('me')
export class StudentPortalController {
  constructor(private readonly portal: StudentPortalService) {}

  @Get('student-portal')
  snapshot(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.portal.snapshot(context);
  }

  @Get('registrations')
  registrations(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.portal.registrations(context);
  }

  @Get('timetable')
  timetable(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.portal.timetables(context);
  }

  @Get('result')
  result(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.portal.result(context);
  }

  @Get('documents')
  documents(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.portal.documents(context);
  }
}
