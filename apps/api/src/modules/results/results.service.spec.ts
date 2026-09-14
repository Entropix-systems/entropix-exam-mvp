import type { AuthenticatedContext } from '@entropix/contracts';
import { ConflictException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildComputation, type ResultsRepository } from './results.repository.js';
import { ResultsService } from './results.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const examId = '33333333-3333-4333-8333-333333333333';
const runId = '44444444-4444-4444-8444-444444444444';

function context(role: 'EXAM_CONTROLLER' | 'FACULTY' | 'STUDENT'): AuthenticatedContext {
  return { kind: 'TENANT', userId: '55555555-5555-4555-8555-555555555555', tenantId, membershipId, activeRole: role, grants: [{ role, departmentId: null }] };
}

function repository(overrides: Partial<ResultsRepository> = {}): ResultsRepository {
  return { snapshot: vi.fn(), compute: vi.fn(), readRun: vi.fn(), publish: vi.fn(), withdraw: vi.fn(), currentStudent: vi.fn(), ...overrides } as unknown as ResultsRepository;
}

function examFixture() {
  const rule = {
    kind: 'VALIDATED_RESULT_RULE',
    components: [{ component: 'FINAL', maximum: '100', weight: '100', minimumPassPercentage: null }],
    totalPassPercentage: '40',
    gradeBands: [
      { grade: 'F', minInclusive: '0', maxExclusive: '40', maxInclusive: null, points: '0' },
      { grade: 'P', minInclusive: '40', maxExclusive: null, maxInclusive: '100', points: '5' },
    ],
  };
  const hallSitting = { attendanceBatch: { state: 'SUBMITTED' }, duties: [{ state: 'ACCEPTED' }], incidents: [] };
  const student = (id: string, rollNo: string, attendance: 'ABSENT' | 'PRESENT', held: boolean) => ({
    id: '6' + id.slice(1),
    registration: { studentId: id, student: { id, rollNo, name: 'Student ' + rollNo } },
    seatAssignments: [{ attendance: { state: attendance }, hallSitting }],
    incidentStudents: held ? [{ incident: { disposition: 'OPEN' } }] : [],
  });
  const absentId = '66666666-6666-4666-8666-666666666661';
  const heldId = '66666666-6666-4666-8666-666666666662';
  return {
    id: examId,
    code: 'CED-ANNUAL',
    name: 'Annual Examination',
    state: 'EVALUATION',
    inputRevision: 7,
    ruleVersionId: '77777777-7777-4777-8777-777777777777',
    ruleVersion: { id: '77777777-7777-4777-8777-777777777777', version: 1, config: rule },
    subjects: [{
      id: '88888888-8888-4888-8888-888888888888',
      subject: { code: 'MAT10', name: 'Mathematics', credits: 3 },
      marksBatch: { id: '99999999-9999-4999-8999-999999999999', version: 4, state: 'APPROVED', marks: [{ registrationSubjectId: '66666666-6666-4666-8666-666666666662', component: 'FINAL', value: { toString: () => '74' } }] },
      paper: { hallSittings: [hallSitting] },
      registrationSubjects: [student(absentId, 'CED001', 'ABSENT', false), student(heldId, 'CED002', 'PRESENT', true)],
    }],
    resultRuns: [],
    publications: [],
  };
}

describe('B03 result computation and publication service', () => {
  it('computes persisted input as explicit ABSENT and WITHHELD outcomes without numeric leakage', () => {
    const first = buildComputation(examFixture() as never);
    const second = buildComputation(examFixture() as never);
    expect(first.counts).toEqual({ pass: 0, fail: 0, absent: 1, withheld: 1 });
    expect(first.checksum).toBe(second.checksum);
    expect(first.items.map((item) => ({ outcome: item.outcome, percentage: item.percentage, grade: item.gradePoints, components: item.components.map((component) => component.mark) }))).toEqual([
      { outcome: 'ABSENT', percentage: null, grade: null, components: [null] },
      { outcome: 'WITHHELD', percentage: null, grade: null, components: [null] },
    ]);
    expect(first.students.find((student) => student.outcome === 'WITHHELD')).toMatchObject({ percentage: null, gpa: null, weightedPoints: null });
  });

  it('blocks a present student when a required approved mark is missing', () => {
    const fixture = examFixture();
    fixture.subjects[0]!.registrationSubjects[1]!.incidentStudents = [];
    fixture.subjects[0]!.marksBatch.marks = [];
    expect(() => buildComputation(fixture as never)).toThrow('missing required FINAL marks');
  });

  it('uses only controller authority and the server-resolved membership for compute', async () => {
    const compute = vi.fn().mockResolvedValue({ id: runId });
    const service = new ResultsService(repository({ compute }));
    await service.compute(context('EXAM_CONTROLLER'), examId);
    expect(compute).toHaveBeenCalledWith(tenantId, membershipId, examId, expect.any(Date));
    expect(() => service.compute(context('FACULTY'), examId)).toThrow('Only an institution administrator');
  });

  it('reports stale revisions as conflicts and passes repeated publish retries to idempotent persistence', async () => {
    const stale = new ResultsService(repository({ publish: vi.fn().mockRejectedValue(new Error('STALE_RUN')) }));
    await expect(stale.publish(context('EXAM_CONTROLLER'), runId)).rejects.toBeInstanceOf(ConflictException);
    const record = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', resultRunId: runId, version: 1 };
    const publish = vi.fn().mockResolvedValue(record);
    const service = new ResultsService(repository({ publish }));
    await expect(service.publish(context('EXAM_CONTROLLER'), runId)).resolves.toBe(record);
    await expect(service.publish(context('EXAM_CONTROLLER'), runId)).resolves.toBe(record);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('scopes withdrawal and student reads to the resolved actor', async () => {
    const withdraw = vi.fn().mockResolvedValue({ isCurrent: false });
    const currentStudent = vi.fn().mockResolvedValue(null);
    const service = new ResultsService(repository({ withdraw, currentStudent }));
    await service.withdraw(context('EXAM_CONTROLLER'), examId, { reason: 'Correction requested.' });
    expect(withdraw).toHaveBeenCalledWith(tenantId, membershipId, examId, 'Correction requested.', expect.any(Date));
    await service.currentStudent(context('STUDENT'));
    expect(currentStudent).toHaveBeenCalledWith(tenantId, membershipId);
    expect(() => service.currentStudent(context('EXAM_CONTROLLER'))).toThrow('active student role');
  });

  it('enforces immutable snapshots and one current publication in the migration', () => {
    const sql = readFileSync(resolve(process.cwd(), '../../packages/db/prisma/migrations/20260914143000_result_runs_publication/migration.sql'), 'utf8');
    expect(sql).toContain('CREATE UNIQUE INDEX "publications_one_current_per_exam_key"');
    expect(sql).toContain('WHERE "is_current"');
    expect(sql.match(/EXECUTE FUNCTION prevent_result_snapshot_mutation\(\)/g)).toHaveLength(3);
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
  });
});
