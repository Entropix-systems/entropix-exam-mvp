import type {
  EvaluationAssignmentInput,
  EvaluationSnapshot,
  EvaluationSubjectRecord,
  MarksBatchHistoryEvent,
  MarksReviewInput,
  MarksSaveInput,
  UUID,
  ValidatedResultRule,
} from '@entropix/contracts';
import { Prisma, PrismaClient, withTenant, type TenantTransaction } from '@entropix/db';
import { Injectable } from '@nestjs/common';

export interface EvaluationActor {
  membershipId: UUID;
  examiner: boolean;
  controller: boolean;
  departmentIds: readonly UUID[];
}

const activeExamStates = ['SCHEDULE_PUBLISHED', 'EVALUATION'] as const;
const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

async function lockEvaluation(tx: TenantTransaction, tenantId: UUID) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'evaluation:' + tenantId}, 0))`;
}

function mayReview(actor: EvaluationActor, departmentId: UUID): boolean {
  return actor.controller || actor.departmentIds.includes(departmentId);
}

function history(value: Prisma.JsonValue): MarksBatchHistoryEvent[] {
  return Array.isArray(value) ? value as unknown as MarksBatchHistoryEvent[] : [];
}

function nextHistory(
  current: Prisma.JsonValue,
  action: MarksBatchHistoryEvent['action'],
  membershipId: UUID,
  now: Date,
  reason: string | null = null,
): Prisma.InputJsonValue {
  return [...history(current), { action, actorMembershipId: membershipId, at: now.toISOString(), reason }] as unknown as Prisma.InputJsonValue;
}

const evaluationInclude = {
  subject: { include: { program: true } },
  exam: { include: { ruleVersion: true } },
  evaluationAssignment: { include: { faculty: true } },
  marksBatch: { include: { marks: true } },
  registrationSubjects: {
    where: { registration: { state: 'APPROVED' } },
    include: {
      registration: { include: { student: true } },
      seatAssignments: { include: { attendance: true, hallSitting: { include: { attendanceBatch: true } } } },
      incidentStudents: { include: { incident: true } },
    },
    orderBy: { registration: { student: { rollNo: 'asc' as const } } },
  },
  paper: {
    include: {
      hallSittings: { include: { incidents: { include: { affectedStudents: true } }, attendanceBatch: true } },
    },
  },
} as const;

type EvaluationRow = Prisma.ExamSubjectGetPayload<{ include: typeof evaluationInclude }>;

function conductReady(row: EvaluationRow): boolean {
  if (row.registrationSubjects.length === 0) return false;
  const completeAttendance = row.registrationSubjects.every((entry) =>
    entry.seatAssignments.length === 1
    && entry.seatAssignments[0]!.hallSitting.attendanceBatch?.state === 'SUBMITTED'
    && entry.seatAssignments[0]!.attendance
    && entry.seatAssignments[0]!.attendance.state !== 'NOT_MARKED',
  );
  const unresolvedHallIncident = row.paper?.hallSittings.some((sitting) =>
    sitting.incidents.some((incident) =>
      incident.kind === 'HALL' && incident.disposition === 'OPEN' && incident.affectedStudents.length === 0,
    ),
  ) ?? false;
  return completeAttendance && !unresolvedHallIncident;
}

function mapSubject(row: EvaluationRow, actor: EvaluationActor): EvaluationSubjectRecord {
  const rule = row.exam.ruleVersion.config as unknown as ValidatedResultRule;
  const batch = row.marksBatch;
  const assignment = row.evaluationAssignment;
  const editable = Boolean(
    assignment
    && actor.examiner
    && assignment.faculty.membershipId === actor.membershipId
    && (!batch || ['DRAFT', 'RETURNED'].includes(batch.state))
    && activeExamStates.includes(row.exam.state as typeof activeExamStates[number]),
  );
  return {
    examId: row.examId,
    examCode: row.exam.code,
    examName: row.exam.name,
    examState: row.exam.state as EvaluationSubjectRecord['examState'],
    inputRevision: row.exam.inputRevision,
    examSubjectId: row.id,
    subjectCode: row.subject.code,
    subjectName: row.subject.name,
    departmentId: row.subject.program.departmentId,
    ruleVersion: row.exam.ruleVersion.version,
    components: rule.components.map((component) => ({ component: component.component, maximum: component.maximum })),
    assignment: assignment ? {
      id: assignment.id,
      facultyId: assignment.facultyId,
      facultyName: assignment.faculty.name,
      version: assignment.version,
      assignedAt: assignment.assignedAt.toISOString(),
    } : null,
    batch: {
      id: batch?.id ?? null,
      state: (batch?.state ?? 'DRAFT') as EvaluationSubjectRecord['batch']['state'],
      version: batch?.version ?? 0,
      submittedByMembershipId: batch?.submittedByMembershipId ?? null,
      submittedAt: iso(batch?.submittedAt ?? null),
      reviewedByMembershipId: batch?.reviewedByMembershipId ?? null,
      reviewedAt: iso(batch?.reviewedAt ?? null),
      reviewReason: batch?.reviewReason ?? null,
      reopenedAt: iso(batch?.reopenedAt ?? null),
      reopenReason: batch?.reopenReason ?? null,
      history: batch ? history(batch.history) : [],
    },
    roster: row.registrationSubjects.map((entry) => {
      const seat = entry.seatAssignments[0];
      const authoritativeAttendance = seat?.hallSitting.attendanceBatch?.state === 'SUBMITTED' ? seat.attendance?.state : null;
      return {
        registrationSubjectId: entry.id,
        studentId: entry.registration.studentId,
        rollNo: entry.registration.student.rollNo,
        studentName: entry.registration.student.name,
        attendanceState: (authoritativeAttendance ?? 'NOT_MARKED') as EvaluationSubjectRecord['roster'][number]['attendanceState'],
        held: entry.incidentStudents.some((affected) => ['OPEN', 'RETAIN_WITHHELD'].includes(affected.incident.disposition)),
        marks: (batch?.marks.filter((mark) => mark.registrationSubjectId === entry.id) ?? []).map((mark) => ({
          component: mark.component as EvaluationSubjectRecord['components'][number]['component'],
          value: mark.value.toString(),
        })),
      };
    }),
    conductReady: conductReady(row),
    canAssign: mayReview(actor, row.subject.program.departmentId),
    canEdit: editable,
    canReview: mayReview(actor, row.subject.program.departmentId) && batch?.state === 'SUBMITTED',
  };
}

async function requiredSubject(tx: TenantTransaction, tenantId: UUID, examSubjectId: UUID): Promise<EvaluationRow> {
  const row = await tx.examSubject.findFirst({ where: { tenantId, id: examSubjectId }, include: evaluationInclude });
  if (!row) throw new Error('EXAM_SUBJECT_NOT_FOUND');
  return row;
}

function assertMutableExam(row: EvaluationRow) {
  if (row.exam.state === 'PUBLISHED') throw new Error('RESULTS_PUBLISHED');
  if (!activeExamStates.includes(row.exam.state as typeof activeExamStates[number])) throw new Error('INVALID_EXAM_STATE');
}

function assertReviewer(row: EvaluationRow, actor: EvaluationActor) {
  if (!mayReview(actor, row.subject.program.departmentId)) throw new Error('REVIEW_SCOPE_DENIED');
}

function assertComplete(row: EvaluationRow) {
  if (!conductReady(row)) throw new Error('CONDUCT_INCOMPLETE');
  const configured = new Map((row.exam.ruleVersion.config as unknown as ValidatedResultRule).components.map((component) => [component.component, Number(component.maximum)]));
  for (const roster of row.registrationSubjects) {
    const seat = roster.seatAssignments[0]!;
    const attendance = seat.attendance!.state;
    const values = new Map((row.marksBatch?.marks ?? []).filter((mark) => mark.registrationSubjectId === roster.id).map((mark) => [mark.component, Number(mark.value)]));
    for (const [component, maximum] of configured) {
      const value = values.get(component);
      if (attendance === 'ABSENT' && (component === 'FINAL' || component === 'EXTERNAL')) {
        if (value !== undefined) throw new Error('ABSENT_MARK_CONFLICT');
        continue;
      }
      if (attendance !== 'ABSENT' && value === undefined) throw new Error('INCOMPLETE_MARKS');
      if (value !== undefined && (value < 0 || value > maximum)) throw new Error('MARK_OUT_OF_RANGE');
    }
  }
}

@Injectable()
export class EvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  snapshot(tenantId: UUID, actor: EvaluationActor): Promise<EvaluationSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const departmentFilter = actor.controller ? undefined : { in: [...actor.departmentIds] };
      const faculty = await tx.faculty.findMany({
        where: { tenantId, status: 'ACTIVE', ...(departmentFilter ? { departmentId: departmentFilter } : {}) },
        include: { department: true },
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
      });
      const subjects = await tx.examSubject.findMany({
        where: {
          tenantId,
          exam: { state: { in: [...activeExamStates, 'PUBLISHED'] } },
          ...(actor.controller ? {} : {
            OR: [
              { subject: { program: { departmentId: { in: [...actor.departmentIds] } } } },
              { evaluationAssignment: { faculty: { membershipId: actor.membershipId } } },
            ],
          }),
        },
        include: evaluationInclude,
        orderBy: [{ exam: { registrationClosesAt: 'desc' } }, { subject: { code: 'asc' } }],
      });
      return {
        faculty: faculty.map((entry) => ({ id: entry.id, code: entry.code, name: entry.name, departmentId: entry.departmentId, departmentName: entry.department.name })),
        subjects: subjects.map((entry) => mapSubject(entry, actor)),
      };
    });
  }

  assign(tenantId: UUID, actor: EvaluationActor, examSubjectId: UUID, input: EvaluationAssignmentInput, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockEvaluation(tx, tenantId);
      const row = await requiredSubject(tx, tenantId, examSubjectId);
      assertMutableExam(row);
      assertReviewer(row, actor);
      if (row.marksBatch && !['DRAFT', 'RETURNED'].includes(row.marksBatch.state)) throw new Error('BATCH_LOCKED');
      const faculty = await tx.faculty.findFirst({
        where: { tenantId, id: input.facultyId, status: 'ACTIVE', departmentId: row.subject.program.departmentId },
      });
      if (!faculty) throw new Error('INVALID_FACULTY');
      const current = row.evaluationAssignment;
      if (!current) {
        if (input.expectedVersion !== 0) throw new Error('STALE_VERSION');
        return tx.evaluationAssignment.create({
          data: { tenantId, examSubjectId, facultyId: input.facultyId, assignedByMembershipId: actor.membershipId, assignedAt: now },
        });
      }
      if (current.version !== input.expectedVersion) throw new Error('STALE_VERSION');
      return tx.evaluationAssignment.update({
        where: { id: current.id },
        data: { facultyId: input.facultyId, assignedByMembershipId: actor.membershipId, assignedAt: now, version: { increment: 1 } },
      });
    });
  }

  save(tenantId: UUID, membershipId: UUID, examSubjectId: UUID, input: MarksSaveInput, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockEvaluation(tx, tenantId);
      const row = await requiredSubject(tx, tenantId, examSubjectId);
      assertMutableExam(row);
      if (!row.evaluationAssignment || row.evaluationAssignment.faculty.membershipId !== membershipId) throw new Error('NOT_ASSIGNED');
      if (row.marksBatch && !['DRAFT', 'RETURNED'].includes(row.marksBatch.state)) throw new Error('BATCH_LOCKED');

      const roster = new Map(row.registrationSubjects.map((entry) => [entry.id, entry]));
      const configured = new Map(
        (row.exam.ruleVersion.config as unknown as ValidatedResultRule).components.map((component) => [component.component, Number(component.maximum)]),
      );
      if (new Set(input.rows.map((entry) => entry.registrationSubjectId)).size !== input.rows.length) throw new Error('INVALID_ROSTER_ROW');
      for (const entry of input.rows) {
        const rosterEntry = roster.get(entry.registrationSubjectId);
        if (!rosterEntry) throw new Error('INVALID_ROSTER_ROW');
        if (
          entry.marks.length !== configured.size
          || new Set(entry.marks.map((mark) => mark.component)).size !== entry.marks.length
          || entry.marks.some((mark) => !configured.has(mark.component))
        ) throw new Error('INVALID_COMPONENT');
        const seat = rosterEntry.seatAssignments[0];
        const attendance = seat?.hallSitting.attendanceBatch?.state === 'SUBMITTED' ? seat.attendance?.state : null;
        for (const mark of entry.marks) {
          if (mark.value !== null && Number(mark.value) > configured.get(mark.component)!) throw new Error('MARK_OUT_OF_RANGE');
          if (attendance === 'ABSENT' && ['FINAL', 'EXTERNAL'].includes(mark.component) && mark.value !== null) throw new Error('ABSENT_MARK_CONFLICT');
        }
      }

      const existingBatch = row.marksBatch;
      let batch;
      if (!existingBatch) {
        if (input.expectedVersion !== 0) throw new Error('STALE_VERSION');
        batch = await tx.marksBatch.create({
          data: {
            tenantId,
            examSubjectId,
            history: [{ action: 'DRAFT_SAVED', actorMembershipId: membershipId, at: now.toISOString(), reason: null }],
          },
        });
      } else {
        if (existingBatch.version !== input.expectedVersion) throw new Error('STALE_VERSION');
        batch = await tx.marksBatch.update({
          where: { id: existingBatch.id },
          data: { version: { increment: 1 }, history: nextHistory(existingBatch.history, 'DRAFT_SAVED', membershipId, now) },
        });
      }

      for (const entry of input.rows) for (const mark of entry.marks) {
        const composite = { tenantId, marksBatchId: batch.id, registrationSubjectId: entry.registrationSubjectId, component: mark.component };
        if (mark.value === null) {
          await tx.mark.deleteMany({ where: composite });
        } else {
          await tx.mark.upsert({
            where: { tenantId_marksBatchId_registrationSubjectId_component: composite },
            create: {
              ...composite,
              examSubjectId,
              value: new Prisma.Decimal(mark.value),
              updatedByMembershipId: membershipId,
            },
            update: { value: new Prisma.Decimal(mark.value), updatedByMembershipId: membershipId, version: { increment: 1 } },
          });
        }
      }
      await tx.exam.update({ where: { id: row.examId }, data: { inputRevision: { increment: 1 } } });
      return batch;
    });
  }

  submit(tenantId: UUID, membershipId: UUID, examSubjectId: UUID, expectedVersion: number, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockEvaluation(tx, tenantId);
      const row = await requiredSubject(tx, tenantId, examSubjectId);
      assertMutableExam(row);
      if (!row.evaluationAssignment || row.evaluationAssignment.faculty.membershipId !== membershipId) throw new Error('NOT_ASSIGNED');
      const batch = row.marksBatch;
      if (!batch) throw new Error('BATCH_NOT_FOUND');
      if (!['DRAFT', 'RETURNED'].includes(batch.state)) throw new Error('BATCH_LOCKED');
      if (batch.version !== expectedVersion) throw new Error('STALE_VERSION');
      assertComplete(row);
      return tx.marksBatch.update({
        where: { id: batch.id },
        data: {
          state: 'SUBMITTED',
          version: { increment: 1 },
          submittedByMembershipId: membershipId,
          submittedAt: now,
          reviewedByMembershipId: null,
          reviewedAt: null,
          reviewReason: null,
          history: nextHistory(batch.history, 'SUBMITTED', membershipId, now),
        },
      });
    });
  }

  review(
    tenantId: UUID,
    actor: EvaluationActor,
    examSubjectId: UUID,
    state: 'RETURNED' | 'APPROVED',
    input: MarksReviewInput,
    now: Date,
  ) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockEvaluation(tx, tenantId);
      const row = await requiredSubject(tx, tenantId, examSubjectId);
      assertMutableExam(row);
      assertReviewer(row, actor);
      const batch = row.marksBatch;
      if (!batch) throw new Error('BATCH_NOT_FOUND');
      if (batch.state !== 'SUBMITTED') throw new Error('INVALID_BATCH_STATE');
      if (batch.version !== input.expectedVersion) throw new Error('STALE_VERSION');
      if (state === 'APPROVED' && batch.submittedByMembershipId === actor.membershipId) throw new Error('SELF_APPROVAL');
      if (state === 'APPROVED') assertComplete(row);
      const updated = await tx.marksBatch.update({
        where: { id: batch.id },
        data: {
          state,
          version: { increment: 1 },
          reviewedByMembershipId: actor.membershipId,
          reviewedAt: now,
          reviewReason: input.reason,
          history: nextHistory(batch.history, state, actor.membershipId, now, input.reason),
        },
      });
      await tx.exam.update({ where: { id: row.examId }, data: { inputRevision: { increment: 1 } } });
      return updated;
    });
  }

  reopen(tenantId: UUID, actor: EvaluationActor, examSubjectId: UUID, input: MarksReviewInput, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockEvaluation(tx, tenantId);
      const row = await requiredSubject(tx, tenantId, examSubjectId);
      assertMutableExam(row);
      if (!actor.controller) throw new Error('REVIEW_SCOPE_DENIED');
      const batch = row.marksBatch;
      if (!batch) throw new Error('BATCH_NOT_FOUND');
      if (batch.state !== 'APPROVED') throw new Error('INVALID_BATCH_STATE');
      if (batch.version !== input.expectedVersion) throw new Error('STALE_VERSION');
      const updated = await tx.marksBatch.update({
        where: { id: batch.id },
        data: {
          state: 'DRAFT',
          version: { increment: 1 },
          reopenedByMembershipId: actor.membershipId,
          reopenedAt: now,
          reopenReason: input.reason,
          history: nextHistory(batch.history, 'REOPENED', actor.membershipId, now, input.reason),
        },
      });
      await tx.exam.update({ where: { id: row.examId }, data: { inputRevision: { increment: 1 } } });
      return updated;
    });
  }
}
