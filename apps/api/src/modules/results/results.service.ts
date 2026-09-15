import type { AuthenticatedContext, UUID } from '@entropix/contracts';
import { isUuid, ResultInputError } from '@entropix/domain';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AUTH_CLOCK } from '../identity/application/auth.service.js';
import { ResultsRepository } from './results.repository.js';

function tenant(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT') throw new ForbiddenException('Permission denied');
  return context;
}

function controller(context: AuthenticatedContext) {
  const current = tenant(context);
  if (!['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(current.activeRole)) {
    throw new ForbiddenException('Only an institution administrator or exam controller may manage results');
  }
  return current;
}

function student(context: AuthenticatedContext) {
  const current = tenant(context);
  if (current.activeRole !== 'STUDENT') throw new ForbiddenException('Only the active student role may read student results');
  return current;
}

function uuid(value: unknown, field: string): UUID {
  if (typeof value !== 'string' || !isUuid(value)) throw new UnprocessableEntityException(field + ' is invalid');
  return value.toLowerCase();
}

function withdrawalReason(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new UnprocessableEntityException('Request body must be an object');
  const value = (body as Record<string, unknown>).reason;
  if (typeof value !== 'string' || value !== value.trim() || value.length < 5 || value.length > 500) {
    throw new UnprocessableEntityException('reason must be between 5 and 500 characters');
  }
  return value;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly repository: ResultsRepository,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  snapshot(context: AuthenticatedContext) {
    const current = controller(context);
    return this.call(() => this.repository.snapshot(current.tenantId));
  }

  compute(context: AuthenticatedContext, examIdValue: string) {
    const current = controller(context);
    return this.call(() => this.repository.compute(current.tenantId, current.membershipId, uuid(examIdValue, 'examId'), this.clock()));
  }

  readRun(context: AuthenticatedContext, resultRunIdValue: string) {
    const current = controller(context);
    return this.call(() => this.repository.readRun(current.tenantId, uuid(resultRunIdValue, 'resultRunId')));
  }

  publish(context: AuthenticatedContext, resultRunIdValue: string) {
    const current = controller(context);
    return this.call(() => this.repository.publish(current.tenantId, current.membershipId, uuid(resultRunIdValue, 'resultRunId'), this.clock()));
  }

  withdraw(context: AuthenticatedContext, examIdValue: string, body: unknown) {
    const current = controller(context);
    return this.call(() => this.repository.withdraw(current.tenantId, current.membershipId, uuid(examIdValue, 'examId'), withdrawalReason(body), this.clock()));
  }

  currentStudent(context: AuthenticatedContext) {
    const current = student(context);
    return this.call(() => this.repository.currentStudent(current.tenantId, current.membershipId));
  }

  private async call<T>(operation: () => Promise<T>) {
    try { return await operation(); }
    catch (error) {
      if (error instanceof ResultInputError) throw new UnprocessableEntityException(error.message);
      if (!(error instanceof Error)) throw error;
      if (['EXAM_NOT_FOUND', 'RUN_NOT_FOUND', 'PUBLICATION_NOT_FOUND', 'STUDENT_NOT_FOUND'].includes(error.message)) throw new NotFoundException('Result record not found');
      if (['STALE_RUN', 'INPUT_REVISION_DRIFT'].includes(error.message)) throw new ConflictException('The result run is stale because approved inputs changed');
      if (error.message === 'PUBLICATION_ACTIVE') throw new ConflictException('Withdraw the current publication before continuing');
      if (error.message === 'RESULTS_NOT_READY') throw new UnprocessableEntityException('Result run blocked until conduct is closed and every subject marks batch is approved');
      if (error.message === 'INVALID_EXAM_STATE') throw new UnprocessableEntityException('The exam is not ready for result computation');
      throw error;
    }
  }
}
