import type {
  AllocationPreview,
  ExamPaperRecord,
  ExamScheduleRecord,
  HallCreateInput,
  SchedulingSnapshot,
  SeatAssignmentRecord,
  UUID,
} from '@entropix/contracts';
import { PrismaClient, type TenantTransaction, withTenant } from '@entropix/db';
import { Injectable } from '@nestjs/common';

interface RosterEntry {
  registrationSubjectId: UUID;
  studentId: UUID;
  rollNo: string;
  studentName: string;
}

export function intervalsOverlap(firstStart: Date, firstEnd: Date, secondStart: Date, secondEnd: Date) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function planDeterministicSeats(
  roster: readonly RosterEntry[],
  halls: readonly { id: UUID; code: string; name: string; capacity: number }[],
) {
  const assignments: SeatAssignmentRecord[] = [];
  let rosterIndex = 0;
  for (const hall of halls) {
    for (let seatNumber = 1; seatNumber <= hall.capacity && rosterIndex < roster.length; seatNumber += 1) {
      const student = roster[rosterIndex++]!;
      assignments.push({
        id: null,
        registrationSubjectId: student.registrationSubjectId,
        studentId: student.studentId,
        rollNo: student.rollNo,
        studentName: student.studentName,
        hallSittingId: null,
        hallId: hall.id,
        hallCode: hall.code,
        hallName: hall.name,
        seatNumber,
      });
    }
  }
  return assignments;
}

