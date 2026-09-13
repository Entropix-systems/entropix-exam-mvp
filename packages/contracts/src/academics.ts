import type { UUID } from "./common.js";

export const ACADEMIC_RESOURCE_PATHS = [
  "campuses",
  "departments",
  "programs",
  "academic-years",
  "terms",
  "cohorts",
  "subjects",
] as const;

export type AcademicResourcePath = (typeof ACADEMIC_RESOURCE_PATHS)[number];

export interface AcademicMasterBase {
  id: UUID;
  tenantId: UUID;
  code: string;
  name: string;
}

export interface CampusRecord extends AcademicMasterBase {}

export interface DepartmentRecord extends AcademicMasterBase {
  campusId: UUID;
}

export interface ProgramRecord extends AcademicMasterBase {
  departmentId: UUID;
}

export interface AcademicYearRecord extends AcademicMasterBase {
  startsOn: string;
  endsOn: string;
}

export interface TermRecord extends AcademicMasterBase {
  programId: UUID;
  academicYearId: UUID;
  startsOn: string;
  endsOn: string;
  sequence: number;
}

export interface CohortRecord extends AcademicMasterBase {
  termId: UUID;
}

export interface SubjectRecord extends AcademicMasterBase {
  programId: UUID;
  credits: number;
}

export type AcademicMasterRecord =
  | CampusRecord
  | DepartmentRecord
  | ProgramRecord
  | AcademicYearRecord
  | TermRecord
  | CohortRecord
  | SubjectRecord;

export interface AcademicStructureSnapshot {
  tenant: {
    id: UUID;
    name: string;
    slug: string;
    timezone: string;
  };
  campuses: CampusRecord[];
  departments: DepartmentRecord[];
  programs: ProgramRecord[];
  academicYears: AcademicYearRecord[];
  terms: TermRecord[];
  cohorts: CohortRecord[];
  subjects: SubjectRecord[];
}

export interface NamedAcademicMasterInput {
  code: string;
  name: string;
}

export interface CampusInput extends NamedAcademicMasterInput {}

export interface DepartmentInput extends NamedAcademicMasterInput {
  campusId: UUID;
}

export interface ProgramInput extends NamedAcademicMasterInput {
  departmentId: UUID;
}

export interface AcademicYearInput extends NamedAcademicMasterInput {
  startsOn: string;
  endsOn: string;
}

export interface TermInput extends NamedAcademicMasterInput {
  programId: UUID;
  academicYearId: UUID;
  startsOn: string;
  endsOn: string;
  sequence: number;
}

export interface CohortInput extends NamedAcademicMasterInput {
  termId: UUID;
}

export interface SubjectInput extends NamedAcademicMasterInput {
  programId: UUID;
  credits: number;
}

export interface AcademicInputByResource {
  campuses: CampusInput;
  departments: DepartmentInput;
  programs: ProgramInput;
  "academic-years": AcademicYearInput;
  terms: TermInput;
  cohorts: CohortInput;
  subjects: SubjectInput;
}

export interface AcademicRecordByResource {
  campuses: CampusRecord;
  departments: DepartmentRecord;
  programs: ProgramRecord;
  "academic-years": AcademicYearRecord;
  terms: TermRecord;
  cohorts: CohortRecord;
  subjects: SubjectRecord;
}
