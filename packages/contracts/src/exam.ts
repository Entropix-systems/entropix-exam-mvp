import type { UUID } from './common.js';
import type { ResultRuleInput, ValidatedResultRule } from './results.js';
import type { RegistrationMode, RegistrationRecord } from './registration.js';

export const EXAM_STATES = {
  DRAFT: 'DRAFT',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  PREPARATION: 'PREPARATION',
  SCHEDULE_PUBLISHED: 'SCHEDULE_PUBLISHED',
  EVALUATION: 'EVALUATION',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const;

export type ExamState =
  (typeof EXAM_STATES)[keyof typeof EXAM_STATES];

export interface ExamCreateInput {
  termId: UUID;
  code: string;
  name: string;
  registrationMode: RegistrationMode;
  registrationOpensAt: string;
  registrationClosesAt: string;
  subjectIds: readonly UUID[];
  rule: ResultRuleInput;
}

export interface ExamSubjectRecord {
  id: UUID;
  subjectId: UUID;
  code: string;
  name: string;
  credits: number;
}

export interface RuleVersionRecord {
  id: UUID;
  version: number;
  config: ValidatedResultRule;
  frozenAt: string | null;
}

export interface ExamRecord {
  id: UUID;
  termId: UUID;
  code: string;
  name: string;
  registrationMode: RegistrationMode;
  state: ExamState;
  registrationOpensAt: string;
  registrationClosesAt: string;
  version: number;
  scheduleRevision: number;
  inputRevision: number;
  ruleVersion: RuleVersionRecord;
  subjects: readonly ExamSubjectRecord[];
  registrations: readonly RegistrationRecord[];
}

export interface ExamsSnapshot {
  exams: readonly ExamRecord[];
}
