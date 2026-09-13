import type { AuthenticatedContext } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import { attendanceCountsAsAttended, incidentCreatesHold, type ConductRepository } from './conduct.repository.js';
import { ConductService } from './conduct.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const sittingId = '33333333-3333-4333-8333-333333333333';
const dutyId = '44444444-4444-4444-8444-444444444444';
const facultyId = '55555555-5555-4555-8555-555555555555';
const firstSeatId = '66666666-6666-4666-8666-666666666666';
const secondSeatId = '77777777-7777-4777-8777-777777777777';

function context(role: 'INVIGILATOR' | 'EXAM_CONTROLLER'): AuthenticatedContext {
  return { kind: 'TENANT', userId: '88888888-8888-4888-8888-888888888888', tenantId, membershipId, grants: [{ role, departmentId: null }] };
}

function repository(overrides: Partial<ConductRepository> = {}) {
  return {
    snapshot: vi.fn(), assignDuty: vi.fn(), respondDuty: vi.fn(), saveAttendance: vi.fn(), submitAttendance: vi.fn(),
    reopenAttendance: vi.fn(), createIncident: vi.fn(), disposeIncident: vi.fn(), resultState: vi.fn(),
    ...overrides,
  } as unknown as ConductRepository;
}

describe('ConductService core examination rules', () => {
  it('scopes invigilator reads and responses to the server-resolved membership', async () => {
    const snapshot = vi.fn().mockResolvedValue({ faculty: [], sittings: [] });
    const respondDuty = vi.fn().mockResolvedValue({ id: dutyId });
    const service = new ConductService(repository({ snapshot, respondDuty }), () => new Date('2026-09-15T05:00:00.000Z'));
    await service.list(context('INVIGILATOR'));
    await service.accept(context('INVIGILATOR'), dutyId);
    expect(snapshot).toHaveBeenCalledWith(tenantId, { membershipId, controller: false }, new Date('2026-09-15T05:00:00.000Z'));
    expect(respondDuty).toHaveBeenCalledWith(tenantId, membershipId, dutyId, 'ACCEPTED', null, new Date('2026-09-15T05:00:00.000Z'));
  });

  it('denies roster work when the repository proves the invigilator is unassigned', async () => {
    const service = new ConductService(repository({ saveAttendance: vi.fn().mockRejectedValue(new Error('NOT_ASSIGNED')) }));
    await expect(service.saveAttendance(context('INVIGILATOR'), sittingId, { expectedVersion: 0, rows: [] })).rejects.toThrow('assigned accepted invigilator');
  });

  it('rejects overlapping active faculty duties', async () => {
    const service = new ConductService(repository({ assignDuty: vi.fn().mockRejectedValue(new Error('DUTY_OVERLAP')) }));
    await expect(service.assign(context('EXAM_CONTROLLER'), sittingId, { facultyId })).rejects.toThrow('overlapping active duty');
  });

  it('blocks submission while NOT_MARKED remains', async () => {
    const service = new ConductService(repository({ submitAttendance: vi.fn().mockRejectedValue(new Error('NOT_MARKED_REMAINS')) }));
    await expect(service.submitAttendance(context('INVIGILATOR'), sittingId, { expectedVersion: 2 })).rejects.toThrow('PRESENT, ABSENT, or LATE');
  });

  it('keeps ABSENT non-attended and counts LATE as attended', async () => {
    const saveAttendance = vi.fn().mockResolvedValue({ id: sittingId });
    const service = new ConductService(repository({ saveAttendance }));
    await service.saveAttendance(context('INVIGILATOR'), sittingId, { expectedVersion: 1, rows: [
      { seatAssignmentId: firstSeatId, state: 'ABSENT' },
      { seatAssignmentId: secondSeatId, state: 'LATE' },
    ] });
    expect(saveAttendance.mock.calls[0]?.[3].rows.map((row: { state: string }) => row.state)).toEqual(['ABSENT', 'LATE']);
    expect(attendanceCountsAsAttended('ABSENT')).toBe(false);
    expect(attendanceCountsAsAttended('LATE')).toBe(true);
  });

  it('derives holds only from open and retain-WITHHELD dispositions', () => {
    expect(incidentCreatesHold('OPEN')).toBe(true);
    expect(incidentCreatesHold('RETAIN_WITHHELD')).toBe(true);
    expect(incidentCreatesHold('CLEARED')).toBe(false);
    expect(incidentCreatesHold('NO_RESULT_IMPACT')).toBe(false);
  });

  it('does not allow conduct data to change after result publication', async () => {
    const service = new ConductService(repository({ reopenAttendance: vi.fn().mockRejectedValue(new Error('RESULTS_PUBLISHED')) }));
    await expect(service.reopenAttendance(context('EXAM_CONTROLLER'), sittingId, { expectedVersion: 3, reason: 'Correction requested after publication.' })).rejects.toThrow('Withdraw published results');
  });
});
