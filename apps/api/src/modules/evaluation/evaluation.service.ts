import type {
  AuthenticatedContext,
  EvaluationAssignmentInput,
  MarkComponent,
  MarksReviewInput,
  MarksSaveInput,
  MarksTransitionInput,
  UUID,
} from '@entropix/contracts';
import { isUuid } from '@entropix/domain';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AUTH_CLOCK } from '../identity/application/auth.service.js';
import { EvaluationRepository, type EvaluationActor } from './evaluation.repository.js';

function tenant(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT') throw new ForbiddenException('Permission denied');
  return context;
}

function actor(context: AuthenticatedContext): EvaluationActor {
  const current = tenant(context);
  const controller = ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(current.activeRole);
  const departmentIds = current.activeRole === 'DEPARTMENT_ADMIN' ? current.grants
    .filter((grant) => grant.role === current.activeRole && grant.departmentId)
    .map((grant) => grant.departmentId as UUID)
    : [];
  return {
    membershipId: current.membershipId,
    examiner: current.activeRole === 'FACULTY',
    controller,
    departmentIds,
  };
}

function examiner(context: AuthenticatedContext) {
  const current = tenant(context);
  if (current.activeRole !== 'FACULTY') throw new ForbiddenException('Permission denied');
  return current;
}

function reviewer(context: AuthenticatedContext) {
  const current = tenant(context);
  const resolved = actor(context);
  if (!resolved.controller && resolved.departmentIds.length === 0) throw new ForbiddenException('Permission denied');
  return { current, resolved };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnprocessableEntityException('Request body must be an object');
  return value as Record<string, unknown>;
}

function uuid(value: unknown, field: string): UUID {
  if (typeof value !== 'string' || !isUuid(value)) throw new UnprocessableEntityException(field + ' is invalid');
  return value.toLowerCase();
}

function version(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new UnprocessableEntityException('expectedVersion must be a non-negative integer');
  return value as number;
}

function reason(value: unknown): string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 5 || value.length > 500) throw new UnprocessableEntityException('reason must be between 5 and 500 characters');
  return value;
}

const markPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
export function normalizeMarkValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !markPattern.test(value)) throw new UnprocessableEntityException('mark values must be non-negative decimals with at most four decimal places');
  const [integer, fraction] = value.split('.');
  const trimmed = fraction?.replace(/0+$/, '');
  return trimmed ? integer! + '.' + trimmed : integer!;
}

function assignmentInput(body: unknown): EvaluationAssignmentInput {
  const value = object(body);
  return { facultyId: uuid(value.facultyId, 'facultyId'), expectedVersion: version(value.expectedVersion) };
}

function transitionInput(body: unknown): MarksTransitionInput {
  return { expectedVersion: version(object(body).expectedVersion) };
}

function reviewInput(body: unknown): MarksReviewInput {
  const value = object(body);
  return { expectedVersion: version(value.expectedVersion), reason: reason(value.reason) };
}

function saveInput(body: unknown): MarksSaveInput {
  const value = object(body);
  if (!Array.isArray(value.rows)) throw new UnprocessableEntityException('rows must be an array');
  return {
    expectedVersion: version(value.expectedVersion),
    rows: value.rows.map((entry) => {
      const row = object(entry);
      if (!Array.isArray(row.marks)) throw new UnprocessableEntityException('marks must be an array');
      return {
        registrationSubjectId: uuid(row.registrationSubjectId, 'registrationSubjectId'),
        marks: row.marks.map((entryValue) => {
          const mark = object(entryValue);
          if (!['FINAL', 'INTERNAL', 'EXTERNAL'].includes(String(mark.component))) throw new UnprocessableEntityException('mark component is invalid');
          return { component: mark.component as MarkComponent, value: normalizeMarkValue(mark.value) };
        }),
      };
    }),
  };
}

