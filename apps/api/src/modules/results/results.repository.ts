import type {
  CurrentStudentResultRecord,
  PublicationRecord,
  ResultBlocker,
  ResultComponentSnapshot,
  ResultItemRecord,
  ResultOutcome,
  ResultRunRecord,
  ResultsExamRecord,
  ResultsSnapshot,
  StudentResultRecord,
  UUID,
  ValidatedResultRule,
} from '@entropix/contracts';
import { RESULT_BLOCKER_CODES, RESULT_OUTCOMES } from '@entropix/contracts';
import { Prisma, PrismaClient, withTenant, type TenantTransaction } from '@entropix/db';
import { computeStudentAggregate, computeSubjectResult } from '@entropix/domain';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

const runInclude = {
  items: { orderBy: [{ studentId: 'asc' }, { subjectCode: 'asc' }] },
  students: { orderBy: { rollNo: 'asc' } },
} satisfies Prisma.ResultRunInclude;

const examInclude = {
  ruleVersion: true,
  subjects: {
    include: {
      subject: true,
      marksBatch: { include: { marks: true } },
      paper: { include: { hallSittings: { include: { duties: true, attendanceBatch: true, incidents: { include: { affectedStudents: true } } } } } },
      registrationSubjects: {
        where: { registration: { state: 'APPROVED' } },
        include: {
          registration: { include: { student: true } },
          seatAssignments: { include: { attendance: true, hallSitting: { include: { attendanceBatch: true } } } },
          incidentStudents: { include: { incident: true } },
        },
        orderBy: { registration: { student: { rollNo: 'asc' } } },
      },
    },
    orderBy: { subject: { code: 'asc' } },
  },
  resultRuns: { include: runInclude, orderBy: { computedAt: 'desc' } },
  publications: { where: { isCurrent: true }, orderBy: { publishedAt: 'desc' } },
} satisfies Prisma.ExamInclude;

type ExamRow = Prisma.ExamGetPayload<{ include: typeof examInclude }>;
type RunRow = Prisma.ResultRunGetPayload<{ include: typeof runInclude }>;

