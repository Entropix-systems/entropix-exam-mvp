import type { AuthenticatedContext } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { EvaluationRepository } from './evaluation.repository.js';
import { EvaluationService, normalizeMarkValue } from './evaluation.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const otherMembershipId = '33333333-3333-4333-8333-333333333333';
const examSubjectId = '44444444-4444-4444-8444-444444444444';
const registrationSubjectId = '55555555-5555-4555-8555-555555555555';
const departmentId = '77777777-7777-4777-8777-777777777777';

function context(role: 'FACULTY' | 'EXAM_CONTROLLER' | 'DEPARTMENT_ADMIN', currentMembershipId = membershipId): AuthenticatedContext {
  return {
    kind: 'TENANT',
    userId: '88888888-8888-4888-8888-888888888888',
    tenantId,
    membershipId: currentMembershipId,
    activeRole: role,
    grants: [{ role, departmentId: role === 'DEPARTMENT_ADMIN' ? departmentId : null }],
  };
}

function repository(overrides: Partial<EvaluationRepository> = {}) {
  return {
    snapshot: vi.fn(),
    assign: vi.fn(),
    save: vi.fn(),
    submit: vi.fn(),
    review: vi.fn(),
    reopen: vi.fn(),
    ...overrides,
  } as unknown as EvaluationRepository;
}

describe('EvaluationService marks entry and independent review', () => {
  it('normalizes decimal marks without accepting negative, exponent, or over-precision input', () => {
    expect(normalizeMarkValue('39.5000')).toBe('39.5');
    for (const invalid of ['-1', '1e2', '10.00001', ' 10']) expect(() => normalizeMarkValue(invalid)).toThrow('four decimal places');
  });

  it('uses the server-resolved membership for assigned-examiner saves', async () => {
    const save = vi.fn().mockResolvedValue({ id: examSubjectId });
    const service = new EvaluationService(repository({ save }));
    await service.save(context('FACULTY'), examSubjectId, {
      expectedVersion: 0,
      rows: [{ registrationSubjectId, marks: [{ component: 'FINAL', value: '74.00' }] }],
    });
    expect(save).toHaveBeenCalledWith(
      tenantId,
      membershipId,
      examSubjectId,
      { expectedVersion: 0, rows: [{ registrationSubjectId, marks: [{ component: 'FINAL', value: '74' }] }] },
      expect.any(Date),
    );
  });

  it('uses only the active role while assignment membership scopes examiner records', async () => {
    const service = new EvaluationService(repository({ snapshot: vi.fn() }));
    const inactiveFacultyContext: AuthenticatedContext = {
      ...context('EXAM_CONTROLLER'),
      activeRole: 'STUDENT',
      grants: [
        { role: 'EXAM_CONTROLLER', departmentId: null },
        { role: 'FACULTY', departmentId: null },
        { role: 'STUDENT', departmentId: null },
      ],
    };

    expect(() => service.list(inactiveFacultyContext)).toThrow('Permission denied');
  });

  it('rejects unassigned faculty and out-of-range marks reported by persistence validation', async () => {
    const unassigned = new EvaluationService(repository({ save: vi.fn().mockRejectedValue(new Error('NOT_ASSIGNED')) }));
    await expect(unassigned.save(context('FACULTY'), examSubjectId, { expectedVersion: 0, rows: [] })).rejects.toThrow('Permission denied');
    const ranged = new EvaluationService(repository({ save: vi.fn().mockRejectedValue(new Error('MARK_OUT_OF_RANGE')) }));
    await expect(ranged.save(context('FACULTY'), examSubjectId, { expectedVersion: 0, rows: [] })).rejects.toThrow('mark out of range');
  });

  it('blocks incomplete or attendance-inconsistent submission', async () => {
    const incomplete = new EvaluationService(repository({ submit: vi.fn().mockRejectedValue(new Error('INCOMPLETE_MARKS')) }));
    await expect(incomplete.submit(context('FACULTY'), examSubjectId, { expectedVersion: 2 })).rejects.toThrow('Every attending student');
    const conduct = new EvaluationService(repository({ submit: vi.fn().mockRejectedValue(new Error('CONDUCT_INCOMPLETE')) }));
    await expect(conduct.submit(context('FACULTY'), examSubjectId, { expectedVersion: 2 })).rejects.toThrow('Submitted attendance is required');
  });

  it('preserves department scope for reviewer return commands', async () => {
    const review = vi.fn().mockResolvedValue({ state: 'RETURNED' });
    const service = new EvaluationService(repository({ review }));
    await service.returnBatch(context('DEPARTMENT_ADMIN'), examSubjectId, { expectedVersion: 3, reason: 'External mark needs correction.' });
    expect(review).toHaveBeenCalledWith(
      tenantId,
      { membershipId, examiner: false, controller: false, departmentIds: [departmentId] },
      examSubjectId,
      'RETURNED',
      { expectedVersion: 3, reason: 'External mark needs correction.' },
      expect.any(Date),
    );
  });

  it('rejects stale review versions and self approval', async () => {
    const stale = new EvaluationService(repository({ review: vi.fn().mockRejectedValue(new Error('STALE_VERSION')) }));
    await expect(stale.approve(context('EXAM_CONTROLLER'), examSubjectId, { expectedVersion: 1, reason: 'Checked against the roster.' })).rejects.toThrow('reload');
    const self = new EvaluationService(repository({ review: vi.fn().mockRejectedValue(new Error('SELF_APPROVAL')) }));
    await expect(self.approve(context('EXAM_CONTROLLER'), examSubjectId, { expectedVersion: 2, reason: 'Checked against the roster.' })).rejects.toThrow('cannot approve');
  });

  it('allows an independently scoped controller to approve using their own membership', async () => {
    const review = vi.fn().mockResolvedValue({ state: 'APPROVED' });
    const service = new EvaluationService(repository({ review }));
    await service.approve(context('EXAM_CONTROLLER', otherMembershipId), examSubjectId, { expectedVersion: 4, reason: 'Roster and components verified.' });
    expect(review).toHaveBeenCalledWith(
      tenantId,
      { membershipId: otherMembershipId, examiner: false, controller: true, departmentIds: [] },
      examSubjectId,
      'APPROVED',
      { expectedVersion: 4, reason: 'Roster and components verified.' },
      expect.any(Date),
    );
  });
});
