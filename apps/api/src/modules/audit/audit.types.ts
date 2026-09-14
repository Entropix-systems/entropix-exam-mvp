import type { TenantRole, UUID } from '@entropix/contracts';

export const REPORT_KINDS = [
  'registration-roster',
  'timetable-hall-roster',
  'attendance-incidents',
  'evaluation-progress',
  'current-result-register',
  'audit-activity',
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export interface ReportingActor {
  membershipId: UUID;
  role: TenantRole;
  departmentIds: readonly UUID[];
}

export interface DashboardStep {
  code: 'ACADEMIC_SETUP' | 'TIMETABLE' | 'ATTENDANCE' | 'MARKS' | 'RESULT_RUN' | 'PUBLICATION';
  label: string;
  detail: string;
  status: 'COMPLETE' | 'PENDING' | 'ATTENTION';
}

export interface DashboardExam {
  examId: UUID;
  examCode: string;
  examName: string;
  academicYear: string;
  termName: string;
  state: string;
  inputRevision: number;
  registeredStudents: number;
  scheduledPapers: number;
  totalPapers: number;
  allocatedSeats: number;
  requiredSubjectSeats: number;
  submittedSittings: number;
  totalSittings: number;
  incompleteAttendanceRows: number;
  approvedSubjects: number;
  studentHolds: number;
  openIncidents: number;
  staleResultRun: boolean;
  currentRunId: UUID | null;
  currentPublicationVersion: number | null;
  steps: readonly DashboardStep[];
  attention: readonly string[];
  schedule: readonly {
    paperId: UUID;
    subjectCode: string;
    subjectName: string;
    startsAt: string | null;
    halls: string;
  }[];
}

export interface DashboardSnapshot {
  institutionName: string;
  timezone: string;
  generatedAt: string;
  availableReports: readonly ReportKind[];
  exams: readonly DashboardExam[];
}

export interface AuditActivityRow {
  id: UUID;
  occurredAt: string;
  actor: string;
  actorRole: TenantRole;
  action: string;
  targetType: string;
  targetId: UUID | null;
  reason: string | null;
  requestId: string;
}

export interface CsvExport {
  kind: ReportKind;
  fileName: string;
  contentType: 'text/csv;charset=utf-8';
  rowCount: number;
  csv: string;
}
