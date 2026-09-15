import type { AuthenticatedContext } from '@entropix/contracts';
import { PrismaClient } from '@entropix/db';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StudentPortalRepository } from './student-portal.repository.js';
import { StudentPortalService } from './student-portal.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const studentId = '33333333-3333-4333-8333-333333333333';
const examId = '44444444-4444-4444-8444-444444444444';
const registrationId = '55555555-5555-4555-8555-555555555555';
const publicationId = '66666666-6666-4666-8666-666666666666';
const runId = '77777777-7777-4777-8777-777777777777';

function context(role: 'STUDENT' | 'EXAM_CONTROLLER'): AuthenticatedContext {
  return {
    kind: 'TENANT',
    userId: '88888888-8888-4888-8888-888888888888',
    tenantId,
    membershipId,
    activeRole: role,
    grants: [{ role, departmentId: null }],
  };
}

function studentRow(state = 'SCHEDULE_PUBLISHED', scheduleRevision = 3) {
  return {
    id: studentId,
    rollNo: 'NS26001',
    name: 'Aarav Mehta',
    cohort: { name: 'Semester 3 · A' },
    tenant: { name: 'Northstar College', timezone: 'Asia/Kolkata' },
    registrations: [{
      id: registrationId,
      version: 4,
      reviewedAt: new Date('2026-09-10T08:00:00.000Z'),
      exam: {
        id: examId,
        code: 'NST-S3',
        name: 'Semester 3 Examination',
        state,
        scheduleRevision,
        term: { name: 'Semester 3', academicYear: { name: '2026–27' } },
      },
      subjects: [{
        id: '99999999-9999-4999-8999-999999999999',
        examSubject: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          subject: { code: 'CS301', name: 'Data Structures', credits: 3 },
          paper: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            startsAt: new Date('2026-09-15T04:30:00.000Z'),
            endsAt: new Date('2026-09-15T07:30:00.000Z'),
          },
        },
        seatAssignments: [{
          examPaperId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          seatNumber: 1,
          hallSitting: { hall: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', code: 'HA', name: 'Hall A' } },
        }],
      }],
    }],
  };
}

function currentPublication() {
  return {
    id: publicationId,
    version: 2,
    publishedAt: new Date('2026-09-20T08:00:00.000Z'),
    resultRunId: runId,
    exam: { id: examId, code: 'NST-S3', name: 'Semester 3 Examination', ruleVersion: { version: 1 } },
  };
}

