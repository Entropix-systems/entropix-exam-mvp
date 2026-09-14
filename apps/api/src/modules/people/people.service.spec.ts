import type { AuthenticatedContext, StudentImportCommitResult } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ImportValidationContext, PeopleRepository } from './people.repository.js';
import { PeopleService } from './people.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const cohortId = '33333333-3333-4333-8333-333333333333';
const programId = '44444444-4444-4444-8444-444444444444';
const subjectId = '55555555-5555-4555-8555-555555555555';

function context(role: 'INSTITUTION_ADMIN' | 'EXAM_CONTROLLER' | 'STUDENT'): AuthenticatedContext {
  return {
    kind: 'TENANT',
    userId: '66666666-6666-4666-8666-666666666666',
    tenantId,
    membershipId,
    activeRole: role,
    grants: [{ role, departmentId: null }],
  };
}

function validation(overrides: Partial<ImportValidationContext> = {}): ImportValidationContext {
  return {
    cohorts: [{ id: cohortId, code: 'BSC-CS-S3', programId }],
    subjects: [{ id: subjectId, code: 'CS301', programId }],
    existingRolls: new Set(),
    committed: null,
    ...overrides,
  };
}

function repository(overrides: Partial<PeopleRepository> = {}) {
  return {
    listStudents: vi.fn().mockResolvedValue({ students: [], total: 0, nextCursor: null }),
    getStudent: vi.fn().mockResolvedValue(null),
    listFaculty: vi.fn().mockResolvedValue([]),
    importContext: vi.fn().mockResolvedValue(validation()),
    commitImport: vi.fn().mockResolvedValue({
      importId: '77777777-7777-4777-8777-777777777777',
      contentHash: 'a'.repeat(64),
      rowCount: 1,
      createdCount: 1,
      enrolmentCount: 1,
      replayed: false,
      committedAt: '2026-09-13T12:00:00.000Z',
    }),
    ...overrides,
  } as unknown as PeopleRepository;
}

const validCsv = [
  'roll_no,name,email,cohort_code,subject_codes',
  'NS26001,Northstar Student 001,student.001@northstar.example.test,BSC-CS-S3,CS301',
].join('\n');

describe('PeopleService student import', () => {
  it('previews a valid CSV with retained source rows', async () => {
    const service = new PeopleService(repository());
    const preview = await service.previewImport(context('INSTITUTION_ADMIN'), {
      fileName: 'students.csv',
      sourceText: validCsv,
    });
    expect(preview).toMatchObject({ rowCount: 1, acceptedCount: 1, rejectedCount: 0 });
    expect(preview.rows[0]).toMatchObject({ rowNumber: 2, rollNo: 'NS26001', valid: true });
  });

  it('reports duplicate, existing, and unknown academic values by source row', async () => {
    const repo = repository({
      importContext: vi.fn().mockResolvedValue(validation({ existingRolls: new Set(['NS26001']) })),
    });
    const service = new PeopleService(repo);
    const sourceText = [
      'roll_no,name,email,cohort_code,subject_codes',
      'NS26001,One,one@example.test,BSC-CS-S3,CS301',
      'NS26001,Two,two@example.test,MISSING,UNKNOWN',
    ].join('\n');
    const preview = await service.previewImport(context('EXAM_CONTROLLER'), {
      fileName: 'invalid.csv', sourceText,
    });
    expect(preview).toMatchObject({ rowCount: 2, acceptedCount: 0, rejectedCount: 2 });
    expect(preview.errors.map((error) => [error.rowNumber, error.code])).toEqual(expect.arrayContaining([
      [2, 'EXISTING_ROLL'],
      [3, 'DUPLICATE_FILE_ROLL'],
      [3, 'UNKNOWN_COHORT'],
      [3, 'UNKNOWN_SUBJECT'],
    ]));
  });

  it('blocks the entire commit when any row is invalid', async () => {
    const commitImport = vi.fn();
    const service = new PeopleService(repository({
      importContext: vi.fn().mockResolvedValue(validation({ existingRolls: new Set(['NS26001']) })),
      commitImport,
    }));
    await expect(service.commitImport(context('INSTITUTION_ADMIN'), {
      fileName: 'students.csv', sourceText: validCsv,
    })).rejects.toThrow('no records were committed');
    expect(commitImport).not.toHaveBeenCalled();
  });

  it('commits resolved cohort and subject IDs', async () => {
    const commitImport = vi.fn().mockResolvedValue({ replayed: false });
    const service = new PeopleService(repository({ commitImport }));
    await service.commitImport(context('INSTITUTION_ADMIN'), {
      fileName: 'students.csv', sourceText: validCsv,
    });
    expect(commitImport).toHaveBeenCalledWith(
      tenantId,
      'students.csv',
      expect.stringMatching(/^[0-9a-f]{64}$/),
      [{
        rollNo: 'NS26001',
        name: 'Northstar Student 001',
        email: 'student.001@northstar.example.test',
        cohortId,
        subjectIds: [subjectId],
      }],
    );
  });

  it('returns the durable prior result on retry without creating records', async () => {
    const prior: StudentImportCommitResult = {
      importId: '77777777-7777-4777-8777-777777777777',
      contentHash: 'b'.repeat(64),
      rowCount: 1,
      createdCount: 1,
      enrolmentCount: 1,
      replayed: true,
      committedAt: '2026-09-13T12:00:00.000Z',
    };
    const commitImport = vi.fn();
    const service = new PeopleService(repository({
      importContext: vi.fn().mockResolvedValue(validation({ committed: prior })),
      commitImport,
    }));
    await expect(service.commitImport(context('INSTITUTION_ADMIN'), {
      fileName: 'students.csv', sourceText: validCsv,
    })).resolves.toEqual(prior);
    expect(commitImport).not.toHaveBeenCalled();
  });

  it('scopes student-role directory reads to the caller membership', async () => {
    const listStudents = vi.fn().mockResolvedValue({ students: [], total: 0, nextCursor: null });
    const service = new PeopleService(repository({ listStudents }));
    await expect(service.listStudents(context('STUDENT'))).resolves.toEqual({
      students: [], total: 0, nextCursor: null, pageSize: 25,
    });
    expect(listStudents).toHaveBeenCalledWith(tenantId, membershipId, '', 25, null);
  });

  it('validates and forwards student pagination and search parameters', async () => {
    const listStudents = vi.fn().mockResolvedValue({ students: [], total: 0, nextCursor: null });
    const service = new PeopleService(repository({ listStudents }));
    const cursor = '77777777-7777-4777-8777-777777777777';
    await service.listStudents(context('INSTITUTION_ADMIN'), '  Ada  ', cursor, '10');
    expect(listStudents).toHaveBeenCalledWith(tenantId, null, 'Ada', 10, cursor);
    await expect(
      service.listStudents(context('INSTITUTION_ADMIN'), '', undefined, '0'),
    ).rejects.toThrow('Student page size is invalid');
  });
});
