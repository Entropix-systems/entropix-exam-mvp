import type { UUID } from './common.js';
import type { AttendanceState } from './evaluation.js';

export const DUTY_STATES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;

export type DutyState =
  (typeof DUTY_STATES)[keyof typeof DUTY_STATES];

export const ATTENDANCE_BATCH_STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
} as const;

export type AttendanceBatchState =
  (typeof ATTENDANCE_BATCH_STATES)[keyof typeof ATTENDANCE_BATCH_STATES];

export const INCIDENT_KINDS = {
  STUDENT: 'STUDENT',
  HALL: 'HALL',
} as const;

export type IncidentKind =
  (typeof INCIDENT_KINDS)[keyof typeof INCIDENT_KINDS];

export const INCIDENT_DISPOSITIONS = {
  OPEN: 'OPEN',
  CLEARED: 'CLEARED',
  RETAIN_WITHHELD: 'RETAIN_WITHHELD',
  NO_RESULT_IMPACT: 'NO_RESULT_IMPACT',
} as const;

export type IncidentDisposition =
  (typeof INCIDENT_DISPOSITIONS)[keyof typeof INCIDENT_DISPOSITIONS];

export interface ConductFacultyRecord {
  id: UUID;
  code: string;
  name: string;
  departmentName: string;
}

export interface DutyRecord {
  id: UUID;
  hallSittingId: UUID;
  facultyId: UUID;
  facultyName: string;
  state: DutyState;
  version: number;
  declineReason: string | null;
  replacesDutyId: UUID | null;
  respondedAt: string | null;
}

export interface AttendanceRowRecord {
  id: UUID | null;
  seatAssignmentId: UUID;
  registrationSubjectId: UUID;
  studentId: UUID;
  rollNo: string;
  studentName: string;
  seatNumber: number;
  state: AttendanceState;
  version: number;
}

export interface AttendanceBatchRecord {
  id: UUID | null;
  state: AttendanceBatchState;
  version: number;
  submittedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  rows: readonly AttendanceRowRecord[];
}

export interface IncidentStudentRecord {
  registrationSubjectId: UUID;
  studentId: UUID;
  rollNo: string;
  studentName: string;
}

export interface IncidentRecord {
  id: UUID;
  hallSittingId: UUID;
  kind: IncidentKind;
  description: string;
  disposition: IncidentDisposition;
  version: number;
  dispositionReason: string | null;
  createdAt: string;
  disposedAt: string | null;
  affectedStudents: readonly IncidentStudentRecord[];
}

export interface ConductSittingRecord {
  id: UUID;
  examId: UUID;
  examCode: string;
  examName: string;
  examPaperId: UUID;
  examSubjectId: UUID;
  subjectCode: string;
  subjectName: string;
  hallCode: string;
  hallName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  dutyReady: boolean;
  canEditAttendance: boolean;
  duties: readonly DutyRecord[];
  attendance: AttendanceBatchRecord;
  incidents: readonly IncidentRecord[];
}

export interface ConductSnapshot {
  faculty: readonly ConductFacultyRecord[];
  sittings: readonly ConductSittingRecord[];
}

export interface AssignDutyInput {
  facultyId: UUID;
  replacesDutyId?: UUID;
}

export interface DeclineDutyInput {
  reason: string;
}

export interface AttendanceSaveInput {
  expectedVersion: number;
  rows: readonly {
    seatAssignmentId: UUID;
    state: AttendanceState;
  }[];
}

export interface AttendanceSubmitInput {
  expectedVersion: number;
}

export interface AttendanceReopenInput {
  expectedVersion: number;
  reason: string;
}

export interface IncidentCreateInput {
  kind: IncidentKind;
  description: string;
  registrationSubjectIds: readonly UUID[];
}

export interface IncidentDispositionInput {
  disposition: Exclude<IncidentDisposition, 'OPEN'>;
  expectedVersion: number;
  reason: string;
}

export interface ConductAttendanceOutcome {
  registrationSubjectId: UUID;
  studentId: UUID;
  examSubjectId: UUID;
  state: AttendanceState;
  attended: boolean;
}

export interface ConductResultHold {
  incidentId: UUID;
  studentId: UUID;
  disposition: 'OPEN' | 'RETAIN_WITHHELD';
}

export interface ConductResultState {
  examId: UUID;
  ready: boolean;
  attendance: readonly ConductAttendanceOutcome[];
  holds: readonly ConductResultHold[];
  incompleteHallSittingIds: readonly UUID[];
  unresolvedHallIncidentIds: readonly UUID[];
}
