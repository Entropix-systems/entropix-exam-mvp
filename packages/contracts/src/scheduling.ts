import type { ExamState } from './exam.js';
import type { UUID } from './common.js';

export interface HallCreateInput {
  campusId: UUID;
  code: string;
  name: string;
  capacity: number;
}

export interface HallRecord {
  id: UUID;
  campusId: UUID;
  campusName: string;
  code: string;
  name: string;
  capacity: number;
  version: number;
}

export interface SeatAssignmentRecord {
  id: UUID | null;
  registrationSubjectId: UUID;
  studentId: UUID;
  rollNo: string;
  studentName: string;
  hallSittingId: UUID | null;
  hallId: UUID;
  hallCode: string;
  hallName: string;
  seatNumber: number;
}

export interface HallSittingRecord {
  id: UUID;
  hallId: UUID;
  hallCode: string;
  hallName: string;
  capacity: number;
  roomOrder: number;
  version: number;
  seats: readonly SeatAssignmentRecord[];
}

export interface ExamPaperRecord {
  id: UUID;
  examSubjectId: UUID;
  code: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  approvedRosterCount: number;
  allocatedCount: number;
  unallocatedStudents: readonly {
    registrationSubjectId: UUID;
    studentId: UUID;
    rollNo: string;
    studentName: string;
  }[];
  sittings: readonly HallSittingRecord[];
}

export interface ScheduleReadiness {
  ready: boolean;
  scheduledPapers: number;
  totalPapers: number;
  approvedRosterCount: number;
  allocatedCount: number;
  unallocatedCount: number;
}

export interface ExamScheduleRecord {
  examId: UUID;
  code: string;
  name: string;
  state: ExamState;
  version: number;
  scheduleRevision: number;
  timezone: string;
  papers: readonly ExamPaperRecord[];
  readiness: ScheduleReadiness;
}

export interface SchedulingSnapshot {
  halls: readonly HallRecord[];
  exams: readonly ExamScheduleRecord[];
}

export interface PaperScheduleInput {
  startsAt: string;
  endsAt: string;
  expectedVersion: number;
}

export interface AllocationInput {
  hallIds: readonly UUID[];
  expectedVersion: number;
}

export interface AllocationPreview {
  examPaperId: UUID;
  expectedVersion: number;
  rosterCount: number;
  totalCapacity: number;
  unallocatedCount: number;
  assignments: readonly SeatAssignmentRecord[];
}

export interface PublishScheduleInput {
  expectedVersion: number;
}
