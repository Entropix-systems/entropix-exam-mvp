import type { AllocationPreview, AuthenticatedContext } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import { intervalsOverlap, planDeterministicSeats, type SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const examId = '33333333-3333-4333-8333-333333333333';
const paperId = '44444444-4444-4444-8444-444444444444';
const hallId = '55555555-5555-4555-8555-555555555555';
const registrationSubjectId = '66666666-6666-4666-8666-666666666666';
const studentId = '77777777-7777-4777-8777-777777777777';

const context: AuthenticatedContext = {
  kind: 'TENANT',
  userId: '88888888-8888-4888-8888-888888888888',
  tenantId,
  membershipId,
  grants: [{ role: 'EXAM_CONTROLLER', departmentId: null }],
};
const preview: AllocationPreview = {
  examPaperId: paperId,
  expectedVersion: 2,
  rosterCount: 1,
  totalCapacity: 30,
  unallocatedCount: 0,
  assignments: [{
    id: null,
    registrationSubjectId,
    studentId,
    rollNo: 'NS26001',
    studentName: 'Aarav Sharma',
    hallSittingId: null,
    hallId,
    hallCode: 'HALL-A',
    hallName: 'Hall A',
    seatNumber: 1,
  }],
};

function repository(overrides: Partial<SchedulingRepository> = {}) {
  return {
    snapshot: vi.fn(),
    initializeExam: vi.fn(),
    createHall: vi.fn(),
    updatePaperSchedule: vi.fn(),
    previewAllocation: vi.fn().mockResolvedValue(preview),
    commitAllocation: vi.fn().mockResolvedValue({ id: paperId }),
    publish: vi.fn(),
    ...overrides,
  } as unknown as SchedulingRepository;
}

describe('SchedulingService timetable and allocation rules', () => {
  it('returns a deterministic successful allocation preview in roll-number order', async () => {
    const previewAllocation = vi.fn().mockResolvedValue(preview);
    const service = new SchedulingService(repository({ previewAllocation }));
    await expect(service.preview(context, paperId, { hallIds: [hallId], expectedVersion: 2 })).resolves.toEqual(preview);
    expect(previewAllocation).toHaveBeenCalledWith(tenantId, paperId, [hallId], 2);
    expect(preview.assignments.map((seat) => `${seat.rollNo}:${seat.seatNumber}`)).toEqual(['NS26001:1']);
  });

  it('fills selected rooms in order and restarts numbering for each hall', () => {
    const roster = ['01', '02', '03'].map((suffix) => ({ registrationSubjectId: `66666666-6666-4666-8666-6666666666${suffix}`.slice(0, 36), studentId, rollNo: `NS260${suffix}`, studentName: `Student ${suffix}` }));
    const plan = planDeterministicSeats(roster, [
      { id: hallId, code: 'HALL-A', name: 'Hall A', capacity: 2 },
      { id: examId, code: 'HALL-B', name: 'Hall B', capacity: 1 },
    ]);
    expect(plan.map((seat) => `${seat.hallCode}:${seat.seatNumber}:${seat.rollNo}`)).toEqual(['HALL-A:1:NS26001', 'HALL-A:2:NS26002', 'HALL-B:1:NS26003']);
  });

  it('blocks an over-capacity allocation at atomic commit', async () => {
    const service = new SchedulingService(repository({ commitAllocation: vi.fn().mockRejectedValue(new Error('INSUFFICIENT_CAPACITY')) }));
    await expect(service.commit(context, paperId, { hallIds: [hallId], expectedVersion: 2 })).rejects.toThrow('do not have enough seats');
  });

  it('reports a student overlap from the server-side recheck', async () => {
    const service = new SchedulingService(repository({ updatePaperSchedule: vi.fn().mockRejectedValue(new Error('STUDENT_OVERLAP')) }));
    await expect(service.updatePaper(context, paperId, { startsAt: '2026-09-15T04:30:00.000Z', endsAt: '2026-09-15T07:30:00.000Z', expectedVersion: 1 })).rejects.toThrow('registered student has an overlapping paper');
  });

  it('reports a hall overlap from the server-side recheck', async () => {
    const service = new SchedulingService(repository({ commitAllocation: vi.fn().mockRejectedValue(new Error('HALL_OVERLAP')) }));
    await expect(service.commit(context, paperId, { hallIds: [hallId], expectedVersion: 1 })).rejects.toThrow('hall is already used');
  });

  it('uses half-open intervals so back-to-back papers do not overlap', () => {
    const firstStart = new Date('2026-09-15T04:30:00.000Z');
    const boundary = new Date('2026-09-15T07:30:00.000Z');
    const secondEnd = new Date('2026-09-15T10:30:00.000Z');
    expect(intervalsOverlap(firstStart, boundary, boundary, secondEnd)).toBe(false);
    expect(intervalsOverlap(firstStart, secondEnd, boundary, secondEnd)).toBe(true);
  });

  it('refuses publication while any approved roster row remains unallocated', async () => {
    const service = new SchedulingService(repository({ publish: vi.fn().mockRejectedValue(new Error('SCHEDULE_NOT_READY')) }));
    await expect(service.publish(context, examId, { expectedVersion: 4 })).rejects.toThrow('must have a scheduled seat');
  });
});