function repositoryFixture(options: {
  student?: ReturnType<typeof studentRow> | null;
  publication?: ReturnType<typeof currentPublication> | null;
  outcome?: 'PASS' | 'WITHHELD';
} = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    student: { findFirst: vi.fn().mockResolvedValue(options.student === undefined ? studentRow() : options.student) },
    publication: { findFirst: vi.fn().mockResolvedValue(options.publication === undefined ? null : options.publication) },
    studentResult: { findFirst: vi.fn().mockResolvedValue({
      outcome: options.outcome ?? 'PASS',
      percentage: { toString: () => '74.5000' },
      gpa: { toString: () => '8.2' },
      totalCredits: { toString: () => '3' },
      reason: options.outcome === 'WITHHELD' ? 'Conduct review is pending.' : null,
    }) },
    resultItem: { findMany: vi.fn().mockResolvedValue([{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', subjectCode: 'CS301', subjectName: 'Data Structures', credits: 3, outcome: 'PASS', percentage: { toString: () => '74.5' }, components: [], grade: 'B', gradePoints: { toString: () => '8' }, reason: null }]) },
  };
  const prisma = {
    $transaction: vi.fn(async (operation: (value: typeof tx) => unknown) => operation(tx)),
  } as unknown as PrismaClient;
  return { repository: new StudentPortalRepository(prisma), tx };
}

describe('B04 student portal authorization and current documents', () => {
  it('uses only the server-resolved tenant and membership and denies non-student roles', async () => {
    const snapshot = vi.fn().mockResolvedValue({ registrations: [], timetables: [], result: null, documents: [] });
    const service = new StudentPortalService({ snapshot } as unknown as StudentPortalRepository);

    await service.snapshot(context('STUDENT'));
    expect(snapshot).toHaveBeenCalledWith(tenantId, membershipId);
    expect(() => service.snapshot(context('EXAM_CONTROLLER'))).toThrow(ForbiddenException);
  });

  it('returns only approved registration data and binds the admit issue to the current published revision', async () => {
    const { repository, tx } = repositoryFixture();
    const first = await repository.snapshot(tenantId, membershipId);
    expect(tx.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId, membershipId } }));
    expect(first.registrations).toHaveLength(1);
    expect(first.registrations[0]).toMatchObject({ state: 'APPROVED', examId });
    expect(first.timetables[0]).toMatchObject({ examId, scheduleRevision: 3 });
    expect(first.documents[0]).toMatchObject({ kind: 'ADMIT_CARD', sourceId: registrationId, version: 3, current: true });

    tx.student.findFirst.mockResolvedValue(studentRow('SCHEDULE_PUBLISHED', 4));
    const revised = await repository.snapshot(tenantId, membershipId);
    expect(revised.documents[0]?.issueId).not.toBe(first.documents[0]?.issueId);
    expect(revised.documents[0]?.version).toBe(4);
  });

  it('removes timetable and admit access while a revised schedule is not published', async () => {
    const { repository } = repositoryFixture({ student: studentRow('PREPARATION', 3) });
    const snapshot = await repository.snapshot(tenantId, membershipId);
    expect(snapshot.registrations).toHaveLength(1);
    expect(snapshot.timetables).toEqual([]);
    expect(snapshot.documents).toEqual([]);
  });

  it('requires an active current publication and approved registration for result visibility', async () => {
    const { repository, tx } = repositoryFixture({ publication: null });
    const snapshot = await repository.snapshot(tenantId, membershipId);
    expect(snapshot.result).toBeNull();
    expect(tx.publication.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId,
        isCurrent: true,
        exam: { state: 'PUBLISHED', registrations: { some: { studentId, state: 'APPROVED' } } },
      }),
    }));
    expect(snapshot.documents.some((document) => document.kind === 'GRADE_CARD')).toBe(false);
  });

  it('binds an eligible grade card to the immutable current publication version', async () => {
    const { repository } = repositoryFixture({ publication: currentPublication(), outcome: 'PASS' });
    const snapshot = await repository.snapshot(tenantId, membershipId);
    expect(snapshot.result).toEqual(expect.objectContaining({ outcome: 'PASS', publicationVersion: 2 }));
    expect(snapshot.documents.find((document) => document.kind === 'GRADE_CARD')).toMatchObject({
      sourceId: publicationId,
      version: 2,
      current: true,
    });
  });

  it('returns only a hold message for WITHHELD and never creates a grade card', async () => {
    const { repository, tx } = repositoryFixture({ publication: currentPublication(), outcome: 'WITHHELD' });
    const snapshot = await repository.snapshot(tenantId, membershipId);
    expect(snapshot.result).toEqual(expect.objectContaining({ outcome: 'WITHHELD', holdMessage: 'Conduct review is pending.' }));
    expect(snapshot.result).not.toHaveProperty('percentage');
    expect(snapshot.result).not.toHaveProperty('gpa');
    expect(snapshot.result).not.toHaveProperty('items');
    expect(tx.resultItem.findMany).not.toHaveBeenCalled();
    expect(snapshot.documents.some((document) => document.kind === 'GRADE_CARD')).toBe(false);
  });

  it('maps a missing resolved student profile to not found', async () => {
    const service = new StudentPortalService(repositoryFixture({ student: null }).repository);
    await expect(service.snapshot(context('STUDENT'))).rejects.toBeInstanceOf(NotFoundException);
  });
});
