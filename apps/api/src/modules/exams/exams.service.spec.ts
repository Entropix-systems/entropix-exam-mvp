import type { AuthenticatedContext, RegistrationRecord } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ExamsRepository, RegistrationEligibilityContext } from './exams.repository.js';
import { ExamsService } from './exams.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const studentId = '33333333-3333-4333-8333-333333333333';
const registrationId = '44444444-4444-4444-8444-444444444444';
const examId = '55555555-5555-4555-8555-555555555555';
const termId = '66666666-6666-4666-8666-666666666666';
const examSubjectId = '77777777-7777-4777-8777-777777777777';
const enrolmentId = '88888888-8888-4888-8888-888888888888';

function context(role: 'STUDENT' | 'EXAM_CONTROLLER'): AuthenticatedContext {
  return { kind: 'TENANT', userId: '99999999-9999-4999-8999-999999999999', tenantId, membershipId, grants: [{ role, departmentId: null }] };
}
function registration(overrides: Partial<RegistrationRecord> = {}): RegistrationRecord {
  return {
    id: registrationId, examId, studentId, student: { rollNo: 'NS26001', name: 'Aarav Sharma' },
    state: 'SUBMITTED', version: 2, controllerEligible: true, controllerEligibilityReason: null,
    eligibilitySnapshot: null, submittedAt: null, reviewedByMembershipId: null, reviewedAt: null, decisionReason: null,
    subjects: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', examSubjectId, enrolmentId, subjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: 'CS301', name: 'Data Structures' }],
    ...overrides,
  };
}
function eligibility(overrides: Partial<RegistrationEligibilityContext> = {}): RegistrationEligibilityContext {
  return {
    registration: registration(), studentStatus: 'ACTIVE', studentTermId: termId, examTermId: termId,
    examState: 'REGISTRATION_OPEN', registrationOpensAt: new Date('2020-01-01'), registrationClosesAt: new Date('2099-01-01'),
    selected: [{ examSubjectId, enrolmentId, enrolmentStatus: 'ACTIVE' }], ...overrides,
  };
}
function repository(overrides: Partial<ExamsRepository> = {}) {
  return {
    snapshot: vi.fn().mockResolvedValue({ exams: [] }), createExam: vi.fn(), openRegistration: vi.fn(), closeRegistration: vi.fn(),
    studentIdForMembership: vi.fn().mockResolvedValue(studentId), saveDraft: vi.fn(), eligibilityContext: vi.fn().mockResolvedValue(eligibility()),
    transition: vi.fn().mockResolvedValue(registration({ state: 'APPROVED' })), setControllerEligibility: vi.fn(), autoEnrol: vi.fn(),
    ...overrides,
  } as unknown as ExamsRepository;
}

describe('ExamsService eligibility and transitions', () => {
  it('submits an eligible student registration with retained decision evidence', async () => {
    const transition = vi.fn().mockResolvedValue(registration({ state: 'SUBMITTED' }));
    const service = new ExamsService(repository({ transition }));
    await service.submit(context('STUDENT'), registrationId);
    expect(transition).toHaveBeenCalledWith(tenantId, registrationId, ['DRAFT', 'REJECTED'], 'SUBMITTED', expect.objectContaining({
      eligible: true,
      examSubjectIds: [examSubjectId],
      enrolmentIds: [enrolmentId],
      checks: expect.arrayContaining([expect.objectContaining({ code: 'ACTIVE_STUDENT', passed: true })]),
    }), null, null);
  });

  it('rejects inactive students on the server before approval', async () => {
    const transition = vi.fn();
    const service = new ExamsService(repository({ eligibilityContext: vi.fn().mockResolvedValue(eligibility({ studentStatus: 'INACTIVE' })), transition }));
    await expect(service.approve(context('EXAM_CONTROLLER'), registrationId, {})).rejects.toThrow('not eligible');
    expect(transition).not.toHaveBeenCalled();
  });

  it('rejects submission after the registration window closes', async () => {
    const service = new ExamsService(repository({ eligibilityContext: vi.fn().mockResolvedValue(eligibility({ registrationClosesAt: new Date('2020-02-01') })) }));
    await expect(service.submit(context('STUDENT'), registrationId)).rejects.toThrow('window is closed');
  });

  it('does not expose a foreign or differently-owned registration to a student', async () => {
    const foreign = registration({ studentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    const service = new ExamsService(repository({ eligibilityContext: vi.fn().mockResolvedValue(eligibility({ registration: foreign })) }));
    await expect(service.submit(context('STUDENT'), registrationId)).rejects.toThrow('Registration not found');
  });

  it('requires a reason when the controller marks a registration ineligible', async () => {
    const service = new ExamsService(repository());
    await expect(service.setEligibility(context('EXAM_CONTROLLER'), registrationId, { eligible: false })).rejects.toThrow('reason is required');
  });

  it('creates approved Cedar registrations through the validated auto-enrol command', async () => {
    const autoEnrol = vi.fn().mockResolvedValue(20);
    const service = new ExamsService(repository({ autoEnrol }));
    await expect(service.autoEnrol(context('EXAM_CONTROLLER'), examId)).resolves.toEqual({ createdCount: 20 });
    expect(autoEnrol).toHaveBeenCalledWith(tenantId, examId, expect.any(Date));
  });
});
