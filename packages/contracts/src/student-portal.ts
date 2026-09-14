import type { UUID } from './common.js';
import type { ResultComponentSnapshot, ResultOutcome } from './results.js';

export interface OwnRegistrationSubjectRecord {
  registrationSubjectId: UUID;
  examSubjectId: UUID;
  code: string;
  name: string;
  credits: number;
}

export interface OwnRegistrationRecord {
  id: UUID;
  examId: UUID;
  examCode: string;
  examName: string;
  academicYear: string;
  termName: string;
  state: 'APPROVED';
  version: number;
  approvedAt: string | null;
  subjects: readonly OwnRegistrationSubjectRecord[];
}

export interface OwnTimetablePaperRecord {
  examPaperId: UUID;
  examSubjectId: UUID;
  subjectCode: string;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  hallId: UUID;
  hallCode: string;
  hallName: string;
  seatNumber: number;
}

export interface OwnTimetableRecord {
  examId: UUID;
  examCode: string;
  examName: string;
  timezone: string;
  scheduleRevision: number;
  papers: readonly OwnTimetablePaperRecord[];
}

export type StudentDocumentKind = 'ADMIT_CARD' | 'GRADE_CARD';

export interface CurrentStudentDocumentMetadata {
  kind: StudentDocumentKind;
  issueId: string;
  examId: UUID;
  title: string;
  sourceId: UUID;
  version: number;
  current: true;
}

export interface OwnPublishedResultItemRecord {
  id: UUID;
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

interface OwnPublishedResultBase {
  publicationId: UUID;
  publicationVersion: number;
  publishedAt: string;
  examId: UUID;
  examCode: string;
  examName: string;
  ruleVersion: number;
  outcome: ResultOutcome;
}

export type OwnPublishedResultRecord =
  | (OwnPublishedResultBase & {
      outcome: 'WITHHELD';
      holdMessage: string;
    })
  | (OwnPublishedResultBase & {
      outcome: Exclude<ResultOutcome, 'WITHHELD'>;
      percentage: string | null;
      gpa: string | null;
      totalCredits: string;
      items: readonly OwnPublishedResultItemRecord[];
    });

export interface StudentPortalSnapshot {
  student: {
    id: UUID;
    rollNo: string;
    name: string;
    cohortName: string;
    institutionName: string;
  };
  registrations: readonly OwnRegistrationRecord[];
  timetables: readonly OwnTimetableRecord[];
  result: OwnPublishedResultRecord | null;
  documents: readonly CurrentStudentDocumentMetadata[];
}
