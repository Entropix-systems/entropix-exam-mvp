import type {
  AcademicInputByResource,
  AcademicMasterRecord,
  AcademicResourcePath,
  AcademicStructureSnapshot,
  AcademicYearInput,
  CohortInput,
  DepartmentInput,
  ProgramInput,
  SubjectInput,
  TermInput,
  UUID,
} from '@entropix/contracts';
import { PrismaClient, withTenant } from '@entropix/db';
import { Injectable } from '@nestjs/common';

export class AcademicPersistenceError extends Error {
  constructor(readonly kind: 'DUPLICATE_CODE' | 'INVALID_PARENT') {
    super(kind);
  }
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function databaseErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code)
    : null;
}

function mapDates<T extends { startsOn: Date; endsOn: Date }>(row: T) {
  return {
    ...row,
    startsOn: isoDate(row.startsOn),
    endsOn: isoDate(row.endsOn),
  };
}

function withinYear(
  input: Pick<TermInput, 'startsOn' | 'endsOn'>,
  academicYear: { startsOn: Date; endsOn: Date },
): boolean {
  const start = new Date(`${input.startsOn}T00:00:00.000Z`);
  const end = new Date(`${input.endsOn}T00:00:00.000Z`);
  return start >= academicYear.startsOn && end <= academicYear.endsOn;
}

