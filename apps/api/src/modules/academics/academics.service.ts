import type {
  AcademicInputByResource,
  AcademicResourcePath,
  AuthenticatedContext,
  UUID,
} from '@entropix/contracts';
import { ACADEMIC_RESOURCE_PATHS } from '@entropix/contracts';
import { hasActiveRole, isUuid } from '@entropix/domain';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AcademicPersistenceError,
  AcademicsRepository,
} from './academics.repository.js';

const resourcePaths = new Set<string>(ACADEMIC_RESOURCE_PATHS);
const codePattern = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function pathValue(value: string): AcademicResourcePath {
  if (!resourcePaths.has(value))
    throw new NotFoundException('Academic resource not found');
  return value as AcademicResourcePath;
}

function tenantContext(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT')
    throw new ForbiddenException('Permission denied');
  return context;
}

function requireAcademicAdmin(context: AuthenticatedContext) {
  const tenant = tenantContext(context);
  if (
    !hasActiveRole(tenant, ['INSTITUTION_ADMIN'])
  )
    throw new ForbiddenException('Permission denied');
  return tenant;
}

function recordBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new UnprocessableEntityException('Academic input is invalid');
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string')
    throw new UnprocessableEntityException(`${field} is invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new UnprocessableEntityException(`${field} is invalid`);
  return normalized;
}

function code(value: unknown): string {
  const normalized = text(value, 'Code', 32).toUpperCase();
  if (!codePattern.test(normalized))
    throw new UnprocessableEntityException('Code is invalid');
  return normalized;
}

function uuid(value: unknown, field: string): UUID {
  if (typeof value !== 'string' || !isUuid(value))
    throw new UnprocessableEntityException(`${field} is invalid`);
  return value.toLowerCase();
}

function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !datePattern.test(value))
    throw new UnprocessableEntityException(`${field} is invalid`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new UnprocessableEntityException(`${field} is invalid`);
  return value;
}

function orderedDates(startsOn: string, endsOn: string): void {
  if (startsOn > endsOn)
    throw new UnprocessableEntityException(
      'Start date must not be after end date',
    );
}

function positiveInteger(
  value: unknown,
  field: string,
  maximum: number,
): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > maximum
  )
    throw new UnprocessableEntityException(`${field} is invalid`);
  return value as number;
}

function checkedInput<P extends AcademicResourcePath>(
  path: P,
  value: unknown,
): AcademicInputByResource[P] {
  const body = recordBody(value);
  const base = { code: code(body.code), name: text(body.name, 'Name', 160) };
  let input: AcademicInputByResource[AcademicResourcePath];
  switch (path) {
    case 'campuses':
      input = base;
      break;
    case 'departments':
      input = { ...base, campusId: uuid(body.campusId, 'Campus') };
      break;
    case 'programs':
      input = { ...base, departmentId: uuid(body.departmentId, 'Department') };
      break;
    case 'academic-years': {
      const startsOn = date(body.startsOn, 'Start date');
      const endsOn = date(body.endsOn, 'End date');
      orderedDates(startsOn, endsOn);
      input = { ...base, startsOn, endsOn };
      break;
    }
    case 'terms': {
      const startsOn = date(body.startsOn, 'Start date');
      const endsOn = date(body.endsOn, 'End date');
      orderedDates(startsOn, endsOn);
      input = {
        ...base,
        programId: uuid(body.programId, 'Program'),
        academicYearId: uuid(body.academicYearId, 'Academic year'),
        startsOn,
        endsOn,
        sequence: positiveInteger(body.sequence, 'Sequence', 100),
      };
      break;
    }
    case 'cohorts':
      input = { ...base, termId: uuid(body.termId, 'Term') };
      break;
    case 'subjects':
      input = {
        ...base,
        programId: uuid(body.programId, 'Program'),
        credits: positiveInteger(body.credits, 'Credits', 50),
      };
      break;
  }
  return input as AcademicInputByResource[P];
}

@Injectable()
export class AcademicsService {
  constructor(private readonly repository: AcademicsRepository) {}

  list(context: AuthenticatedContext) {
    return this.repository.snapshot(tenantContext(context).tenantId);
  }

  async get(context: AuthenticatedContext, rawPath: string, rawId: string) {
    const tenant = tenantContext(context);
    const path = pathValue(rawPath);
    if (!isUuid(rawId))
      throw new NotFoundException('Academic record not found');
    const record = await this.repository.get(
      tenant.tenantId,
      path,
      rawId.toLowerCase(),
    );
    if (!record) throw new NotFoundException('Academic record not found');
    return record;
  }

  async create(context: AuthenticatedContext, rawPath: string, body: unknown) {
    const tenant = requireAcademicAdmin(context);
    const path = pathValue(rawPath);
    try {
      return await this.repository.create(
        tenant.tenantId,
        path,
        checkedInput(path, body),
      );
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async update(
    context: AuthenticatedContext,
    rawPath: string,
    rawId: string,
    body: unknown,
  ) {
    const tenant = requireAcademicAdmin(context);
    const path = pathValue(rawPath);
    if (!isUuid(rawId))
      throw new NotFoundException('Academic record not found');
    try {
      const record = await this.repository.update(
        tenant.tenantId,
        path,
        rawId.toLowerCase(),
        checkedInput(path, body),
      );
      if (!record) throw new NotFoundException('Academic record not found');
      return record;
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  private rethrowPersistence(error: unknown): never {
    if (error instanceof AcademicPersistenceError) {
      throw new UnprocessableEntityException(
        error.kind === 'DUPLICATE_CODE'
          ? 'Code already exists in this academic scope'
          : 'Academic hierarchy is invalid',
      );
    }
    throw error;
  }
}
