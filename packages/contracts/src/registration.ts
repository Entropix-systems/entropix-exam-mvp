import type { UUID } from './common.js';

export const REGISTRATION_MODES = {
  AUTO_ENROL: 'AUTO_ENROL',
  APPLICATION: 'APPLICATION',
} as const;

export type RegistrationMode =
  (typeof REGISTRATION_MODES)[keyof typeof REGISTRATION_MODES];

export const REGISTRATION_STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type RegistrationState =
  (typeof REGISTRATION_STATES)[keyof typeof REGISTRATION_STATES];

export const ELIGIBILITY_CHECK_CODES = {
  ACTIVE_STUDENT: 'ACTIVE_STUDENT',
  CORRECT_TERM_COHORT: 'CORRECT_TERM_COHORT',
  ACTIVE_ENROLMENT: 'ACTIVE_ENROLMENT',
  CONTROLLER_ELIGIBLE: 'CONTROLLER_ELIGIBLE',
} as const;

export type EligibilityCheckCode =
  (typeof ELIGIBILITY_CHECK_CODES)[keyof typeof ELIGIBILITY_CHECK_CODES];

export interface EligibilityCheckResult {
  code: EligibilityCheckCode;
  passed: boolean;
  reason: string;
}

export interface EligibilitySnapshot {
  evaluatedAt: string;
  eligible: boolean;
  checks: readonly EligibilityCheckResult[];
  examSubjectIds: readonly UUID[];
  enrolmentIds: readonly UUID[];
}

export interface RegistrationSubjectRecord {
  id: UUID;
  examSubjectId: UUID;
  enrolmentId: UUID;
  subjectId: UUID;
  code: string;
  name: string;
}

export interface RegistrationRecord {
  id: UUID;
  examId: UUID;
  studentId: UUID;
  student: { rollNo: string; name: string };
  state: RegistrationState;
  version: number;
  controllerEligible: boolean;
  controllerEligibilityReason: string | null;
  eligibilitySnapshot: EligibilitySnapshot | null;
  submittedAt: string | null;
  reviewedByMembershipId: UUID | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  subjects: readonly RegistrationSubjectRecord[];
}

export interface RegistrationDraftInput {
  examSubjectIds: readonly UUID[];
}

export interface RegistrationEligibilityInput {
  eligible: boolean;
  reason?: string;
}

export interface RegistrationDecisionInput {
  reason?: string;
}
