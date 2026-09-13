import type {
  AssignDutyInput,
  AttendanceSaveInput,
  ConductResultState,
  ConductSnapshot,
  IncidentCreateInput,
  IncidentDisposition,
  UUID,
} from '@entropix/contracts';
import { PrismaClient, withTenant, type TenantTransaction } from '@entropix/db';
import { Injectable } from '@nestjs/common';

type Actor = { membershipId: UUID; controller: boolean };

export function attendanceCountsAsAttended(state: string): boolean {
  return state === 'PRESENT' || state === 'LATE';
}

export function incidentCreatesHold(disposition: string): boolean {
  return disposition === 'OPEN' || disposition === 'RETAIN_WITHHELD';
}

async function lockConduct(tx: TenantTransaction, tenantId: UUID) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'conduct:' + tenantId}, 0))`;
}

function inConductWindow(startsAt: Date | null, endsAt: Date | null, now: Date) {
  return Boolean(startsAt && endsAt && startsAt.getTime() <= now.getTime() && now.getTime() < endsAt.getTime());
}

async function editableSitting(tx: TenantTransaction, tenantId: UUID, sittingId: UUID, membershipId: UUID, now: Date) {
  const sitting = await tx.hallSitting.findFirst({
    where: { tenantId, id: sittingId },
    include: { examPaper: { include: { exam: true } }, duties: { include: { faculty: true } }, attendanceBatch: true },
  });
  if (!sitting) throw new Error('SITTING_NOT_FOUND');
  if (sitting.examPaper.exam.state === 'PUBLISHED') throw new Error('RESULTS_PUBLISHED');
  if (!['SCHEDULE_PUBLISHED', 'EVALUATION'].includes(sitting.examPaper.exam.state)) throw new Error('INVALID_CONDUCT_STATE');
  if (!inConductWindow(sitting.examPaper.startsAt, sitting.examPaper.endsAt, now)) throw new Error('OUTSIDE_CONDUCT_WINDOW');
  if (!sitting.duties.some((duty) => duty.state === 'ACCEPTED' && duty.faculty.membershipId === membershipId)) throw new Error('NOT_ASSIGNED');
  if (sitting.attendanceBatch?.state === 'SUBMITTED') throw new Error('ATTENDANCE_SUBMITTED');
  return sitting;
}

@Injectable()
export class ConductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  snapshot(tenantId: UUID, actor: Actor, now: Date): Promise<ConductSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const faculty = actor.controller ? await tx.faculty.findMany({
        where: { tenantId, status: 'ACTIVE', membership: { roleGrants: { some: { role: 'INVIGILATOR' } } } }, include: { department: true }, orderBy: [{ name: 'asc' }, { code: 'asc' }],
      }) : [];
      const sittings = await tx.hallSitting.findMany({
        where: {
          tenantId,
          examPaper: { startsAt: { not: null }, endsAt: { not: null }, exam: { state: { in: ['SCHEDULE_PUBLISHED', 'EVALUATION', 'PUBLISHED'] } } },
          ...(actor.controller ? {} : { duties: { some: { faculty: { membershipId: actor.membershipId } } } }),
        },
        include: {
          hall: true,
          examPaper: { include: { exam: { include: { tenant: true } }, examSubject: { include: { subject: true } } } },
          duties: { include: { faculty: true }, orderBy: { createdAt: 'asc' } },
          attendanceBatch: true,
          seatAssignments: {
            include: { attendance: true, registrationSubject: { include: { registration: { include: { student: true } } } } },
            orderBy: { seatNumber: 'asc' },
          },
          incidents: {
            include: { affectedStudents: { include: { registrationSubject: { include: { registration: { include: { student: true } } } } } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [{ examPaper: { startsAt: 'asc' } }, { roomOrder: 'asc' }],
      });
      return {
        faculty: faculty.map((entry) => ({ id: entry.id, code: entry.code, name: entry.name, departmentName: entry.department.name })),
        sittings: sittings.map((sitting) => {
          const ownAccepted = sitting.duties.some((duty) => duty.state === 'ACCEPTED' && duty.faculty.membershipId === actor.membershipId);
          const mayReadRoster = actor.controller || ownAccepted;
          const batch = sitting.attendanceBatch;
          return {
            id: sitting.id,
            examId: sitting.examPaper.examId,
            examCode: sitting.examPaper.exam.code,
            examName: sitting.examPaper.exam.name,
            examPaperId: sitting.examPaperId,
            examSubjectId: sitting.examPaper.examSubjectId,
            subjectCode: sitting.examPaper.examSubject.subject.code,
            subjectName: sitting.examPaper.examSubject.subject.name,
            hallCode: sitting.hall.code,
            hallName: sitting.hall.name,
            startsAt: sitting.examPaper.startsAt!.toISOString(),
            endsAt: sitting.examPaper.endsAt!.toISOString(),
            timezone: sitting.examPaper.exam.tenant.timezone,
            dutyReady: sitting.duties.some((duty) => duty.state === 'ACCEPTED'),
            canEditAttendance: ownAccepted && sitting.examPaper.exam.state !== 'PUBLISHED' && inConductWindow(sitting.examPaper.startsAt, sitting.examPaper.endsAt, now) && batch?.state !== 'SUBMITTED',
            duties: sitting.duties.filter((duty) => actor.controller || duty.faculty.membershipId === actor.membershipId).map((duty) => ({
              id: duty.id, hallSittingId: duty.hallSittingId, facultyId: duty.facultyId, facultyName: duty.faculty.name,
              state: duty.state as 'PENDING' | 'ACCEPTED' | 'DECLINED', version: duty.version,
              declineReason: duty.declineReason, replacesDutyId: duty.replacesDutyId, respondedAt: duty.respondedAt?.toISOString() ?? null,
            })),
            attendance: {
              id: batch?.id ?? null, state: (batch?.state ?? 'DRAFT') as 'DRAFT' | 'SUBMITTED', version: batch?.version ?? 0,
              submittedAt: batch?.submittedAt?.toISOString() ?? null, reopenedAt: batch?.reopenedAt?.toISOString() ?? null,
              reopenReason: batch?.reopenReason ?? null,
              rows: mayReadRoster ? sitting.seatAssignments.map((seat) => ({
                id: seat.attendance?.id ?? null, seatAssignmentId: seat.id, registrationSubjectId: seat.registrationSubjectId,
                studentId: seat.registrationSubject.registration.student.id, rollNo: seat.registrationSubject.registration.student.rollNo,
                studentName: seat.registrationSubject.registration.student.name, seatNumber: seat.seatNumber,
                state: (seat.attendance?.state ?? 'NOT_MARKED') as 'NOT_MARKED' | 'PRESENT' | 'ABSENT' | 'LATE', version: seat.attendance?.version ?? 0,
              })) : [],
            },
            incidents: mayReadRoster ? sitting.incidents.map((incident) => ({
              id: incident.id, hallSittingId: incident.hallSittingId, kind: incident.kind as 'STUDENT' | 'HALL',
              description: incident.description, disposition: incident.disposition as IncidentDisposition, version: incident.version,
              dispositionReason: incident.dispositionReason, createdAt: incident.createdAt.toISOString(), disposedAt: incident.disposedAt?.toISOString() ?? null,
              affectedStudents: incident.affectedStudents.map((affected) => ({
                registrationSubjectId: affected.registrationSubjectId, studentId: affected.registrationSubject.registration.student.id,
                rollNo: affected.registrationSubject.registration.student.rollNo, studentName: affected.registrationSubject.registration.student.name,
              })),
            })) : [],
          };
        }),
      };
    });
  }

  assignDuty(tenantId: UUID, membershipId: UUID, sittingId: UUID, input: AssignDutyInput) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      const [sitting, faculty] = await Promise.all([
        tx.hallSitting.findFirst({ where: { tenantId, id: sittingId }, include: { examPaper: true } }),
        tx.faculty.findFirst({ where: { tenantId, id: input.facultyId, status: 'ACTIVE', membership: { roleGrants: { some: { role: 'INVIGILATOR' } } } } }),
      ]);
      if (!sitting) throw new Error('SITTING_NOT_FOUND');
      if (!faculty) throw new Error('FACULTY_NOT_FOUND');
      if (!sitting.examPaper.startsAt || !sitting.examPaper.endsAt) throw new Error('SITTING_NOT_SCHEDULED');
      if (input.replacesDutyId) {
        const replaced = await tx.duty.findFirst({ where: { tenantId, id: input.replacesDutyId, hallSittingId: sittingId, replacements: { none: {} } } });
        if (!replaced || replaced.state !== 'DECLINED') throw new Error('INVALID_REPLACEMENT');
      }
      const overlap = await tx.duty.findFirst({ where: {
        tenantId, facultyId: input.facultyId, state: { in: ['PENDING', 'ACCEPTED'] },
        hallSitting: { examPaper: { startsAt: { lt: sitting.examPaper.endsAt }, endsAt: { gt: sitting.examPaper.startsAt } } },
      } });
      if (overlap) throw new Error('DUTY_OVERLAP');
      return tx.duty.create({ data: { tenantId, hallSittingId: sittingId, facultyId: input.facultyId, replacesDutyId: input.replacesDutyId, assignedByMembershipId: membershipId } });
    });
  }

  respondDuty(tenantId: UUID, membershipId: UUID, dutyId: UUID, response: 'ACCEPTED' | 'DECLINED', reason: string | null, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      const duty = await tx.duty.findFirst({ where: { tenantId, id: dutyId }, include: { faculty: true, hallSitting: { include: { examPaper: true, attendanceBatch: true } } } });
      if (!duty) throw new Error('DUTY_NOT_FOUND');
      if (duty.faculty.membershipId !== membershipId) throw new Error('NOT_ASSIGNED');
      if (duty.state !== 'PENDING' && !(response === 'DECLINED' && duty.state === 'ACCEPTED')) throw new Error('INVALID_DUTY_STATE');
      if (response === 'DECLINED' && duty.hallSitting.attendanceBatch?.state === 'SUBMITTED') throw new Error('ATTENDANCE_SUBMITTED');
      if (response === 'ACCEPTED') {
        const paper = duty.hallSitting.examPaper;
        const startsAt = paper.startsAt; const endsAt = paper.endsAt;
        if (!startsAt || !endsAt) throw new Error('SITTING_NOT_SCHEDULED');
        const overlap = await tx.duty.findFirst({ where: {
          tenantId, id: { not: duty.id }, facultyId: duty.facultyId, state: 'ACCEPTED',
          hallSitting: { examPaper: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } },
        } });
        if (overlap) throw new Error('DUTY_OVERLAP');
      }
      return tx.duty.update({ where: { id: duty.id }, data: {
        state: response, declineReason: response === 'DECLINED' ? reason : null,
        respondedByMembershipId: membershipId, respondedAt: now, version: { increment: 1 },
      } });
    });
  }

  saveAttendance(tenantId: UUID, membershipId: UUID, sittingId: UUID, input: AttendanceSaveInput, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      const sitting = await editableSitting(tx, tenantId, sittingId, membershipId, now);
      const seatIds = new Set((await tx.seatAssignment.findMany({ where: { tenantId, hallSittingId: sittingId }, select: { id: true } })).map((seat) => seat.id));
      if (new Set(input.rows.map((row) => row.seatAssignmentId)).size !== input.rows.length || input.rows.some((row) => !seatIds.has(row.seatAssignmentId))) throw new Error('INVALID_ROSTER_ROW');
      let batch = sitting.attendanceBatch;
      if (!batch) {
        if (input.expectedVersion !== 0) throw new Error('STALE_VERSION');
        batch = await tx.attendanceBatch.create({ data: { tenantId, hallSittingId: sittingId } });
      } else {
        if (batch.version !== input.expectedVersion) throw new Error('STALE_VERSION');
        batch = await tx.attendanceBatch.update({ where: { id: batch.id }, data: { version: { increment: 1 } } });
      }
      for (const row of input.rows) {
        await tx.attendance.upsert({
          where: { tenantId_seatAssignmentId: { tenantId, seatAssignmentId: row.seatAssignmentId } },
          create: { tenantId, attendanceBatchId: batch.id, hallSittingId: sittingId, seatAssignmentId: row.seatAssignmentId, state: row.state, updatedByMembershipId: membershipId },
          update: { state: row.state, updatedByMembershipId: membershipId, version: { increment: 1 } },
        });
      }
      return batch;
    });
  }

  submitAttendance(tenantId: UUID, membershipId: UUID, sittingId: UUID, expectedVersion: number, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      await editableSitting(tx, tenantId, sittingId, membershipId, now);
      const [batch, seatCount] = await Promise.all([
        tx.attendanceBatch.findFirst({ where: { tenantId, hallSittingId: sittingId }, include: { rows: true } }),
        tx.seatAssignment.count({ where: { tenantId, hallSittingId: sittingId } }),
      ]);
      if (!batch || batch.version !== expectedVersion) throw new Error('STALE_VERSION');
      if (batch.rows.length !== seatCount || batch.rows.some((row) => row.state === 'NOT_MARKED')) throw new Error('NOT_MARKED_REMAINS');
      return tx.attendanceBatch.update({ where: { id: batch.id }, data: { state: 'SUBMITTED', submittedByMembershipId: membershipId, submittedAt: now, version: { increment: 1 } } });
    });
  }

  reopenAttendance(tenantId: UUID, membershipId: UUID, sittingId: UUID, expectedVersion: number, reason: string, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      const batch = await tx.attendanceBatch.findFirst({ where: { tenantId, hallSittingId: sittingId }, include: { hallSitting: { include: { examPaper: { include: { exam: true } } } } } });
      if (!batch) throw new Error('ATTENDANCE_NOT_FOUND');
      if (batch.hallSitting.examPaper.exam.state === 'PUBLISHED') throw new Error('RESULTS_PUBLISHED');
      if (batch.state !== 'SUBMITTED') throw new Error('INVALID_ATTENDANCE_STATE');
      if (batch.version !== expectedVersion) throw new Error('STALE_VERSION');
      return tx.attendanceBatch.update({ where: { id: batch.id }, data: { state: 'DRAFT', reopenedByMembershipId: membershipId, reopenedAt: now, reopenReason: reason, version: { increment: 1 } } });
    });
  }

  createIncident(tenantId: UUID, actor: Actor, sittingId: UUID, input: IncidentCreateInput, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      const sitting = actor.controller
        ? await tx.hallSitting.findFirst({ where: { tenantId, id: sittingId }, include: { examPaper: { include: { exam: true } } } })
        : await editableSitting(tx, tenantId, sittingId, actor.membershipId, now);
      if (!sitting) throw new Error('SITTING_NOT_FOUND');
      if (actor.controller && sitting.examPaper.exam.state === 'PUBLISHED') throw new Error('RESULTS_PUBLISHED');
      if (input.kind === 'STUDENT' && input.registrationSubjectIds.length === 0) throw new Error('INCIDENT_STUDENT_REQUIRED');
      const uniqueIds = [...new Set(input.registrationSubjectIds)];
      if (uniqueIds.length !== input.registrationSubjectIds.length) throw new Error('INVALID_ROSTER_ROW');
      const affectedCount = await tx.seatAssignment.count({ where: { tenantId, hallSittingId: sittingId, registrationSubjectId: { in: uniqueIds } } });
      if (affectedCount !== uniqueIds.length) throw new Error('INVALID_ROSTER_ROW');
      return tx.incident.create({ data: {
        tenantId, hallSittingId: sittingId, kind: input.kind, description: input.description, createdByMembershipId: actor.membershipId,
        affectedStudents: { create: uniqueIds.map((registrationSubjectId) => ({ tenantId, registrationSubjectId })) },
      } });
    });
  }

  disposeIncident(tenantId: UUID, membershipId: UUID, incidentId: UUID, disposition: Exclude<IncidentDisposition, 'OPEN'>, expectedVersion: number, reason: string, now: Date) {
    return withTenant(this.prisma, tenantId, async (tx) => {
      await lockConduct(tx, tenantId);
      const incident = await tx.incident.findFirst({ where: { tenantId, id: incidentId }, include: { affectedStudents: true, hallSitting: { include: { examPaper: { include: { exam: true } } } } } });
      if (!incident) throw new Error('INCIDENT_NOT_FOUND');
      if (incident.hallSitting.examPaper.exam.state === 'PUBLISHED') throw new Error('RESULTS_PUBLISHED');
      if (incident.disposition !== 'OPEN') throw new Error('INCIDENT_CLOSED');
      if (incident.version !== expectedVersion) throw new Error('STALE_VERSION');
      if (incident.affectedStudents.length === 0 && disposition !== 'NO_RESULT_IMPACT') throw new Error('HALL_IMPACT_REQUIRED');
      if (incident.affectedStudents.length > 0 && disposition === 'NO_RESULT_IMPACT') throw new Error('INVALID_DISPOSITION');
      return tx.incident.update({ where: { id: incident.id }, data: { disposition, dispositionReason: reason, disposedByMembershipId: membershipId, disposedAt: now, version: { increment: 1 } } });
    });
  }

  resultState(tenantId: UUID, examId: UUID): Promise<ConductResultState> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { tenantId, id: examId }, include: {
        papers: { include: { hallSittings: { include: {
          duties: true, attendanceBatch: { include: { rows: { include: { seatAssignment: { include: { registrationSubject: { include: { registration: true } } } } } } } },
          incidents: { include: { affectedStudents: { include: { registrationSubject: { include: { registration: true } } } } } },
        } } } },
      } });
      if (!exam) throw new Error('EXAM_NOT_FOUND');
      const incompleteHallSittingIds: UUID[] = [];
      const unresolvedHallIncidentIds: UUID[] = [];
      const attendance: ConductResultState['attendance'][number][] = [];
      const holds: ConductResultState['holds'][number][] = [];
      for (const paper of exam.papers) for (const sitting of paper.hallSittings) {
        if (!sitting.duties.some((duty) => duty.state === 'ACCEPTED') || sitting.attendanceBatch?.state !== 'SUBMITTED') incompleteHallSittingIds.push(sitting.id);
        if (sitting.attendanceBatch?.state === 'SUBMITTED') for (const row of sitting.attendanceBatch.rows) attendance.push({
          registrationSubjectId: row.seatAssignment.registrationSubjectId,
          studentId: row.seatAssignment.registrationSubject.registration.studentId,
          examSubjectId: row.seatAssignment.examSubjectId,
          state: row.state as 'NOT_MARKED' | 'PRESENT' | 'ABSENT' | 'LATE',
          attended: attendanceCountsAsAttended(row.state),
        });
        for (const incident of sitting.incidents) {
          if (incident.kind === 'HALL' && incident.disposition === 'OPEN' && incident.affectedStudents.length === 0) unresolvedHallIncidentIds.push(incident.id);
          if (incidentCreatesHold(incident.disposition)) for (const affected of incident.affectedStudents) holds.push({
            incidentId: incident.id, studentId: affected.registrationSubject.registration.studentId,
            disposition: incident.disposition as 'OPEN' | 'RETAIN_WITHHELD',
          });
        }
      }
      return { examId, ready: incompleteHallSittingIds.length === 0 && unresolvedHallIncidentIds.length === 0, attendance, holds, incompleteHallSittingIds, unresolvedHallIncidentIds };
    });
  }
}