@Injectable()
export class AcademicsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async snapshot(tenantId: UUID): Promise<AcademicStructureSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      const campuses = await tx.campus.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
      });
      const departments = await tx.department.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
      });
      const programs = await tx.program.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
      });
      const academicYears = await tx.academicYear.findMany({
        where: { tenantId },
        orderBy: { startsOn: 'desc' },
      });
      const terms = await tx.term.findMany({
        where: { tenantId },
        orderBy: [{ academicYearId: 'asc' }, { sequence: 'asc' }],
      });
      const cohorts = await tx.cohort.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
      });
      const subjects = await tx.subject.findMany({
        where: { tenantId },
        orderBy: { code: 'asc' },
      });
      return {
        tenant,
        campuses,
        departments,
        programs,
        academicYears: academicYears.map(mapDates),
        terms: terms.map(mapDates),
        cohorts,
        subjects,
      };
    });
  }

  async get(
    tenantId: UUID,
    path: AcademicResourcePath,
    id: UUID,
  ): Promise<AcademicMasterRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const where = { id, tenantId };
      switch (path) {
        case 'campuses':
          return await tx.campus.findFirst({ where });
        case 'departments':
          return await tx.department.findFirst({ where });
        case 'programs':
          return await tx.program.findFirst({ where });
        case 'academic-years': {
          const row = await tx.academicYear.findFirst({ where });
          return row ? mapDates(row) : null;
        }
        case 'terms': {
          const row = await tx.term.findFirst({ where });
          return row ? mapDates(row) : null;
        }
        case 'cohorts':
          return await tx.cohort.findFirst({ where });
        case 'subjects':
          return await tx.subject.findFirst({ where });
      }
    });
  }

  async create<P extends AcademicResourcePath>(
    tenantId: UUID,
    path: P,
    input: AcademicInputByResource[P],
  ): Promise<AcademicMasterRecord> {
    try {
      return await withTenant(this.prisma, tenantId, async (tx) => {
        const data = { ...input, tenantId };
        switch (path) {
          case 'campuses':
            return await tx.campus.create({ data });
          case 'departments': {
            const department = input as DepartmentInput;
            if (
              !(await tx.campus.findFirst({
                where: { id: department.campusId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.department.create({
              data: { ...department, tenantId },
            });
          }
          case 'programs': {
            const program = input as ProgramInput;
            if (
              !(await tx.department.findFirst({
                where: { id: program.departmentId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.program.create({ data: { ...program, tenantId } });
          }
          case 'academic-years': {
            const year = input as AcademicYearInput;
            return mapDates(
              await tx.academicYear.create({
                data: {
                  ...year,
                  startsOn: new Date(`${year.startsOn}T00:00:00.000Z`),
                  endsOn: new Date(`${year.endsOn}T00:00:00.000Z`),
                  tenantId,
                },
              }),
            );
          }
          case 'terms': {
            const term = input as TermInput;
            const program = await tx.program.findFirst({
              where: { id: term.programId, tenantId },
            });
            const year = await tx.academicYear.findFirst({
              where: { id: term.academicYearId, tenantId },
            });
            if (!program || !year || !withinYear(term, year))
              throw new AcademicPersistenceError('INVALID_PARENT');
            return mapDates(
              await tx.term.create({
                data: {
                  ...term,
                  startsOn: new Date(`${term.startsOn}T00:00:00.000Z`),
                  endsOn: new Date(`${term.endsOn}T00:00:00.000Z`),
                  tenantId,
                },
              }),
            );
          }
          case 'cohorts': {
            const cohort = input as CohortInput;
            if (
              !(await tx.term.findFirst({
                where: { id: cohort.termId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.cohort.create({ data: { ...cohort, tenantId } });
          }
          case 'subjects': {
            const subject = input as SubjectInput;
            if (
              !(await tx.program.findFirst({
                where: { id: subject.programId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.subject.create({ data: { ...subject, tenantId } });
          }
        }
      });
    } catch (error) {
      if (error instanceof AcademicPersistenceError) throw error;
      if (databaseErrorCode(error) === 'P2002')
        throw new AcademicPersistenceError('DUPLICATE_CODE');
      if (databaseErrorCode(error) === 'P2003')
        throw new AcademicPersistenceError('INVALID_PARENT');
      throw error;
    }
  }

  async update<P extends AcademicResourcePath>(
    tenantId: UUID,
    path: P,
    id: UUID,
    input: AcademicInputByResource[P],
  ): Promise<AcademicMasterRecord | null> {
    const existing = await this.get(tenantId, path, id);
    if (!existing) return null;
    try {
      return await withTenant(this.prisma, tenantId, async (tx) => {
        switch (path) {
          case 'campuses':
            return await tx.campus.update({ where: { id }, data: input });
          case 'departments': {
            const department = input as DepartmentInput;
            if (
              !(await tx.campus.findFirst({
                where: { id: department.campusId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.department.update({
              where: { id },
              data: department,
            });
          }
          case 'programs': {
            const program = input as ProgramInput;
            if (
              !(await tx.department.findFirst({
                where: { id: program.departmentId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.program.update({ where: { id }, data: program });
          }
          case 'academic-years': {
            const year = input as AcademicYearInput;
            return mapDates(
              await tx.academicYear.update({
                where: { id },
                data: {
                  ...year,
                  startsOn: new Date(`${year.startsOn}T00:00:00.000Z`),
                  endsOn: new Date(`${year.endsOn}T00:00:00.000Z`),
                },
              }),
            );
          }
          case 'terms': {
            const term = input as TermInput;
            const program = await tx.program.findFirst({
              where: { id: term.programId, tenantId },
            });
            const year = await tx.academicYear.findFirst({
              where: { id: term.academicYearId, tenantId },
            });
            if (!program || !year || !withinYear(term, year))
              throw new AcademicPersistenceError('INVALID_PARENT');
            return mapDates(
              await tx.term.update({
                where: { id },
                data: {
                  ...term,
                  startsOn: new Date(`${term.startsOn}T00:00:00.000Z`),
                  endsOn: new Date(`${term.endsOn}T00:00:00.000Z`),
                },
              }),
            );
          }
          case 'cohorts': {
            const cohort = input as CohortInput;
            if (
              !(await tx.term.findFirst({
                where: { id: cohort.termId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.cohort.update({ where: { id }, data: cohort });
          }
          case 'subjects': {
            const subject = input as SubjectInput;
            if (
              !(await tx.program.findFirst({
                where: { id: subject.programId, tenantId },
              }))
            )
              throw new AcademicPersistenceError('INVALID_PARENT');
            return await tx.subject.update({ where: { id }, data: subject });
          }
        }
      });
    } catch (error) {
      if (error instanceof AcademicPersistenceError) throw error;
      if (databaseErrorCode(error) === 'P2002')
        throw new AcademicPersistenceError('DUPLICATE_CODE');
      if (databaseErrorCode(error) === 'P2003')
        throw new AcademicPersistenceError('INVALID_PARENT');
      throw error;
    }
  }
}
