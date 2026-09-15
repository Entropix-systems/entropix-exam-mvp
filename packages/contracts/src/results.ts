import type { UUID } from './common.js';

export const RESULT_OUTCOMES = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  ABSENT: 'ABSENT',
  WITHHELD: 'WITHHELD',
} as const;

export type ResultOutcome =
  (typeof RESULT_OUTCOMES)[keyof typeof RESULT_OUTCOMES];

export type ResultRuleDecimalInput = number | string;

export const RESULT_COMPONENTS = {
  FINAL: 'FINAL',
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type ResultComponent =
  (typeof RESULT_COMPONENTS)[keyof typeof RESULT_COMPONENTS];

export interface ResultComponentRuleInput {
  readonly component: ResultComponent;
  readonly maximum: ResultRuleDecimalInput;
  readonly weight: ResultRuleDecimalInput;
  readonly minimumPassPercentage?: ResultRuleDecimalInput;
}

export interface GradeBandInput {
  readonly grade: string;
  readonly minInclusive: ResultRuleDecimalInput;
  readonly maxExclusive?: ResultRuleDecimalInput;
  readonly maxInclusive?: ResultRuleDecimalInput;
  readonly points: ResultRuleDecimalInput;
}

export interface ResultRuleInput {
  readonly components: readonly ResultComponentRuleInput[];
  readonly totalPassPercentage: ResultRuleDecimalInput;
  readonly gradeBands: readonly GradeBandInput[];
}

export interface ValidatedResultComponentRule {
  readonly component: ResultComponent;
  readonly maximum: string;
  readonly weight: string;
  readonly minimumPassPercentage: string | null;
}

export interface ValidatedGradeBand {
  readonly grade: string;
  readonly minInclusive: string;
  readonly maxExclusive: string | null;
  readonly maxInclusive: string | null;
  readonly points: string;
}

export interface ValidatedResultRule {
  readonly kind: 'VALIDATED_RESULT_RULE';
  readonly components: readonly ValidatedResultComponentRule[];
  readonly totalPassPercentage: string;
  readonly gradeBands: readonly ValidatedGradeBand[];
}

export const RESULT_BLOCKER_CODES = {
  CONDUCT_INCOMPLETE: 'CONDUCT_INCOMPLETE',
  MARKS_NOT_APPROVED: 'MARKS_NOT_APPROVED',
  MISSING_REQUIRED_DATA: 'MISSING_REQUIRED_DATA',
  PUBLICATION_ACTIVE: 'PUBLICATION_ACTIVE',
} as const;

export type ResultBlockerCode =
  (typeof RESULT_BLOCKER_CODES)[keyof typeof RESULT_BLOCKER_CODES];

export interface ResultBlocker {
  code: ResultBlockerCode;
  message: string;
  count: number;
}

export interface ResultComponentSnapshot {
  component: ResultComponent;
  mark: string | null;
  maximum: string;
  weight: string;
  percentage: string | null;
}

export interface ResultItemRecord {
  id: UUID;
  registrationSubjectId: UUID;
  examSubjectId: UUID;
  subjectCode: string;
  subjectName: string;
  credits: number;
  outcome: ResultOutcome;
  percentage: string | null;
  components: readonly ResultComponentSnapshot[];
  grade: string | null;
  gradePoints: string | null;
  reason: string | null;
}

export interface StudentResultRecord {
  id: UUID;
  studentId: UUID;
  rollNo: string;
  studentName: string;
  outcome: ResultOutcome;
  percentage: string | null;
  gpa: string | null;
  totalCredits: string;
  weightedPoints: string | null;
  reason: string | null;
  items: readonly ResultItemRecord[];
}

export interface ResultRunRecord {
  id: UUID;
  examId: UUID;
  examCode: string;
  examName: string;
  inputRevision: number;
  ruleVersion: number;
  checksum: string;
  studentCount: number;
  itemCount: number;
  passCount: number;
  failCount: number;
  absentCount: number;
  withheldCount: number;
  computedAt: string;
  students: readonly StudentResultRecord[];
}

export interface PublicationRecord {
  id: UUID;
  examId: UUID;
  resultRunId: UUID;
  version: number;
  isCurrent: boolean;
  publishedAt: string;
  withdrawnAt: string | null;
  withdrawReason: string | null;
}

export interface ResultsExamRecord {
  examId: UUID;
  examCode: string;
  examName: string;
  examState: import('./exam.js').ExamState;
  inputRevision: number;
  ruleVersion: number;
  studentCount: number;
  subjectCount: number;
  approvedSubjectCount: number;
  blockers: readonly ResultBlocker[];
  candidateRun: ResultRunRecord | null;
  currentPublication: PublicationRecord | null;
}

export interface ResultsSnapshot {
  exams: readonly ResultsExamRecord[];
}

export interface ResultWithdrawalInput {
  reason: string;
}

interface CurrentStudentResultBase {
  publication: PublicationRecord;
  examId: UUID;
  examCode: string;
  examName: string;
  ruleVersion: number;
}

export type CurrentStudentResultRecord =
  | (CurrentStudentResultBase & {
      outcome: 'WITHHELD';
      holdMessage: string;
    })
  | (CurrentStudentResultBase & {
      outcome: Exclude<ResultOutcome, 'WITHHELD'>;
      result: StudentResultRecord;
    });
