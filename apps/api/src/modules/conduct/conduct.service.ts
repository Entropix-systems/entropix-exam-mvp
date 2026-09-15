import type {
  AssignDutyInput,
  AttendanceSaveInput,
  AuthenticatedContext,
  DeclineDutyInput,
  IncidentCreateInput,
  IncidentDispositionInput,
  UUID,
} from '@entropix/contracts';
import { isUuid } from '@entropix/domain';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AUTH_CLOCK } from '../identity/application/auth.service.js';
import { ConductRepository } from './conduct.repository.js';

function tenant(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT') throw new ForbiddenException('Permission denied');
  return context;
}

function hasRole(context: ReturnType<typeof tenant>, roles: readonly string[]) {
  return roles.includes(context.activeRole);
}

function controller(context: AuthenticatedContext) {
  const current = tenant(context);
  if (!hasRole(current, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'])) throw new ForbiddenException('Permission denied');
  return current;
}

function invigilator(context: AuthenticatedContext) {
  const current = tenant(context);
  if (!hasRole(current, ['INVIGILATOR'])) throw new ForbiddenException('Permission denied');
  return current;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnprocessableEntityException('Request body must be an object');
  return value as Record<string, unknown>;
}

function uuid(value: unknown, field: string): UUID {
  if (typeof value !== 'string' || !isUuid(value)) throw new UnprocessableEntityException(`${field} is invalid`);
  return value.toLowerCase();
}

function reason(value: unknown, field = 'reason', max = 500) {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 5 || value.length > max) throw new UnprocessableEntityException(`${field} must be between 5 and ${max} characters`);
  return value;
}

function version(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 0) throw new UnprocessableEntityException('expectedVersion must be a non-negative integer');
  return value as number;
}

function assignInput(body: unknown): AssignDutyInput {
  const value = object(body);
  return { facultyId: uuid(value.facultyId, 'facultyId'), ...(value.replacesDutyId === undefined ? {} : { replacesDutyId: uuid(value.replacesDutyId, 'replacesDutyId') }) };
}

function attendanceInput(body: unknown): AttendanceSaveInput {
  const value = object(body);
  if (!Array.isArray(value.rows)) throw new UnprocessableEntityException('rows must be an array');
  return {
    expectedVersion: version(value.expectedVersion),
    rows: value.rows.map((entry) => {
      const row = object(entry);
      if (!['NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE'].includes(String(row.state))) throw new UnprocessableEntityException('Attendance state is invalid');
      return { seatAssignmentId: uuid(row.seatAssignmentId, 'seatAssignmentId'), state: row.state as AttendanceSaveInput['rows'][number]['state'] };
    }),
  };
}

function incidentInput(body: unknown): IncidentCreateInput {
  const value = object(body);
  if (!['STUDENT', 'HALL'].includes(String(value.kind))) throw new UnprocessableEntityException('Incident kind is invalid');
  if (!Array.isArray(value.registrationSubjectIds)) throw new UnprocessableEntityException('registrationSubjectIds must be an array');
  return {
    kind: value.kind as IncidentCreateInput['kind'],
    description: reason(value.description, 'description', 1000),
    registrationSubjectIds: value.registrationSubjectIds.map((entry) => uuid(entry, 'registrationSubjectIds')),
  };
}

function dispositionInput(body: unknown): IncidentDispositionInput {
  const value = object(body);
  if (!['CLEARED', 'RETAIN_WITHHELD', 'NO_RESULT_IMPACT'].includes(String(value.disposition))) throw new UnprocessableEntityException('Incident disposition is invalid');
  return { disposition: value.disposition as IncidentDispositionInput['disposition'], expectedVersion: version(value.expectedVersion), reason: reason(value.reason) };
}