interface ComputedItem {
  registrationSubjectId: UUID;
  examSubjectId: UUID;
  studentId: UUID;
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

interface ComputedStudent {
  studentId: UUID;
  rollNo: string;
  studentName: string;
  outcome: ResultOutcome;
  percentage: string | null;
  gpa: string | null;
  totalCredits: string;
  weightedPoints: string | null;
  reason: string | null;
}

export interface Computation {
  checksum: string;
  items: readonly ComputedItem[];
  students: readonly ComputedStudent[];
  counts: { pass: number; fail: number; absent: number; withheld: number };
}

const decimal4 = (value: number | null): string | null =>
  value === null ? null : value.toFixed(4).replace(/(?:\.0+|(?:(\.\d*?)0+))$/, '$1');

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

async function lockResults(tx: TenantTransaction, tenantId: UUID, examId: UUID) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'results:' + tenantId + ':' + examId}, 0))`;
}

function publication(row: ExamRow['publications'][number]): PublicationRecord {
  return {
    id: row.id,
    examId: row.examId,
    resultRunId: row.resultRunId,
    version: row.version,
    isCurrent: row.isCurrent,
    publishedAt: row.publishedAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    withdrawReason: row.withdrawReason,
  };
}

function components(value: Prisma.JsonValue, hidden: boolean): readonly ResultComponentSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      component: row.component as ResultComponentSnapshot['component'],
      mark: hidden ? null : typeof row.mark === 'string' ? row.mark : null,
      maximum: String(row.maximum),
      weight: String(row.weight),
      percentage: hidden ? null : typeof row.percentage === 'string' ? row.percentage : null,
    };
  });
}

function mapRun(row: RunRow, exam: Pick<ExamRow, 'code' | 'name' | 'ruleVersion'>): ResultRunRecord {
  const byStudent = new Map<UUID, ResultItemRecord[]>();
  for (const item of row.items) {
    const hidden = item.outcome === RESULT_OUTCOMES.ABSENT || item.outcome === RESULT_OUTCOMES.WITHHELD;
    const mapped: ResultItemRecord = {
      id: item.id,
      registrationSubjectId: item.registrationSubjectId,
      examSubjectId: item.examSubjectId,
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      credits: item.credits,
      outcome: item.outcome as ResultOutcome,
      percentage: hidden ? null : item.percentage?.toString() ?? null,
      components: components(item.components, hidden),
      grade: hidden ? null : item.grade,
      gradePoints: hidden ? null : item.gradePoints?.toString() ?? null,
      reason: item.reason,
    };
    byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), mapped]);
  }
  return {
    id: row.id,
    examId: row.examId,
    examCode: exam.code,
    examName: exam.name,
    inputRevision: row.inputRevision,
    ruleVersion: exam.ruleVersion.version,
    checksum: row.checksum,
    studentCount: row.studentCount,
    itemCount: row.itemCount,
    passCount: row.passCount,
    failCount: row.failCount,
    absentCount: row.absentCount,
    withheldCount: row.withheldCount,
    computedAt: row.computedAt.toISOString(),
    students: row.students.map((student) => {
      const hidden = student.outcome === RESULT_OUTCOMES.WITHHELD;
      return {
        id: student.id,
        studentId: student.studentId,
        rollNo: student.rollNo,
        studentName: student.studentName,
        outcome: student.outcome as ResultOutcome,
        percentage: hidden ? null : student.percentage?.toString() ?? null,
        gpa: hidden ? null : student.gpa?.toString() ?? null,
        totalCredits: student.totalCredits.toString(),
        weightedPoints: hidden ? null : student.weightedPoints?.toString() ?? null,
        reason: student.reason,
        items: byStudent.get(student.studentId) ?? [],
      } satisfies StudentResultRecord;
    }),
  };
}

export function resultBlockers(exam: ExamRow): ResultBlocker[] {
  const blockers: ResultBlocker[] = [];
  const roster = exam.subjects.flatMap((subject) => subject.registrationSubjects);
  const missing = Number(exam.subjects.length === 0) + Number(roster.length === 0)
    + exam.subjects.filter((subject) => subject.registrationSubjects.length === 0 || !subject.paper || subject.paper.hallSittings.length === 0).length;
  if (missing > 0) blockers.push({ code: RESULT_BLOCKER_CODES.MISSING_REQUIRED_DATA, message: 'Approved registrations, subjects, schedules, and seats are required.', count: missing });

  const incompleteConduct = exam.subjects.reduce((count, subject) => {
    const sittingIssues = subject.paper?.hallSittings.filter((sitting) =>
      !sitting.duties.some((duty) => duty.state === 'ACCEPTED')
      || sitting.attendanceBatch?.state !== 'SUBMITTED'
      || sitting.incidents.some((incident) => incident.kind === 'HALL' && incident.disposition === 'OPEN' && incident.affectedStudents.length === 0),
    ).length ?? 0;
    const rowIssues = subject.registrationSubjects.filter((row) =>
      row.seatAssignments.length !== 1
      || row.seatAssignments[0]?.hallSitting.attendanceBatch?.state !== 'SUBMITTED'
      || !row.seatAssignments[0]?.attendance
      || row.seatAssignments[0]?.attendance?.state === 'NOT_MARKED',
    ).length;
    return count + sittingIssues + rowIssues;
  }, 0);
  if (incompleteConduct > 0) blockers.push({ code: RESULT_BLOCKER_CODES.CONDUCT_INCOMPLETE, message: 'Close conduct with accepted duties, submitted attendance, and resolved hall incidents.', count: incompleteConduct });

  const unapproved = exam.subjects.filter((subject) => subject.marksBatch?.state !== 'APPROVED').length;
  if (unapproved > 0) blockers.push({ code: RESULT_BLOCKER_CODES.MARKS_NOT_APPROVED, message: 'Every subject marks batch must be independently approved.', count: unapproved });
  if (exam.publications.length > 0) blockers.push({ code: RESULT_BLOCKER_CODES.PUBLICATION_ACTIVE, message: 'Withdraw the current publication before computing corrected results.', count: 1 });
  return blockers;
}

export function buildComputation(exam: ExamRow): Computation {
  const blocking = resultBlockers(exam).filter((entry) => entry.code !== RESULT_BLOCKER_CODES.PUBLICATION_ACTIVE);
  if (blocking.length > 0) throw new Error('RESULTS_NOT_READY');
  const rule = exam.ruleVersion.config as unknown as ValidatedResultRule;
  const heldStudents = new Set(exam.subjects.flatMap((subject) => subject.registrationSubjects)
    .filter((row) => row.incidentStudents.some((affected) => ['OPEN', 'RETAIN_WITHHELD'].includes(affected.incident.disposition)))
    .map((row) => row.registration.studentId));
  const items: ComputedItem[] = [];
  const byStudent = new Map<UUID, { studentId: UUID; rollNo: string; studentName: string; items: ComputedItem[]; domain: { result: ReturnType<typeof computeSubjectResult>; credits: number }[] }>();
  const canonicalSubjects: unknown[] = [];

  for (const subject of exam.subjects) {
    const marks = new Map((subject.marksBatch?.marks ?? []).map((mark) => [mark.registrationSubjectId + ':' + mark.component, mark.value.toString()]));
    const canonicalRows: unknown[] = [];
    for (const row of subject.registrationSubjects) {
      const attendance = row.seatAssignments[0]!.attendance!.state;
      const held = heldStudents.has(row.registration.studentId);
      const markInput = Object.fromEntries(rule.components.map((component) => [component.component, marks.get(row.id + ':' + component.component)]));
      const result = computeSubjectResult(rule, {
        attendance: attendance === 'ABSENT' ? 'ABSENT' : 'PRESENT',
        openStudentIncident: held,
        marks: markInput,
      });
      const hidden = result.outcome === RESULT_OUTCOMES.ABSENT || result.outcome === RESULT_OUTCOMES.WITHHELD;
      const item: ComputedItem = {
        registrationSubjectId: row.id,
        examSubjectId: subject.id,
        studentId: row.registration.studentId,
        subjectCode: subject.subject.code,
        subjectName: subject.subject.name,
        credits: subject.subject.credits,
        outcome: result.outcome,
        percentage: hidden ? null : decimal4(result.rawPercentage),
        components: rule.components.map((component) => ({
          component: component.component,
          mark: hidden ? null : marks.get(row.id + ':' + component.component) ?? null,
          maximum: component.maximum,
          weight: component.weight,
          percentage: hidden ? null : decimal4(result.componentPercentages[component.component] ?? null),
        })),
        grade: hidden ? null : result.grade,
        gradePoints: hidden ? null : decimal4(result.gradePoints),
        reason: result.outcome === RESULT_OUTCOMES.WITHHELD
          ? 'Result withheld due to an unresolved or retained student incident.'
          : result.outcome === RESULT_OUTCOMES.ABSENT
            ? 'Absent in submitted attendance.'
            : result.failedComponents.length > 0
              ? 'Minimum not met for ' + result.failedComponents.join(', ') + '.'
              : result.outcome === RESULT_OUTCOMES.FAIL ? 'Total pass requirement not met.' : null,
      };
      items.push(item);
      const current = byStudent.get(row.registration.studentId) ?? {
        studentId: row.registration.studentId,
        rollNo: row.registration.student.rollNo,
        studentName: row.registration.student.name,
        items: [],
        domain: [],
      };
      current.items.push(item);
      current.domain.push({ result, credits: subject.subject.credits });
      byStudent.set(current.studentId, current);
      canonicalRows.push({ registrationSubjectId: row.id, studentId: current.studentId, attendance, held, marks: Object.entries(markInput).sort(([a], [b]) => a.localeCompare(b)) });
    }
    canonicalSubjects.push({ examSubjectId: subject.id, subjectCode: subject.subject.code, credits: subject.subject.credits, batchId: subject.marksBatch!.id, batchVersion: subject.marksBatch!.version, rows: canonicalRows });
  }

  const students: ComputedStudent[] = [...byStudent.values()].sort((a, b) => a.rollNo.localeCompare(b.rollNo)).map((student) => {
    const aggregate = computeStudentAggregate({ subjects: student.domain, includeCurrentExamGpa: true });
    return {
      studentId: student.studentId,
      rollNo: student.rollNo,
      studentName: student.studentName,
      outcome: aggregate.outcome,
      percentage: decimal4(aggregate.rawPercentage),
      gpa: decimal4(aggregate.gpa),
      totalCredits: decimal4(aggregate.totalCredits)!,
      weightedPoints: decimal4(aggregate.weightedPoints),
      reason: aggregate.outcome === RESULT_OUTCOMES.WITHHELD ? 'Result withheld due to conduct review.' : aggregate.outcome === RESULT_OUTCOMES.ABSENT ? 'One or more subject outcomes are ABSENT.' : null,
    };
  });
  const counts = {
    pass: students.filter((row) => row.outcome === RESULT_OUTCOMES.PASS).length,
    fail: students.filter((row) => row.outcome === RESULT_OUTCOMES.FAIL).length,
    absent: students.filter((row) => row.outcome === RESULT_OUTCOMES.ABSENT).length,
    withheld: students.filter((row) => row.outcome === RESULT_OUTCOMES.WITHHELD).length,
  };
  const checksum = createHash('sha256').update(JSON.stringify({ examId: exam.id, inputRevision: exam.inputRevision, ruleVersionId: exam.ruleVersionId, rule, subjects: canonicalSubjects })).digest('hex');
  return { checksum, items, students, counts };
}

async function requiredExam(tx: TenantTransaction, tenantId: UUID, examId: UUID): Promise<ExamRow> {
  const exam = await tx.exam.findFirst({ where: { tenantId, id: examId }, include: examInclude });
  if (!exam) throw new Error('EXAM_NOT_FOUND');
  return exam;
}

function examRecord(exam: ExamRow): ResultsExamRecord {
  const candidate = exam.resultRuns.find((run) => run.inputRevision === exam.inputRevision) ?? null;
  const students = new Set(exam.subjects.flatMap((subject) => subject.registrationSubjects.map((row) => row.registration.studentId)));
  return {
    examId: exam.id,
    examCode: exam.code,
    examName: exam.name,
    examState: exam.state as ResultsExamRecord['examState'],
    inputRevision: exam.inputRevision,
    ruleVersion: exam.ruleVersion.version,
    studentCount: students.size,
    subjectCount: exam.subjects.length,
    approvedSubjectCount: exam.subjects.filter((subject) => subject.marksBatch?.state === 'APPROVED').length,
    blockers: resultBlockers(exam),
    candidateRun: candidate ? mapRun(candidate, exam) : null,
    currentPublication: exam.publications[0] ? publication(exam.publications[0]) : null,
  };
}

@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  snapshot(tenantId: UUID): Promise<ResultsSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const exams = await tx.exam.findMany({
        where: { tenantId, state: { in: ['SCHEDULE_PUBLISHED', 'EVALUATION', 'PUBLISHED'] } },
        include: examInclude,
        orderBy: { registrationClosesAt: 'desc' },
      });
      return { exams: exams.map(examRecord) };
    });
  }

  compute(tenantId: UUID, membershipId: UUID, examId: UUID, now: Date): Promise<ResultRunRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockResults(tx, tenantId, examId);
      const exam = await requiredExam(tx, tenantId, examId);
      if (!['SCHEDULE_PUBLISHED', 'EVALUATION'].includes(exam.state)) throw new Error(exam.state === 'PUBLISHED' ? 'PUBLICATION_ACTIVE' : 'INVALID_EXAM_STATE');
      const computed = buildComputation(exam);
      const existing = exam.resultRuns.find((run) => run.inputRevision === exam.inputRevision);
      if (existing) {
        if (existing.checksum !== computed.checksum) throw new Error('INPUT_REVISION_DRIFT');
        return mapRun(existing, exam);
      }
      const created = await tx.resultRun.create({
        data: {
          tenantId,
          examId,
          ruleVersionId: exam.ruleVersionId,
          inputRevision: exam.inputRevision,
          checksum: computed.checksum,
          studentCount: computed.students.length,
          itemCount: computed.items.length,
          passCount: computed.counts.pass,
          failCount: computed.counts.fail,
          absentCount: computed.counts.absent,
          withheldCount: computed.counts.withheld,
          computedByMembershipId: membershipId,
          computedAt: now,
          items: { create: computed.items.map((item) => ({ ...item, components: json(item.components) })) },
          students: { create: [...computed.students] },
        },
        include: runInclude,
      });
      return mapRun(created, exam);
    });
  }

  readRun(tenantId: UUID, resultRunId: UUID): Promise<ResultRunRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const row = await tx.resultRun.findFirst({ where: { tenantId, id: resultRunId }, include: { ...runInclude, exam: { include: { ruleVersion: true } } } });
      if (!row) throw new Error('RUN_NOT_FOUND');
      return mapRun(row, row.exam as ExamRow);
    });
  }

  publish(tenantId: UUID, membershipId: UUID, resultRunId: UUID, now: Date): Promise<PublicationRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const run = await tx.resultRun.findFirst({ where: { tenantId, id: resultRunId }, select: { id: true, examId: true, inputRevision: true, ruleVersionId: true, checksum: true } });
      if (!run) throw new Error('RUN_NOT_FOUND');
      await lockResults(tx, tenantId, run.examId);
      const current = await tx.publication.findFirst({ where: { tenantId, examId: run.examId, isCurrent: true } });
      if (current?.resultRunId === run.id) return publication(current);
      if (current) throw new Error('PUBLICATION_ACTIVE');
      const exam = await requiredExam(tx, tenantId, run.examId);
      if (exam.inputRevision !== run.inputRevision || exam.ruleVersionId !== run.ruleVersionId) throw new Error('STALE_RUN');
      if (buildComputation(exam).checksum !== run.checksum) throw new Error('STALE_RUN');
      const latest = await tx.publication.findFirst({ where: { tenantId, examId: run.examId }, orderBy: { version: 'desc' }, select: { version: true } });
      const created = await tx.publication.create({ data: { tenantId, examId: run.examId, resultRunId: run.id, version: (latest?.version ?? 0) + 1, publishedByMembershipId: membershipId, publishedAt: now } });
      await tx.exam.update({ where: { id: run.examId }, data: { state: 'PUBLISHED', version: { increment: 1 } } });
      return publication(created);
    });
  }

  withdraw(tenantId: UUID, membershipId: UUID, examId: UUID, reason: string, now: Date): Promise<PublicationRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockResults(tx, tenantId, examId);
      const current = await tx.publication.findFirst({ where: { tenantId, examId, isCurrent: true } });
      if (!current) throw new Error('PUBLICATION_NOT_FOUND');
      const updated = await tx.publication.update({ where: { id: current.id }, data: { isCurrent: false, withdrawnByMembershipId: membershipId, withdrawnAt: now, withdrawReason: reason } });
      await tx.exam.update({ where: { id: examId }, data: { state: 'EVALUATION', version: { increment: 1 } } });
      return publication(updated);
    });
  }

  currentStudent(tenantId: UUID, membershipId: UUID): Promise<CurrentStudentResultRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const student = await tx.student.findFirst({ where: { tenantId, membershipId }, select: { id: true } });
      if (!student) throw new Error('STUDENT_NOT_FOUND');
      const current = await tx.publication.findFirst({
        where: { tenantId, isCurrent: true, resultRun: { students: { some: { studentId: student.id } } } },
        include: {
          exam: { include: { ruleVersion: true } },
          resultRun: { include: { items: { where: { studentId: student.id }, orderBy: { subjectCode: 'asc' } }, students: { where: { studentId: student.id } } } },
        },
        orderBy: { publishedAt: 'desc' },
      });
      if (!current || !current.resultRun.students[0]) return null;
      const run = mapRun(current.resultRun, current.exam as ExamRow);
      const result = run.students[0]!;
      const base = { publication: publication(current), examId: current.examId, examCode: current.exam.code, examName: current.exam.name, ruleVersion: current.exam.ruleVersion.version };
      if (result.outcome === RESULT_OUTCOMES.WITHHELD) {
        return { ...base, outcome: 'WITHHELD', holdMessage: result.reason ?? 'Your result is withheld. Contact the examination office for assistance.' };
      }
      return { ...base, outcome: result.outcome, result };
    });
  }
}
