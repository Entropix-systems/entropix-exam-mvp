import type { AllocationInput, AuthenticatedContext, HallCreateInput, PaperScheduleInput, PublishScheduleInput, UUID } from '@entropix/contracts';
import { isUuid } from '@entropix/domain';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SchedulingRepository } from './scheduling.repository.js';

function controller(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT' || !context.grants.some((grant) => ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(grant.role))) {
    throw new ForbiddenException('Permission denied');
  }
  return context;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnprocessableEntityException('Request body must be an object');
  return value as Record<string, unknown>;
}
function uuid(value: unknown, field: string): UUID {
  if (typeof value !== 'string' || !isUuid(value)) throw new UnprocessableEntityException(`${field} is invalid`);
  return value.toLowerCase();
}
function text(value: unknown, field: string, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw new UnprocessableEntityException(`${field} is invalid`);
  return value;
}
function positiveInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || (value as number) < 1) throw new UnprocessableEntityException(`${field} must be a positive integer`);
  return value as number;
}
function parseHall(body: unknown): HallCreateInput {
  const value = object(body);
  return {
    campusId: uuid(value.campusId, 'campusId'),
    code: text(value.code, 'code', 32).toUpperCase(),
    name: text(value.name, 'name'),
    capacity: positiveInteger(value.capacity, 'capacity'),
  };
}
function parseSchedule(body: unknown): PaperScheduleInput {
  const value = object(body);
  const startsAt = text(value.startsAt, 'startsAt');
  const endsAt = text(value.endsAt, 'endsAt');
  const start = Date.parse(startsAt); const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new UnprocessableEntityException('Paper time range is invalid');
  return { startsAt, endsAt, expectedVersion: positiveInteger(value.expectedVersion, 'expectedVersion') };
}
function parseAllocation(body: unknown): AllocationInput {
  const value = object(body);
  if (!Array.isArray(value.hallIds) || value.hallIds.length === 0) throw new UnprocessableEntityException('At least one hall is required');
  return { hallIds: value.hallIds.map((entry) => uuid(entry, 'hallIds')), expectedVersion: positiveInteger(value.expectedVersion, 'expectedVersion') };
}
function parsePublish(body: unknown): PublishScheduleInput {
  return { expectedVersion: positiveInteger(object(body).expectedVersion, 'expectedVersion') };
}

@Injectable()
export class SchedulingService {
  constructor(private readonly repository: SchedulingRepository) {}

  list(context: AuthenticatedContext) { return this.repository.snapshot(controller(context).tenantId); }
  initialize(context: AuthenticatedContext, examIdValue: string) {
    const current = controller(context);
    return this.call(() => this.repository.initializeExam(current.tenantId, uuid(examIdValue, 'examId')));
  }
  createHall(context: AuthenticatedContext, body: unknown) {
    const current = controller(context);
    return this.call(() => this.repository.createHall(current.tenantId, parseHall(body)));
  }
  updatePaper(context: AuthenticatedContext, paperIdValue: string, body: unknown) {
    const current = controller(context); const input = parseSchedule(body);
    return this.call(() => this.repository.updatePaperSchedule(current.tenantId, uuid(paperIdValue, 'paperId'), new Date(input.startsAt), new Date(input.endsAt), input.expectedVersion));
  }
  preview(context: AuthenticatedContext, paperIdValue: string, body: unknown) {
    const current = controller(context); const input = parseAllocation(body);
    return this.call(() => this.repository.previewAllocation(current.tenantId, uuid(paperIdValue, 'paperId'), input.hallIds, input.expectedVersion));
  }
  commit(context: AuthenticatedContext, paperIdValue: string, body: unknown) {
    const current = controller(context); const input = parseAllocation(body);
    return this.call(() => this.repository.commitAllocation(current.tenantId, uuid(paperIdValue, 'paperId'), input.hallIds, input.expectedVersion));
  }
  publish(context: AuthenticatedContext, examIdValue: string, body: unknown) {
    const current = controller(context); const input = parsePublish(body);
    return this.call(() => this.repository.publish(current.tenantId, uuid(examIdValue, 'examId'), input.expectedVersion));
  }

  private async call<T>(operation: () => Promise<T>) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      if (['PAPER_NOT_FOUND', 'EXAM_NOT_FOUND'].includes(error.message)) throw new NotFoundException(error.message === 'PAPER_NOT_FOUND' ? 'Paper not found' : 'Exam not found');
      if (error.message === 'INVALID_CAMPUS') throw new UnprocessableEntityException('Campus does not belong to this institution');
      if (error.message === 'INVALID_HALL') throw new UnprocessableEntityException('One or more halls are invalid');
      if (error.message === 'HALL_CODE_CONFLICT') throw new ConflictException('Hall code already exists with different details');
      if (error.message === 'STALE_VERSION') throw new ConflictException('This timetable changed; reload before continuing');
      if (error.message === 'PAPER_NOT_SCHEDULED') throw new ConflictException('Schedule the paper before allocating halls');
      if (error.message === 'STUDENT_OVERLAP') throw new ConflictException('A registered student has an overlapping paper');
      if (error.message === 'HALL_OVERLAP') throw new ConflictException('A selected hall is already used by an overlapping paper');
      if (error.message === 'INSUFFICIENT_CAPACITY') throw new ConflictException('Selected halls do not have enough seats');
      if (error.message === 'SCHEDULE_NOT_READY') throw new ConflictException('Every approved registration subject must have a scheduled seat before publication');
      if (error.message === 'INVALID_EXAM_STATE') throw new ConflictException('Exam is not in timetable preparation');
      throw error;
    }
  }
}