@Injectable()
export class ConductService {
  constructor(
    private readonly repository: ConductRepository,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  list(context: AuthenticatedContext) {
    const current = tenant(context);
    const isController = hasRole(current, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER']);
    if (!isController && !hasRole(current, ['INVIGILATOR'])) throw new ForbiddenException('Permission denied');
    return this.call(() => this.repository.snapshot(current.tenantId, { membershipId: current.membershipId, controller: isController }, this.clock()));
  }

  assign(context: AuthenticatedContext, sittingIdValue: string, body: unknown) {
    const current = controller(context);
    return this.call(() => this.repository.assignDuty(current.tenantId, current.membershipId, uuid(sittingIdValue, 'hallSittingId'), assignInput(body)));
  }

  accept(context: AuthenticatedContext, dutyIdValue: string) {
    const current = invigilator(context);
    return this.call(() => this.repository.respondDuty(current.tenantId, current.membershipId, uuid(dutyIdValue, 'dutyId'), 'ACCEPTED', null, this.clock()));
  }

  decline(context: AuthenticatedContext, dutyIdValue: string, body: unknown) {
    const current = invigilator(context);
    const input = object(body) as unknown as DeclineDutyInput;
    return this.call(() => this.repository.respondDuty(current.tenantId, current.membershipId, uuid(dutyIdValue, 'dutyId'), 'DECLINED', reason(input.reason), this.clock()));
  }

  saveAttendance(context: AuthenticatedContext, sittingIdValue: string, body: unknown) {
    const current = invigilator(context);
    return this.call(() => this.repository.saveAttendance(current.tenantId, current.membershipId, uuid(sittingIdValue, 'hallSittingId'), attendanceInput(body), this.clock()));
  }

  submitAttendance(context: AuthenticatedContext, sittingIdValue: string, body: unknown) {
    const current = invigilator(context);
    return this.call(() => this.repository.submitAttendance(current.tenantId, current.membershipId, uuid(sittingIdValue, 'hallSittingId'), version(object(body).expectedVersion), this.clock()));
  }

  reopenAttendance(context: AuthenticatedContext, sittingIdValue: string, body: unknown) {
    const current = controller(context); const value = object(body);
    return this.call(() => this.repository.reopenAttendance(current.tenantId, current.membershipId, uuid(sittingIdValue, 'hallSittingId'), version(value.expectedVersion), reason(value.reason), this.clock()));
  }

  createIncident(context: AuthenticatedContext, sittingIdValue: string, body: unknown) {
    const current = tenant(context);
    const isController = hasRole(current, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER']);
    if (!isController && !hasRole(current, ['INVIGILATOR'])) throw new ForbiddenException('Permission denied');
    return this.call(() => this.repository.createIncident(current.tenantId, { membershipId: current.membershipId, controller: isController }, uuid(sittingIdValue, 'hallSittingId'), incidentInput(body), this.clock()));
  }

  disposeIncident(context: AuthenticatedContext, incidentIdValue: string, body: unknown) {
    const current = controller(context); const input = dispositionInput(body);
    return this.call(() => this.repository.disposeIncident(current.tenantId, current.membershipId, uuid(incidentIdValue, 'incidentId'), input.disposition, input.expectedVersion, input.reason, this.clock()));
  }

  resultState(context: AuthenticatedContext, examIdValue: string) {
    const current = controller(context);
    return this.call(() => this.repository.resultState(current.tenantId, uuid(examIdValue, 'examId')));
  }

  private async call<T>(operation: () => Promise<T>) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      if (['SITTING_NOT_FOUND', 'DUTY_NOT_FOUND', 'ATTENDANCE_NOT_FOUND', 'INCIDENT_NOT_FOUND', 'EXAM_NOT_FOUND'].includes(error.message)) throw new NotFoundException('Conduct record not found');
      if (['NOT_ASSIGNED'].includes(error.message)) throw new ForbiddenException('Only the assigned accepted invigilator may access this roster');
      if (error.message === 'DUTY_OVERLAP') throw new ConflictException('This faculty member already has an overlapping active duty');
      if (error.message === 'STALE_VERSION') throw new ConflictException('This conduct record changed; reload before continuing');
      if (error.message === 'ATTENDANCE_SUBMITTED') throw new ConflictException('Submitted attendance is locked until a controller reopens it');
      if (error.message === 'NOT_MARKED_REMAINS') throw new ConflictException('Every roster row must be PRESENT, ABSENT, or LATE before submission');
      if (['INVALID_DUTY_STATE', 'INVALID_ATTENDANCE_STATE', 'INCIDENT_CLOSED'].includes(error.message)) throw new ConflictException('This action is not valid in the current state');
      if (error.message === 'OUTSIDE_CONDUCT_WINDOW') throw new ConflictException('Attendance can only be edited during the conduct window');
      if (error.message === 'RESULTS_PUBLISHED') throw new ConflictException('Withdraw published results before changing conduct data');
      if (error.message === 'INVALID_CONDUCT_STATE') throw new ConflictException('This exam is not open for conduct changes');
      if (error.message === 'HALL_IMPACT_REQUIRED') throw new ConflictException('A hall incident without affected students must be closed as no result impact');
      if (['FACULTY_NOT_FOUND', 'SITTING_NOT_SCHEDULED', 'INVALID_REPLACEMENT', 'INVALID_ROSTER_ROW', 'INCIDENT_STUDENT_REQUIRED', 'INVALID_DISPOSITION'].includes(error.message)) throw new UnprocessableEntityException(error.message.replaceAll('_', ' ').toLowerCase());
      throw error;
    }
  }
}
