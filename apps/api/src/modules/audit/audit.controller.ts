import type { AuthenticatedContext } from '@entropix/contracts';
import { Controller, Get, Param } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { AuditService } from './audit.service.js';

@Authenticated()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('dashboard')
  dashboard(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.audit.dashboard(context);
  }

  @Get('activity')
  activity(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.audit.activity(context);
  }

  @Get('exports/:kind')
  export(@CurrentAuthContext() context: AuthenticatedContext, @Param('kind') kind: string) {
    return this.audit.export(context, kind);
  }
}
