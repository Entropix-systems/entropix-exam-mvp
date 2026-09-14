import { createHash } from 'node:crypto';
import type {
  AuthenticatedContext,
  StudentImportErrorCode,
  StudentImportPreview,
  StudentImportRequest,
  StudentImportRowError,
  UUID,
} from '@entropix/contracts';
import { hasActiveRole, isUuid } from '@entropix/domain';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type ImportRowToCreate,
  type ImportValidationContext,
  PeopleRepository,
} from './people.repository.js';

const requiredHeaders = ['roll_no', 'name', 'email', 'cohort_code', 'subject_codes'];
const codePattern = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedRow {
  rowNumber: number;
  columnCountValid: boolean;
  rollNo: string;
  name: string;
  email: string;
  cohortCode: string;
  subjectCodes: string[];
}

function tenantContext(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT') throw new ForbiddenException('Permission denied');
  return context;
}

function mayReadDirectory(context: AuthenticatedContext): boolean {
  return hasActiveRole(context, [
    'INSTITUTION_ADMIN',
    'EXAM_CONTROLLER',
    'DEPARTMENT_ADMIN',
    'FACULTY',
    'STUDENT',
    'AUDITOR',
  ]);
}

function mayImport(context: AuthenticatedContext): boolean {
  return hasActiveRole(context, ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER']);
}

function studentMembership(context: AuthenticatedContext): UUID | null {
  if (context.kind !== 'TENANT') return null;
  return context.activeRole === 'STUDENT'
    ? context.membershipId
    : null;
}

function requestBody(value: unknown): StudentImportRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new UnprocessableEntityException('Import input is invalid');
  const body = value as Record<string, unknown>;
  if (
    typeof body.fileName !== 'string' ||
    !body.fileName.trim() ||
    body.fileName.trim().length > 255 ||
    typeof body.sourceText !== 'string' ||
    !body.sourceText.trim() ||
    body.sourceText.length > 2_000_000
  ) throw new UnprocessableEntityException('Import input is invalid');
  if (!body.fileName.toLowerCase().endsWith('.csv'))
    throw new UnprocessableEntityException('Only CSV import is available in this demo');
  return { fileName: body.fileName.trim(), sourceText: body.sourceText };
}

function csvRecords(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value.length === 0) quoted = true;
    else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (quoted) throw new UnprocessableEntityException('CSV contains an unclosed quoted value');
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function parseRows(source: string): ParsedRow[] {
  const records = csvRecords(source.replace(/^\uFEFF/, ''));
  const header = records[0]?.map((value) => value.trim().toLowerCase());
  if (!header || header.length !== requiredHeaders.length ||
      header.some((value, index) => value !== requiredHeaders[index])) {
    throw new UnprocessableEntityException(
      `CSV headers must be ${requiredHeaders.join(',')}`,
    );
  }
  return records.slice(1).flatMap((record, index) => {
    if (record.every((value) => !value.trim())) return [];
    const values = [...record, '', '', '', '', ''].slice(0, 5);
    return [{
      rowNumber: index + 2,
      columnCountValid: record.length === requiredHeaders.length,
      rollNo: values[0].trim().toUpperCase(),
      name: values[1].trim(),
      email: values[2].trim().toLowerCase(),
      cohortCode: values[3].trim().toUpperCase(),
      subjectCodes: values[4].split('|').map((value) => value.trim().toUpperCase()).filter(Boolean),
    }];
  });
}

function rowError(
  rowNumber: number,
  field: StudentImportRowError['field'],
  code: StudentImportErrorCode,
  message: string,
): StudentImportRowError {
  return { rowNumber, field, code, message };
}

function validateRows(rows: readonly ParsedRow[], context: ImportValidationContext) {
  const errors: StudentImportRowError[] = [];
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const cohorts = new Map(context.cohorts.map((row) => [row.code, row]));
  const subjects = new Map(context.subjects.map((row) => [row.code, row]));

  for (const row of rows) {
    if (!row.columnCountValid)
      errors.push(rowError(row.rowNumber, 'file', 'INVALID_FILE', 'Row must contain exactly five columns'));
    if (!row.rollNo) errors.push(rowError(row.rowNumber, 'roll_no', 'MISSING_VALUE', 'Roll number is required'));
    else if (!codePattern.test(row.rollNo)) errors.push(rowError(row.rowNumber, 'roll_no', 'MALFORMED_VALUE', 'Roll number is malformed'));
    else if (seenRolls.has(row.rollNo)) errors.push(rowError(row.rowNumber, 'roll_no', 'DUPLICATE_FILE_ROLL', 'Roll number is duplicated in this file'));
    else if (!context.committed && context.existingRolls.has(row.rollNo)) errors.push(rowError(row.rowNumber, 'roll_no', 'EXISTING_ROLL', 'Roll number already exists'));
    seenRolls.add(row.rollNo);

    if (!row.name) errors.push(rowError(row.rowNumber, 'name', 'MISSING_VALUE', 'Name is required'));
    else if (row.name.length > 160) errors.push(rowError(row.rowNumber, 'name', 'MALFORMED_VALUE', 'Name is too long'));
    if (!row.email) errors.push(rowError(row.rowNumber, 'email', 'MISSING_VALUE', 'Email is required'));
    else if (!emailPattern.test(row.email) || row.email.length > 320 || seenEmails.has(row.email))
      errors.push(rowError(row.rowNumber, 'email', 'MALFORMED_VALUE', 'Email is malformed or duplicated'));
    seenEmails.add(row.email);

    const cohort = cohorts.get(row.cohortCode);
    if (!row.cohortCode) errors.push(rowError(row.rowNumber, 'cohort_code', 'MISSING_VALUE', 'Cohort code is required'));
    else if (!cohort) errors.push(rowError(row.rowNumber, 'cohort_code', 'UNKNOWN_COHORT', 'Cohort code is unknown'));
    if (row.subjectCodes.length === 0)
      errors.push(rowError(row.rowNumber, 'subject_codes', 'MISSING_VALUE', 'At least one subject is required'));
    const uniqueSubjects = new Set<string>();
    for (const subjectCode of row.subjectCodes) {
      const subject = subjects.get(subjectCode);
      if (uniqueSubjects.has(subjectCode) || !subject || (cohort && subject.programId !== cohort.programId))
        errors.push(rowError(row.rowNumber, 'subject_codes', 'UNKNOWN_SUBJECT', `Subject ${subjectCode} is unknown for this cohort`));
      uniqueSubjects.add(subjectCode);
    }
  }
  return errors;
}

