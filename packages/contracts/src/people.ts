import type { UUID } from './common.js';

export type PersonStatus = 'ACTIVE' | 'INACTIVE';

export interface StudentDirectoryRecord {
  id: UUID;
  membershipId: UUID;
  rollNo: string;
  name: string;
  email: string;
  status: PersonStatus;
  cohort: { id: UUID; code: string; name: string };
  subjects: readonly { id: UUID; code: string; name: string }[];
}

export interface StudentDirectoryResponse {
  students: readonly StudentDirectoryRecord[];
  total: number;
  nextCursor: UUID | null;
  pageSize: number;
}

export interface FacultyDirectoryRecord {
  id: UUID;
  membershipId: UUID;
  code: string;
  name: string;
  email: string;
  status: PersonStatus;
  department: { id: UUID; code: string; name: string };
}

export interface StudentImportRequest {
  fileName: string;
  sourceText: string;
}

export type StudentImportErrorCode =
  | 'INVALID_FILE'
  | 'MISSING_VALUE'
  | 'MALFORMED_VALUE'
  | 'DUPLICATE_FILE_ROLL'
  | 'EXISTING_ROLL'
  | 'UNKNOWN_COHORT'
  | 'UNKNOWN_SUBJECT';

export interface StudentImportRowError {
  rowNumber: number;
  field: 'file' | 'roll_no' | 'name' | 'email' | 'cohort_code' | 'subject_codes';
  code: StudentImportErrorCode;
  message: string;
}

export interface StudentImportPreviewRow {
  rowNumber: number;
  rollNo: string;
  name: string;
  email: string;
  cohortCode: string;
  subjectCodes: readonly string[];
  valid: boolean;
}

export interface StudentImportPreview {
  fileName: string;
  contentHash: string;
  rowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  alreadyCommitted: boolean;
  rows: readonly StudentImportPreviewRow[];
  errors: readonly StudentImportRowError[];
}

export interface StudentImportCommitResult {
  importId: UUID;
  contentHash: string;
  rowCount: number;
  createdCount: number;
  enrolmentCount: number;
  replayed: boolean;
  committedAt: string;
}
