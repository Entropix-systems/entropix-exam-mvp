import type { TenantRole } from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export type ReportKind = 'registration-roster' | 'timetable-hall-roster' | 'attendance-incidents' | 'evaluation-progress' | 'current-result-register' | 'audit-activity'

export interface DashboardStep {
  code: 'ACADEMIC_SETUP' | 'TIMETABLE' | 'ATTENDANCE' | 'MARKS' | 'RESULT_RUN' | 'PUBLICATION'
  label: string
  detail: string
  status: 'COMPLETE' | 'PENDING' | 'ATTENTION'
}

export interface DashboardExam {
  examId: string
  examCode: string
  examName: string
  academicYear: string
  termName: string
  state: string
  inputRevision: number
  registeredStudents: number
  scheduledPapers: number
  totalPapers: number
  allocatedSeats: number
  requiredSubjectSeats: number
  submittedSittings: number
  totalSittings: number
  incompleteAttendanceRows: number
  approvedSubjects: number
  studentHolds: number
  openIncidents: number
  staleResultRun: boolean
  currentRunId: string | null
  currentPublicationVersion: number | null
  steps: readonly DashboardStep[]
  attention: readonly string[]
  schedule: readonly { paperId: string; subjectCode: string; subjectName: string; startsAt: string | null; halls: string }[]
}

export interface DashboardSnapshot {
  institutionName: string
  timezone: string
  generatedAt: string
  availableReports: readonly ReportKind[]
  exams: readonly DashboardExam[]
}

export interface AuditActivityRow {
  id: string
  occurredAt: string
  actor: string
  actorRole: TenantRole
  action: string
  targetType: string
  targetId: string | null
  reason: string | null
  requestId: string
}

export interface CsvExport {
  kind: ReportKind
  fileName: string
  contentType: 'text/csv;charset=utf-8'
  rowCount: number
  csv: string
}

export class AuditApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  dashboard(): Promise<DashboardSnapshot> { return this.requester.request('/audit/dashboard') }
  activity(): Promise<readonly AuditActivityRow[]> { return this.requester.request('/audit/activity') }
  export(kind: ReportKind): Promise<CsvExport> { return this.requester.request('/audit/exports/' + encodeURIComponent(kind)) }
}