async function lockScheduling(tx: TenantTransaction, tenantId: UUID) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))
  `;
}

async function rosterForPaper(tx: TenantTransaction, tenantId: UUID, examSubjectId: UUID): Promise<RosterEntry[]> {
  const rows = await tx.registrationSubject.findMany({
    where: { tenantId, examSubjectId, registration: { state: 'APPROVED' } },
    include: { registration: { include: { student: true } } },
    orderBy: { registration: { student: { rollNo: 'asc' } } },
  });
  return rows.map((row) => ({
    registrationSubjectId: row.id,
    studentId: row.registration.student.id,
    rollNo: row.registration.student.rollNo,
    studentName: row.registration.student.name,
  }));
}

async function assertNoConflicts(
  tx: TenantTransaction,
  tenantId: UUID,
  paperId: UUID,
  examSubjectId: UUID,
  startsAt: Date,
  endsAt: Date,
  hallIds: readonly UUID[],
) {
  const roster = await rosterForPaper(tx, tenantId, examSubjectId);
  const studentIds = roster.map((entry) => entry.studentId);
  if (studentIds.length) {
    const studentPapers = await tx.examPaper.findMany({
      where: {
        tenantId,
        id: { not: paperId },
        startsAt: { not: null },
        endsAt: { not: null },
        examSubject: {
          registrationSubjects: {
            some: { registration: { state: 'APPROVED', studentId: { in: studentIds } } },
          },
        },
      },
      select: { startsAt: true, endsAt: true },
    });
    if (studentPapers.some((paper) => paper.startsAt && paper.endsAt && intervalsOverlap(startsAt, endsAt, paper.startsAt, paper.endsAt))) throw new Error('STUDENT_OVERLAP');
  }
  if (hallIds.length) {
    const hallPapers = await tx.examPaper.findMany({
      where: {
        tenantId,
        id: { not: paperId },
        startsAt: { not: null },
        endsAt: { not: null },
        hallSittings: { some: { hallId: { in: [...hallIds] } } },
      },
      select: { startsAt: true, endsAt: true },
    });
    if (hallPapers.some((paper) => paper.startsAt && paper.endsAt && intervalsOverlap(startsAt, endsAt, paper.startsAt, paper.endsAt))) throw new Error('HALL_OVERLAP');
  }
  return roster;
}

async function allocationPreview(
  tx: TenantTransaction,
  tenantId: UUID,
  paperId: UUID,
  hallIds: readonly UUID[],
  expectedVersion: number,
): Promise<AllocationPreview> {
  const paper = await tx.examPaper.findFirst({ where: { tenantId, id: paperId } });
  if (!paper) throw new Error('PAPER_NOT_FOUND');
  if (paper.version !== expectedVersion) throw new Error('STALE_VERSION');
  if (!paper.startsAt || !paper.endsAt) throw new Error('PAPER_NOT_SCHEDULED');
  const selectedIds = [...new Set(hallIds)];
  if (!selectedIds.length || selectedIds.length !== hallIds.length) throw new Error('INVALID_HALL');
  const halls = await tx.hall.findMany({ where: { tenantId, id: { in: selectedIds } } });
  if (halls.length !== selectedIds.length) throw new Error('INVALID_HALL');
  const byId = new Map(halls.map((hall) => [hall.id, hall]));
  const orderedHalls = selectedIds.map((id) => byId.get(id)!);
  const roster = await assertNoConflicts(tx, tenantId, paper.id, paper.examSubjectId, paper.startsAt, paper.endsAt, selectedIds);
  const assignments = planDeterministicSeats(roster, orderedHalls);
  return {
    examPaperId: paper.id,
    expectedVersion: paper.version,
    rosterCount: roster.length,
    totalCapacity: orderedHalls.reduce((sum, hall) => sum + hall.capacity, 0),
    unallocatedCount: roster.length - assignments.length,
    assignments,
  };
}

async function paperRecord(tx: TenantTransaction, tenantId: UUID, paperId: UUID): Promise<ExamPaperRecord> {
  const paper = await tx.examPaper.findFirstOrThrow({
    where: { tenantId, id: paperId },
    include: {
      examSubject: { include: { subject: true } },
      hallSittings: {
        include: {
          hall: true,
          seatAssignments: {
            include: { registrationSubject: { include: { registration: { include: { student: true } } } } },
            orderBy: { seatNumber: 'asc' },
          },
        },
        orderBy: { roomOrder: 'asc' },
      },
    },
  });
  const roster = await rosterForPaper(tx, tenantId, paper.examSubjectId);
  const rosterIds = new Set(roster.map((entry) => entry.registrationSubjectId));
  const allocated = new Set(paper.hallSittings.flatMap((sitting) => sitting.seatAssignments.map((seat) => seat.registrationSubjectId)).filter((id) => rosterIds.has(id)));
  return {
    id: paper.id,
    examSubjectId: paper.examSubjectId,
    code: paper.examSubject.subject.code,
    name: paper.examSubject.subject.name,
    startsAt: paper.startsAt?.toISOString() ?? null,
    endsAt: paper.endsAt?.toISOString() ?? null,
    version: paper.version,
    approvedRosterCount: roster.length,
    allocatedCount: allocated.size,
    unallocatedStudents: roster.filter((entry) => !allocated.has(entry.registrationSubjectId)),
    sittings: paper.hallSittings.map((sitting) => ({
      id: sitting.id,
      hallId: sitting.hallId,
      hallCode: sitting.hall.code,
      hallName: sitting.hall.name,
      capacity: sitting.hall.capacity,
      roomOrder: sitting.roomOrder,
      version: sitting.version,
      seats: sitting.seatAssignments.map((seat) => ({
        id: seat.id,
        registrationSubjectId: seat.registrationSubjectId,
        studentId: seat.registrationSubject.registration.student.id,
        rollNo: seat.registrationSubject.registration.student.rollNo,
        studentName: seat.registrationSubject.registration.student.name,
        hallSittingId: sitting.id,
        hallId: sitting.hallId,
        hallCode: sitting.hall.code,
        hallName: sitting.hall.name,
        seatNumber: seat.seatNumber,
      })),
    })),
  };
}

async function examRecord(tx: TenantTransaction, tenantId: UUID, examId: UUID): Promise<ExamScheduleRecord> {
  const exam = await tx.exam.findFirstOrThrow({
    where: { tenantId, id: examId },
    include: { tenant: true, subjects: { include: { subject: true, paper: true }, orderBy: { subject: { code: 'asc' } } } },
  });
  const papers = await Promise.all(exam.subjects.flatMap((subject) => subject.paper ? [paperRecord(tx, tenantId, subject.paper.id)] : []));
  const scheduledPapers = papers.filter((paper) => paper.startsAt && paper.endsAt).length;
  const approvedRosterCount = papers.reduce((sum, paper) => sum + paper.approvedRosterCount, 0);
  const allocatedCount = papers.reduce((sum, paper) => sum + paper.allocatedCount, 0);
  const exactAllocations = papers.every((paper) => paper.allocatedCount === paper.approvedRosterCount && paper.sittings.reduce((sum, sitting) => sum + sitting.seats.length, 0) === paper.approvedRosterCount);
  return {
    examId: exam.id,
    code: exam.code,
    name: exam.name,
    state: exam.state as ExamScheduleRecord['state'],
    version: exam.version,
    scheduleRevision: exam.scheduleRevision,
    timezone: exam.tenant.timezone,
    papers,
    readiness: {
      ready: papers.length === exam.subjects.length && scheduledPapers === papers.length && exactAllocations,
      scheduledPapers,
      totalPapers: exam.subjects.length,
      approvedRosterCount,
      allocatedCount,
      unallocatedCount: approvedRosterCount - allocatedCount,
    },
  };
}

@Injectable()
export class SchedulingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  snapshot(tenantId: UUID): Promise<SchedulingSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const [halls, exams] = await Promise.all([
        tx.hall.findMany({ where: { tenantId }, include: { campus: true }, orderBy: [{ campus: { name: 'asc' } }, { code: 'asc' }] }),
        tx.exam.findMany({ where: { tenantId, state: { in: ['PREPARATION', 'SCHEDULE_PUBLISHED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true } }),
      ]);
      return {
        halls: halls.map((hall) => ({ id: hall.id, campusId: hall.campusId, campusName: hall.campus.name, code: hall.code, name: hall.name, capacity: hall.capacity, version: hall.version })),
        exams: await Promise.all(exams.map((exam) => examRecord(tx, tenantId, exam.id))),
      };
    }, { maxWait: 50_000, timeout: 120_000 });
  }

  initializeExam(tenantId: UUID, examId: UUID): Promise<ExamScheduleRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockScheduling(tx, tenantId);
      const exam = await tx.exam.findFirst({ where: { tenantId, id: examId }, include: { subjects: true } });
      if (!exam) throw new Error('EXAM_NOT_FOUND');
      if (!['PREPARATION', 'SCHEDULE_PUBLISHED'].includes(exam.state)) throw new Error('INVALID_EXAM_STATE');
      await tx.examPaper.createMany({
        data: exam.subjects.map((subject) => ({ tenantId, examId, examSubjectId: subject.id })),
        skipDuplicates: true,
      });
      return examRecord(tx, tenantId, examId);
    }, { maxWait: 50_000, timeout: 120_000 });
  }

  createHall(tenantId: UUID, input: HallCreateInput) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const campus = await tx.campus.findFirst({ where: { tenantId, id: input.campusId } });
      if (!campus) throw new Error('INVALID_CAMPUS');
      const existing = await tx.hall.findUnique({ where: { tenantId_campusId_code: { tenantId, campusId: input.campusId, code: input.code } }, include: { campus: true } });
      if (existing) {
        if (existing.name === input.name && existing.capacity === input.capacity) return { id: existing.id, campusId: existing.campusId, campusName: existing.campus.name, code: existing.code, name: existing.name, capacity: existing.capacity, version: existing.version };
        throw new Error('HALL_CODE_CONFLICT');
      }
      const hall = await tx.hall.create({ data: { tenantId, ...input }, include: { campus: true } });
      return { id: hall.id, campusId: hall.campusId, campusName: hall.campus.name, code: hall.code, name: hall.name, capacity: hall.capacity, version: hall.version };
    });
  }

  updatePaperSchedule(tenantId: UUID, paperId: UUID, startsAt: Date, endsAt: Date, expectedVersion: number): Promise<ExamPaperRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockScheduling(tx, tenantId);
      const paper = await tx.examPaper.findFirst({ where: { tenantId, id: paperId }, include: { hallSittings: true, exam: true } });
      if (!paper) throw new Error('PAPER_NOT_FOUND');
      if (paper.version !== expectedVersion) throw new Error('STALE_VERSION');
      await assertNoConflicts(tx, tenantId, paper.id, paper.examSubjectId, startsAt, endsAt, paper.hallSittings.map((entry) => entry.hallId));
      await tx.examPaper.update({ where: { id: paper.id }, data: { startsAt, endsAt, version: { increment: 1 } } });
      if (paper.exam.state === 'SCHEDULE_PUBLISHED') await tx.exam.update({ where: { id: paper.examId }, data: { state: 'PREPARATION', version: { increment: 1 } } });
      return paperRecord(tx, tenantId, paper.id);
    });
  }

  previewAllocation(tenantId: UUID, paperId: UUID, hallIds: readonly UUID[], expectedVersion: number) {
    return withTenant(this.prisma, tenantId, (tx) => allocationPreview(tx, tenantId, paperId, hallIds, expectedVersion));
  }

  commitAllocation(tenantId: UUID, paperId: UUID, hallIds: readonly UUID[], expectedVersion: number): Promise<ExamPaperRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockScheduling(tx, tenantId);
      const preview = await allocationPreview(tx, tenantId, paperId, hallIds, expectedVersion);
      if (preview.unallocatedCount) throw new Error('INSUFFICIENT_CAPACITY');
      const paper = await tx.examPaper.findFirstOrThrow({ where: { tenantId, id: paperId }, include: { exam: true } });
      await tx.hallSitting.deleteMany({ where: { tenantId, examPaperId: paperId } });
      for (const [index, hallId] of hallIds.entries()) {
        const sitting = await tx.hallSitting.create({ data: { tenantId, examPaperId: paperId, hallId, roomOrder: index + 1 } });
        const assigned = preview.assignments.filter((entry) => entry.hallId === hallId);
        if (assigned.length) await tx.seatAssignment.createMany({ data: assigned.map((entry) => ({ tenantId, examPaperId: paperId, examSubjectId: paper.examSubjectId, hallSittingId: sitting.id, registrationSubjectId: entry.registrationSubjectId, seatNumber: entry.seatNumber })) });
      }
      await tx.examPaper.update({ where: { id: paperId }, data: { version: { increment: 1 } } });
      if (paper.exam.state === 'SCHEDULE_PUBLISHED') await tx.exam.update({ where: { id: paper.examId }, data: { state: 'PREPARATION', version: { increment: 1 } } });
      return paperRecord(tx, tenantId, paperId);
    });
  }

  publish(tenantId: UUID, examId: UUID, expectedVersion: number): Promise<ExamScheduleRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockScheduling(tx, tenantId);
      const exam = await tx.exam.findFirst({ where: { tenantId, id: examId } });
      if (!exam) throw new Error('EXAM_NOT_FOUND');
      if (exam.version !== expectedVersion) throw new Error('STALE_VERSION');
      const current = await examRecord(tx, tenantId, examId);
      if (!current.readiness.ready || current.readiness.approvedRosterCount === 0) throw new Error('SCHEDULE_NOT_READY');
      for (const paper of current.papers) {
        await assertNoConflicts(
          tx,
          tenantId,
          paper.id,
          paper.examSubjectId,
          new Date(paper.startsAt!),
          new Date(paper.endsAt!),
          paper.sittings.map((sitting) => sitting.hallId),
        );
      }
      if (exam.state === 'SCHEDULE_PUBLISHED') return current;
      if (exam.state !== 'PREPARATION') throw new Error('INVALID_EXAM_STATE');
      await tx.exam.update({ where: { id: examId }, data: { state: 'SCHEDULE_PUBLISHED', scheduleRevision: { increment: 1 }, version: { increment: 1 } } });
      return examRecord(tx, tenantId, examId);
    }, { maxWait: 50_000, timeout: 120_000 });
  }
}
