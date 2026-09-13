import type { AuthenticatedContext, EligibilitySnapshot, ExamCreateInput, RegistrationDecisionInput, RegistrationDraftInput, RegistrationEligibilityInput, ResultRuleInput, UUID } from '@entropix/contracts';
import { isUuid, validateResultRule } from '@entropix/domain';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ExamsRepository, type RegistrationEligibilityContext } from './exams.repository.js';

function tenant(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT') throw new ForbiddenException('Permission denied');
  return context;
}
function hasRole(context: AuthenticatedContext, roles: readonly string[]) {
  return context.kind === 'TENANT' && context.grants.some((grant) => roles.includes(grant.role));
}
function controller(context: AuthenticatedContext) {
  if (!hasRole(context, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'])) throw new ForbiddenException('Permission denied');
  return tenant(context);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnprocessableEntityException('Request body must be an object');
  return value as Record<string, unknown>;
}
function requiredText(value: unknown, name: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw new UnprocessableEntityException(`${name} is invalid`);
  return value;
}
function uuid(value: unknown, name: string): UUID {
  if (typeof value !== 'string' || !isUuid(value)) throw new UnprocessableEntityException(`${name} is invalid`);
  return value.toLowerCase();
}
function uuidArray(value: unknown, field: string): UUID[] {
  if (!Array.isArray(value)) throw new UnprocessableEntityException(`${field} must be an array`);
  return value.map((entry) => uuid(entry, field));
}
function parseDraft(body: unknown): RegistrationDraftInput { return { examSubjectIds: uuidArray(object(body).examSubjectIds, 'examSubjectIds') }; }
function parseDecision(body: unknown): RegistrationDecisionInput {
  const value = object(body);
  return { reason: value.reason === undefined ? undefined : requiredText(value.reason, 'reason', 500) };
}
function parseEligibility(body: unknown): RegistrationEligibilityInput {
  const value = object(body);
  if (typeof value.eligible !== 'boolean') throw new UnprocessableEntityException('eligible must be boolean');
  const reason = value.reason === undefined ? undefined : requiredText(value.reason, 'reason', 500);
  if (!value.eligible && !reason) throw new UnprocessableEntityException('reason is required when ineligible');
  return { eligible: value.eligible, reason };
}
function parseRule(value: unknown): ResultRuleInput {
  const rule = object(value);
  if (!Array.isArray(rule.components) || !Array.isArray(rule.gradeBands)) throw new UnprocessableEntityException('Result rule components and grade bands are required');
  return rule as unknown as ResultRuleInput;
}
function parseExam(body: unknown): ExamCreateInput {
  const value = object(body);
  if (value.registrationMode !== 'APPLICATION' && value.registrationMode !== 'AUTO_ENROL') throw new UnprocessableEntityException('registrationMode is invalid');
  const registrationOpensAt = requiredText(value.registrationOpensAt, 'registrationOpensAt');
  const registrationClosesAt = requiredText(value.registrationClosesAt, 'registrationClosesAt');
  if (!Number.isFinite(Date.parse(registrationOpensAt)) || !Number.isFinite(Date.parse(registrationClosesAt)) || Date.parse(registrationOpensAt) >= Date.parse(registrationClosesAt)) throw new UnprocessableEntityException('Registration window is invalid');
  const subjectIds = uuidArray(value.subjectIds, 'subjectIds');
  if (!subjectIds.length) throw new UnprocessableEntityException('At least one subject is required');
  return {
    termId: uuid(value.termId, 'termId'), code: requiredText(value.code, 'code', 32).toUpperCase(), name: requiredText(value.name, 'name'),
    registrationMode: value.registrationMode, registrationOpensAt, registrationClosesAt, subjectIds, rule: parseRule(value.rule),
  };
}
function eligibilitySnapshot(context: RegistrationEligibilityContext, now: Date): EligibilitySnapshot {
  const active = context.studentStatus === 'ACTIVE';
  const correctTerm = context.studentTermId === context.examTermId;
  const activeEnrolments = context.selected.length > 0 && context.selected.every((entry) => entry.enrolmentStatus === 'ACTIVE');
  const checks: EligibilitySnapshot['checks'] = [
    { code: 'ACTIVE_STUDENT', passed: active, reason: active ? 'Student is active.' : 'Student is inactive.' },
    { code: 'CORRECT_TERM_COHORT', passed: correctTerm, reason: correctTerm ? 'Student cohort belongs to the exam term.' : 'Student cohort does not belong to the exam term.' },
    { code: 'ACTIVE_ENROLMENT', passed: activeEnrolments, reason: activeEnrolments ? 'Selected subjects have active enrolments.' : 'One or more selected subjects lack an active enrolment.' },
    { code: 'CONTROLLER_ELIGIBLE', passed: context.registration.controllerEligible, reason: context.registration.controllerEligibilityReason ?? (context.registration.controllerEligible ? 'Controller eligibility flag allows registration.' : 'Controller eligibility flag denies registration.') },
  ];
  return {
    evaluatedAt: now.toISOString(), eligible: checks.every((check) => check.passed), checks,
    examSubjectIds: context.selected.map((entry) => entry.examSubjectId), enrolmentIds: context.selected.map((entry) => entry.enrolmentId),
  };
}

@Injectable()
export class ExamsService {
  constructor(private readonly repository: ExamsRepository) {}

  list(context: AuthenticatedContext) {
    const current = tenant(context);
    if (!hasRole(context, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY', 'STUDENT', 'AUDITOR'])) throw new ForbiddenException('Permission denied');
    const studentOnly = hasRole(context, ['STUDENT']) && !hasRole(context, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER']);
    return this.repository.snapshot(current.tenantId, studentOnly ? current.membershipId : null);
  }
  async create(context: AuthenticatedContext, body: unknown) {
    const current = controller(context);
    try {
      const input = parseExam(body);
      return await this.repository.createExam(current.tenantId, input, validateResultRule(input.rule));
    } catch (error) {
      if (error instanceof Error && ['INVALID_TERM', 'INVALID_SUBJECT'].includes(error.message)) throw new UnprocessableEntityException('Exam term or subjects are invalid');
      if (error instanceof Error && error.message === 'IDEMPOTENCY_CONFLICT') throw new ConflictException('Exam code already exists with different input');
      if (error instanceof Error && error.name === 'RuleValidationError') throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }
  async open(context: AuthenticatedContext, id: string) {
    const current = controller(context);
    const result = await this.repository.openRegistration(current.tenantId, uuid(id, 'examId'));
    if (!result) throw new ConflictException('Exam must be in DRAFT state');
    return result;
  }
  async close(context: AuthenticatedContext, id: string) {
    const current = controller(context);
    const result = await this.repository.closeRegistration(current.tenantId, uuid(id, 'examId'));
    if (!result) throw new ConflictException('Registration is not open');
    return result;
  }
  async saveDraft(context: AuthenticatedContext, examIdValue: string, body: unknown) {
    const current = tenant(context);
    if (!hasRole(context, ['STUDENT'])) throw new ForbiddenException('Permission denied');
    const studentId = await this.repository.studentIdForMembership(current.tenantId, current.membershipId);
    if (!studentId) throw new NotFoundException('Student profile not found');
    try { return await this.repository.saveDraft(current.tenantId, uuid(examIdValue, 'examId'), studentId, parseDraft(body).examSubjectIds); }
    catch (error) { return this.mapBusiness(error); }
  }
  async submit(context: AuthenticatedContext, id: string) {
    const current = tenant(context);
    if (!hasRole(context, ['STUDENT'])) throw new ForbiddenException('Permission denied');
    const registrationId = uuid(id, 'registrationId');
    const source = await this.ownedEligibilityContext(current.tenantId, registrationId, current.membershipId);
    const now = new Date();
    if (source.examState !== 'REGISTRATION_OPEN' || now < source.registrationOpensAt || now > source.registrationClosesAt) throw new UnprocessableEntityException('Registration window is closed');
    const snapshot = eligibilitySnapshot(source, now);
    if (!snapshot.eligible) throw new UnprocessableEntityException('Registration is not eligible');
    const result = await this.repository.transition(current.tenantId, registrationId, ['DRAFT', 'REJECTED'], 'SUBMITTED', snapshot, null, null);
    if (!result) throw new ConflictException('Registration cannot be submitted from its current state');
    return result;
  }
  async approve(context: AuthenticatedContext, id: string, body: unknown) {
    const current = controller(context); const registrationId = uuid(id, 'registrationId');
    const snapshot = eligibilitySnapshot(await this.requiredEligibilityContext(current.tenantId, registrationId), new Date());
    if (!snapshot.eligible) throw new UnprocessableEntityException('Registration is not eligible');
    const result = await this.repository.transition(current.tenantId, registrationId, ['SUBMITTED'], 'APPROVED', snapshot, current.membershipId, parseDecision(body).reason ?? null);
    if (!result) throw new ConflictException('Only a submitted registration may be approved');
    return result;
  }
  async reject(context: AuthenticatedContext, id: string, body: unknown) {
    const current = controller(context); const input = parseDecision(body);
    if (!input.reason) throw new UnprocessableEntityException('A rejection reason is required');
    const result = await this.repository.transition(current.tenantId, uuid(id, 'registrationId'), ['SUBMITTED'], 'REJECTED', null, current.membershipId, input.reason);
    if (!result) throw new ConflictException('Only a submitted registration may be rejected');
    return result;
  }
  async cancel(context: AuthenticatedContext, id: string, body: unknown) {
    const current = controller(context); const input = parseDecision(body);
    const result = await this.repository.transition(current.tenantId, uuid(id, 'registrationId'), ['APPROVED'], 'CANCELLED', null, current.membershipId, input.reason ?? 'Cancelled by controller');
    if (!result) throw new ConflictException('Only an approved registration may be cancelled');
    return result;
  }
  async setEligibility(context: AuthenticatedContext, id: string, body: unknown) {
    const current = controller(context); const input = parseEligibility(body);
    const result = await this.repository.setControllerEligibility(current.tenantId, uuid(id, 'registrationId'), input.eligible, input.reason ?? null);
    if (!result) throw new ConflictException('Eligibility cannot be changed in the current state');
    return result;
  }
  async autoEnrol(context: AuthenticatedContext, id: string) {
    const current = controller(context);
    try { return { createdCount: await this.repository.autoEnrol(current.tenantId, uuid(id, 'examId'), new Date()) }; }
    catch (error) { return this.mapBusiness(error); }
  }
  private async requiredEligibilityContext(tenantId: UUID, registrationId: UUID) {
    const context = await this.repository.eligibilityContext(tenantId, registrationId);
    if (!context) throw new NotFoundException('Registration not found');
    return context;
  }
  private async ownedEligibilityContext(tenantId: UUID, registrationId: UUID, membershipId: UUID) {
    const context = await this.requiredEligibilityContext(tenantId, registrationId);
    const studentId = await this.repository.studentIdForMembership(tenantId, membershipId);
    if (!studentId || context.registration.studentId !== studentId) throw new NotFoundException('Registration not found');
    return context;
  }
  private mapBusiness(error: unknown): never {
    const code = error instanceof Error ? error.message : '';
    if (code === 'EXAM_NOT_FOUND' || code === 'STUDENT_NOT_FOUND') throw new NotFoundException('Exam or student not found');
    if (['REGISTRATION_CLOSED', 'INVALID_SUBJECT', 'UNENROLLED_SUBJECT', 'APPLICATION_MODE_REQUIRED', 'AUTO_ENROL_MODE_REQUIRED'].includes(code)) throw new UnprocessableEntityException(code.replaceAll('_', ' ').toLowerCase());
    if (code === 'INVALID_TRANSITION') throw new ConflictException('Registration cannot be revised from its current state');
    throw error;
  }
}