@Injectable()
export class EvaluationService {
  constructor(
    private readonly repository: EvaluationRepository,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  list(context: AuthenticatedContext) {
    const current = tenant(context);
    if (!['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY'].includes(current.activeRole)) {
      throw new ForbiddenException('Permission denied');
    }
    const resolved = actor(context);
    return this.call(() => this.repository.snapshot(current.tenantId, resolved));
  }

  assign(context: AuthenticatedContext, examSubjectIdValue: string, body: unknown) {
    const { current, resolved } = reviewer(context);
    return this.call(() => this.repository.assign(current.tenantId, resolved, uuid(examSubjectIdValue, 'examSubjectId'), assignmentInput(body), this.clock()));
  }

  save(context: AuthenticatedContext, examSubjectIdValue: string, body: unknown) {
    const current = examiner(context);
    return this.call(() => this.repository.save(current.tenantId, current.membershipId, uuid(examSubjectIdValue, 'examSubjectId'), saveInput(body), this.clock()));
  }

  submit(context: AuthenticatedContext, examSubjectIdValue: string, body: unknown) {
    const current = examiner(context);
    return this.call(() => this.repository.submit(current.tenantId, current.membershipId, uuid(examSubjectIdValue, 'examSubjectId'), transitionInput(body).expectedVersion, this.clock()));
  }

  returnBatch(context: AuthenticatedContext, examSubjectIdValue: string, body: unknown) {
    const { current, resolved } = reviewer(context);
    const input = reviewInput(body);
    return this.call(() => this.repository.review(current.tenantId, resolved, uuid(examSubjectIdValue, 'examSubjectId'), 'RETURNED', input, this.clock()));
  }

  approve(context: AuthenticatedContext, examSubjectIdValue: string, body: unknown) {
    const { current, resolved } = reviewer(context);
    const input = reviewInput(body);
    return this.call(() => this.repository.review(current.tenantId, resolved, uuid(examSubjectIdValue, 'examSubjectId'), 'APPROVED', input, this.clock()));
  }

  reopen(context: AuthenticatedContext, examSubjectIdValue: string, body: unknown) {
    const current = tenant(context);
    const resolved = actor(context);
    if (!resolved.controller) throw new ForbiddenException('Only an institution administrator or exam controller may reopen approved marks');
    return this.call(() => this.repository.reopen(current.tenantId, resolved, uuid(examSubjectIdValue, 'examSubjectId'), reviewInput(body), this.clock()));
  }

  private async call<T>(operation: () => Promise<T>) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      if (['EXAM_SUBJECT_NOT_FOUND', 'ASSIGNMENT_NOT_FOUND', 'BATCH_NOT_FOUND'].includes(error.message)) throw new NotFoundException('Evaluation record not found');
      if (['NOT_ASSIGNED', 'REVIEW_SCOPE_DENIED'].includes(error.message)) throw new ForbiddenException('Permission denied for this exam subject');
      if (error.message === 'SELF_APPROVAL') throw new ForbiddenException('The marks submitter cannot approve their own batch');
      if (error.message === 'STALE_VERSION') throw new ConflictException('This evaluation record changed; reload before continuing');
      if (error.message === 'BATCH_LOCKED') throw new ConflictException('Only a draft or returned batch may be edited');
      if (error.message === 'INVALID_BATCH_STATE') throw new ConflictException('This action is not valid in the current batch state');
      if (error.message === 'RESULTS_PUBLISHED') throw new ConflictException('Withdraw published results before changing marks');
      if (error.message === 'CONDUCT_INCOMPLETE') throw new ConflictException('Submitted attendance is required and unresolved hall incidents must be closed');
      if (error.message === 'INCOMPLETE_MARKS') throw new UnprocessableEntityException('Every attending student requires every configured component mark');
      if (error.message === 'ABSENT_MARK_CONFLICT') throw new UnprocessableEntityException('ABSENT students must have a blank external or final mark');
      if (['INVALID_FACULTY', 'INVALID_ROSTER_ROW', 'INVALID_COMPONENT', 'MARK_OUT_OF_RANGE', 'INVALID_EXAM_STATE'].includes(error.message)) throw new UnprocessableEntityException(error.message.replaceAll('_', ' ').toLowerCase());
      throw error;
    }
  }
}
