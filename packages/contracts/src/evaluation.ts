import type { UUID } from './common.js';
import type { ExamState } from './exam.js';

export const ATTENDANCE_STATES = {
  NOT_MARKED: 'NOT_MARKED',
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
} as const;

export type AttendanceState =
  (typeof ATTENDANCE_STATES)[keyof typeof ATTENDANCE_STATES];

export const MARK_COMPONENTS = {
  FINAL: 'FINAL',
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
} as const;

export type MarkComponent =
  (typeof MARK_COMPONENTS)[keyof typeof MARK_COMPONENTS];

export const MARKS_BATCH_STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  RETURNED: 'RETURNED',
} as const;

export type MarksBatchState =
  (typeof MARKS_BATCH_STATES)[keyof typeof MARKS_BATCH_STATES];

export interface EvaluationFacultyRecord {
  id: UUID;
  code: string;
  name: string;
  departmentId: UUID;
  departmentName: string;
}

export interface EvaluationAssignmentRecord {
  id: UUID;
  facultyId: UUID;
  facultyName: string;
  version: number;
  assignedAt: string;
}

export interface MarksBatchHistoryEvent {
  action: 'DRAFT_SAVED' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'REOPENED';
  actorMembershipId: UUID;
  at: string;
  reason: string | null;
}

export interface MarkValueRecord {
  component: MarkComponent;
  value: string;
}

export interface MarksRosterRowRecord {
  registrationSubjectId: UUID;
  studentId: UUID;
  rollNo: string;
  studentName: string;
  attendanceState: AttendanceState;
  held: boolean;
  marks: readonly MarkValueRecord[];
}

export interface MarksBatchRecord {
  id: UUID | null;
  state: MarksBatchState;
  version: number;
  submittedByMembershipId: UUID | null;
  submittedAt: string | null;
  reviewedByMembershipId: UUID | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  history: readonly MarksBatchHistoryEvent[];
}

export interface EvaluationSubjectRecord {
  examId: UUID;
  examCode: string;
  examName: string;
  examState: ExamState;
  inputRevision: number;
  examSubjectId: UUID;
  subjectCode: string;
  subjectName: string;
  departmentId: UUID;
  ruleVersion: number;
  components: readonly { component: MarkComponent; maximum: string }[];
  assignment: EvaluationAssignmentRecord | null;
  batch: MarksBatchRecord;
  roster: readonly MarksRosterRowRecord[];
  conductReady: boolean;
  canAssign: boolean;
  canEdit: boolean;
  canReview: boolean;
}

export interface EvaluationSnapshot {
  faculty: readonly EvaluationFacultyRecord[];
  subjects: readonly EvaluationSubjectRecord[];
}

export interface EvaluationAssignmentInput {
  facultyId: UUID;
  expectedVersion: number;
}

export interface MarksSaveInput {
  expectedVersion: number;
  rows: readonly {
    registrationSubjectId: UUID;
    marks: readonly { component: MarkComponent; value: string | null }[];
  }[];
}

export interface MarksTransitionInput {
  expectedVersion: number;
}

export interface MarksReviewInput extends MarksTransitionInput {
  reason: string;
}
