import type { TenantRole, UUID } from '@entropix/contracts';
import { Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { from, mergeMap } from 'rxjs';
import { currentAuthContext } from '../identity/authorization/guards.js';
import { requestIdFor } from '../identity/http/request-context.js';
import { AuditRepository } from './audit.repository.js';

interface CommandAudit {
  action: string;
  targetType: string;
}

const commands: readonly { method: string; pattern: RegExp; audit: CommandAudit }[] = [
  { method: 'POST', pattern: /^\/academics\//, audit: { action: 'ACADEMIC_RECORD_CREATED', targetType: 'ACADEMIC_RECORD' } },
  { method: 'PUT', pattern: /^\/academics\//, audit: { action: 'ACADEMIC_RECORD_UPDATED', targetType: 'ACADEMIC_RECORD' } },
  { method: 'POST', pattern: /^\/people\/student-imports\/commit$/, audit: { action: 'STUDENT_IMPORT_COMMITTED', targetType: 'STUDENT_IMPORT' } },
  { method: 'POST', pattern: /^\/exams$/, audit: { action: 'EXAM_CREATED', targetType: 'EXAM' } },
  { method: 'POST', pattern: /^\/exams\/[^/]+\/open-registration$/, audit: { action: 'REGISTRATION_OPENED', targetType: 'EXAM' } },
  { method: 'POST', pattern: /^\/exams\/[^/]+\/close-registration$/, audit: { action: 'REGISTRATION_CLOSED', targetType: 'EXAM' } },
  { method: 'POST', pattern: /^\/exams\/[^/]+\/auto-enrol$/, audit: { action: 'STUDENTS_AUTO_ENROLLED', targetType: 'EXAM' } },
  { method: 'PUT', pattern: /^\/exams\/[^/]+\/my-registration$/, audit: { action: 'REGISTRATION_DRAFT_SAVED', targetType: 'REGISTRATION' } },
  { method: 'POST', pattern: /^\/exams\/registrations\/[^/]+\/submit$/, audit: { action: 'REGISTRATION_SUBMITTED', targetType: 'REGISTRATION' } },
  { method: 'POST', pattern: /^\/exams\/registrations\/[^/]+\/approve$/, audit: { action: 'REGISTRATION_APPROVED', targetType: 'REGISTRATION' } },
  { method: 'POST', pattern: /^\/exams\/registrations\/[^/]+\/reject$/, audit: { action: 'REGISTRATION_REJECTED', targetType: 'REGISTRATION' } },
  { method: 'POST', pattern: /^\/exams\/registrations\/[^/]+\/cancel$/, audit: { action: 'REGISTRATION_CANCELLED', targetType: 'REGISTRATION' } },
  { method: 'POST', pattern: /^\/exams\/registrations\/[^/]+\/eligibility$/, audit: { action: 'REGISTRATION_ELIGIBILITY_UPDATED', targetType: 'REGISTRATION' } },
  { method: 'POST', pattern: /^\/scheduling\/halls$/, audit: { action: 'HALL_CREATED', targetType: 'HALL' } },
  { method: 'POST', pattern: /^\/scheduling\/exams\/[^/]+\/initialize$/, audit: { action: 'EXAM_SCHEDULE_INITIALIZED', targetType: 'EXAM' } },
  { method: 'PUT', pattern: /^\/scheduling\/papers\/[^/]+\/schedule$/, audit: { action: 'PAPER_SCHEDULE_UPDATED', targetType: 'EXAM_PAPER' } },
  { method: 'POST', pattern: /^\/scheduling\/papers\/[^/]+\/allocations\/commit$/, audit: { action: 'HALL_ALLOCATION_COMMITTED', targetType: 'EXAM_PAPER' } },
  { method: 'POST', pattern: /^\/scheduling\/exams\/[^/]+\/publish$/, audit: { action: 'TIMETABLE_PUBLISHED', targetType: 'EXAM' } },
  { method: 'POST', pattern: /^\/conduct\/sittings\/[^/]+\/duties$/, audit: { action: 'INVIGILATOR_DUTY_ASSIGNED', targetType: 'DUTY' } },
  { method: 'POST', pattern: /^\/conduct\/duties\/[^/]+\/accept$/, audit: { action: 'INVIGILATOR_DUTY_ACCEPTED', targetType: 'DUTY' } },
  { method: 'POST', pattern: /^\/conduct\/duties\/[^/]+\/decline$/, audit: { action: 'INVIGILATOR_DUTY_DECLINED', targetType: 'DUTY' } },
  { method: 'PUT', pattern: /^\/conduct\/sittings\/[^/]+\/attendance$/, audit: { action: 'ATTENDANCE_SAVED', targetType: 'ATTENDANCE_BATCH' } },
  { method: 'POST', pattern: /^\/conduct\/sittings\/[^/]+\/attendance\/submit$/, audit: { action: 'ATTENDANCE_SUBMITTED', targetType: 'ATTENDANCE_BATCH' } },
  { method: 'POST', pattern: /^\/conduct\/sittings\/[^/]+\/attendance\/reopen$/, audit: { action: 'ATTENDANCE_REOPENED', targetType: 'ATTENDANCE_BATCH' } },
  { method: 'POST', pattern: /^\/conduct\/sittings\/[^/]+\/incidents$/, audit: { action: 'INCIDENT_REPORTED', targetType: 'INCIDENT' } },
  { method: 'POST', pattern: /^\/conduct\/incidents\/[^/]+\/disposition$/, audit: { action: 'INCIDENT_DISPOSED', targetType: 'INCIDENT' } },
  { method: 'PUT', pattern: /^\/evaluation\/subjects\/[^/]+\/assignment$/, audit: { action: 'EXAMINER_ASSIGNED', targetType: 'EXAM_SUBJECT' } },
  { method: 'PUT', pattern: /^\/evaluation\/subjects\/[^/]+\/marks$/, audit: { action: 'MARKS_SAVED', targetType: 'EXAM_SUBJECT' } },
  { method: 'POST', pattern: /^\/evaluation\/subjects\/[^/]+\/submit$/, audit: { action: 'MARKS_SUBMITTED', targetType: 'EXAM_SUBJECT' } },
  { method: 'POST', pattern: /^\/evaluation\/subjects\/[^/]+\/return$/, audit: { action: 'MARKS_RETURNED', targetType: 'EXAM_SUBJECT' } },
  { method: 'POST', pattern: /^\/evaluation\/subjects\/[^/]+\/approve$/, audit: { action: 'MARKS_APPROVED', targetType: 'EXAM_SUBJECT' } },
  { method: 'POST', pattern: /^\/evaluation\/subjects\/[^/]+\/reopen$/, audit: { action: 'MARKS_REOPENED', targetType: 'EXAM_SUBJECT' } },
  { method: 'POST', pattern: /^\/results\/exams\/[^/]+\/compute$/, audit: { action: 'RESULT_RUN_COMPUTED', targetType: 'RESULT_RUN' } },
  { method: 'POST', pattern: /^\/results\/runs\/[^/]+\/publish$/, audit: { action: 'RESULTS_PUBLISHED', targetType: 'PUBLICATION' } },
  { method: 'POST', pattern: /^\/results\/exams\/[^/]+\/withdraw$/, audit: { action: 'RESULTS_WITHDRAWN', targetType: 'PUBLICATION' } },
];

function apiPath(request: Request): string {
  return request.originalUrl.split('?')[0]!.replace(/^\/api\/v1/, '');
}

export function auditCommand(method: string, path: string): CommandAudit | null {
  return commands.find((entry) => entry.method === method.toUpperCase() && entry.pattern.test(path))?.audit ?? null;
}

function uuid(value: unknown): UUID | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function targetId(request: Request, response: unknown): UUID | null {
  const payload = object(response);
  const unwrapped = object(payload?.data) ?? payload;
  return uuid(unwrapped?.id) ?? uuid(request.params?.id);
}

function reason(request: Request): string | null {
  const body = object(request.body);
  if (!body) return null;
  const candidate = [body.reason, body.description, body.declineReason, body.decisionReason].find((value) => typeof value === 'string') as string | undefined;
  if (candidate) return candidate.trim().slice(0, 500) || null;
  return typeof body.disposition === 'string' ? body.disposition.trim().slice(0, 500) || null : null;
}

@Injectable()
export class AuditCommandInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditCommandInterceptor.name);

  constructor(private readonly repository: AuditRepository) {}

  intercept(execution: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = execution.switchToHttp().getRequest<Request>();
    const command = auditCommand(request.method, apiPath(request));
    if (!command) return next.handle();
    let context;
    try { context = currentAuthContext(request); }
    catch { return next.handle(); }
    if (context.kind !== 'TENANT') return next.handle();

    return next.handle().pipe(mergeMap((response) => from(this.repository.record({
      tenantId: context.tenantId,
      actorMembershipId: context.membershipId,
      actorRole: context.activeRole as TenantRole,
      action: command.action,
      targetType: command.targetType,
      targetId: targetId(request, response),
      reason: reason(request),
      requestId: requestIdFor(request),
    }).then(() => response, (error: unknown) => {
      this.logger.error(`Audit persistence failed for request ${requestIdFor(request)}`, error instanceof Error ? error.stack : undefined);
      return response;
    }))));
  }
}
