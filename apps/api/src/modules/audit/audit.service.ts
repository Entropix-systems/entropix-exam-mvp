import type { AuthenticatedContext, TenantRole, UUID } from '@entropix/contracts';
import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AuditRepository, availableReports } from './audit.repository.js';
import { REPORT_KINDS, type ReportKind, type ReportingActor } from './audit.types.js';

function tenantActor(context: AuthenticatedContext): { tenantId: UUID; actor: ReportingActor } {
  if (context.kind !== 'TENANT' || context.activeRole === 'STUDENT') throw new ForbiddenException('Permission denied');
  const departmentIds = context.activeRole === 'DEPARTMENT_ADMIN'
    ? context.grants.filter((grant) => grant.role === 'DEPARTMENT_ADMIN' && grant.departmentId).map((grant) => grant.departmentId as UUID)
    : [];
  return {
    tenantId: context.tenantId,
    actor: { membershipId: context.membershipId, role: context.activeRole as TenantRole, departmentIds },
  };
}

function reportKind(value: string): ReportKind {
  if (!(REPORT_KINDS as readonly string[]).includes(value)) throw new UnprocessableEntityException('Report kind is invalid');
  return value as ReportKind;
}

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  dashboard(context: AuthenticatedContext) {
    const { tenantId, actor } = tenantActor(context);
    return this.repository.dashboard(tenantId, actor);
  }

  activity(context: AuthenticatedContext) {
    const { tenantId, actor } = tenantActor(context);
    if (!['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'AUDITOR'].includes(actor.role)) throw new ForbiddenException('Audit activity is available only to controllers and auditors');
    return this.repository.activity(tenantId);
  }

  export(context: AuthenticatedContext, rawKind: string) {
    const { tenantId, actor } = tenantActor(context);
    const kind = reportKind(rawKind);
    if (!availableReports(actor).includes(kind)) throw new ForbiddenException('This report is outside the active role scope');
    return this.repository.export(tenantId, actor, kind);
  }
}