@Injectable()
export class PeopleService {
  constructor(private readonly repository: PeopleRepository) {}

  async listStudents(
    context: AuthenticatedContext,
    search = '',
    cursorValue?: unknown,
    pageSizeValue?: unknown,
  ) {
    if (!mayReadDirectory(context)) throw new ForbiddenException('Permission denied');
    const tenant = tenantContext(context);
    const cursor =
      cursorValue === undefined || cursorValue === ''
        ? null
        : typeof cursorValue === 'string' && isUuid(cursorValue)
          ? cursorValue.toLowerCase()
          : (() => {
              throw new UnprocessableEntityException('Student cursor is invalid');
            })();
    const pageSize =
      pageSizeValue === undefined || pageSizeValue === ''
        ? 25
        : typeof pageSizeValue === 'string' && /^\d+$/.test(pageSizeValue)
          ? Number(pageSizeValue)
          : Number.NaN;
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new UnprocessableEntityException('Student page size is invalid');
    const directory = await this.repository.listStudents(
      tenant.tenantId,
      studentMembership(context),
      search.trim().slice(0, 100),
      pageSize,
      cursor,
    );
    if (!directory) throw new NotFoundException('Student page not found');
    return { ...directory, pageSize };
  }

  async getStudent(context: AuthenticatedContext, id: string) {
    if (!mayReadDirectory(context)) throw new ForbiddenException('Permission denied');
    if (!isUuid(id)) throw new NotFoundException('Student not found');
    const tenant = tenantContext(context);
    const student = await this.repository.getStudent(
      tenant.tenantId,
      id.toLowerCase(),
      studentMembership(context),
    );
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async listFaculty(context: AuthenticatedContext) {
    const tenant = tenantContext(context);
    if (!hasActiveRole(tenant, [
      'INSTITUTION_ADMIN',
      'EXAM_CONTROLLER',
      'DEPARTMENT_ADMIN',
      'FACULTY',
      'AUDITOR',
    ]))
      throw new ForbiddenException('Permission denied');
    return this.repository.listFaculty(tenant.tenantId);
  }

  async previewImport(context: AuthenticatedContext, body: unknown): Promise<StudentImportPreview> {
    if (!mayImport(context)) throw new ForbiddenException('Permission denied');
    const tenant = tenantContext(context);
    const input = requestBody(body);
    const contentHash = createHash('sha256').update(input.sourceText, 'utf8').digest('hex');
    const rows = parseRows(input.sourceText);
    if (rows.length === 0) throw new UnprocessableEntityException('CSV contains no student rows');
    const validation = await this.repository.importContext(tenant.tenantId, contentHash);
    const errors = validateRows(rows, validation);
    const invalidRows = new Set(errors.map((error) => error.rowNumber));
    return {
      fileName: input.fileName,
      contentHash,
      rowCount: rows.length,
      acceptedCount: rows.length - invalidRows.size,
      rejectedCount: invalidRows.size,
      alreadyCommitted: validation.committed !== null,
      rows: rows.map(({ columnCountValid: _columnCountValid, ...row }) => ({
        ...row,
        valid: !invalidRows.has(row.rowNumber),
      })),
      errors,
    };
  }

  async commitImport(context: AuthenticatedContext, body: unknown) {
    const preview = await this.previewImport(context, body);
    const tenant = tenantContext(context);
    const input = requestBody(body);
    if (preview.errors.length > 0)
      throw new UnprocessableEntityException('Import has validation errors; no records were committed');
    const validation = await this.repository.importContext(tenant.tenantId, preview.contentHash);
    if (validation.committed) return validation.committed;
    const cohorts = new Map(validation.cohorts.map((row) => [row.code, row]));
    const subjects = new Map(validation.subjects.map((row) => [row.code, row]));
    const rows: ImportRowToCreate[] = preview.rows.map((row) => ({
      rollNo: row.rollNo,
      name: row.name,
      email: row.email,
      cohortId: cohorts.get(row.cohortCode)!.id,
      subjectIds: row.subjectCodes.map((code) => subjects.get(code)!.id),
    }));
    try {
      return await this.repository.commitImport(
        tenant.tenantId,
        input.fileName,
        preview.contentHash,
        rows,
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error &&
          ['P2002', 'P2003'].includes(String((error as { code: unknown }).code)))
        throw new UnprocessableEntityException('Import conflicts with current tenant data; no records were committed');
      throw error;
    }
  }
}
