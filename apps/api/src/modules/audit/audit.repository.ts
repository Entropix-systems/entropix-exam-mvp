import type { TenantRole, UUID } from '@entropix/contracts';
import { Prisma, PrismaClient, withTenant } from '@entropix/db';
import { Injectable } from '@nestjs/common';
import { buildCsv } from './csv.js';
import type {
  AuditActivityRow,
  CsvExport,
  DashboardExam,
  DashboardSnapshot,
  ReportKind,
  ReportingActor,
} from './audit.types.js';

const controllerRoles: readonly TenantRole[] = ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'];
const iso = (value: Date | null | undefined) => value?.toISOString() ?? '';

type DashboardActor = ReportingActor | 'PLATFORM';

function isController(actor: DashboardActor): boolean {
  if (actor === 'PLATFORM') return true;
  return controllerRoles.includes(actor.role);
}

export function availableReports(actor: DashboardActor): readonly ReportKind[] {
  if (actor === 'PLATFORM') return [];
  if (isController(actor)) return [
    'registration-roster',
    'timetable-hall-roster',
    'attendance-incidents',
    'evaluation-progress',
    'current-result-register',
    'audit-activity',
  ];
  if (actor.role === 'DEPARTMENT_ADMIN') return ['registration-roster', 'attendance-incidents', 'evaluation-progress'];
  if (actor.role === 'INVIGILATOR') return ['timetable-hall-roster', 'attendance-incidents'];
  if (actor.role === 'AUDITOR') return ['current-result-register', 'audit-activity'];
  return [];
}

function examScope(actor: DashboardActor): Prisma.ExamWhereInput {
  if (actor === 'PLATFORM') return {};
  if (isController(actor) || actor.role === 'AUDITOR') return {};
  if (actor.role === 'DEPARTMENT_ADMIN') return {
    term: { program: { departmentId: { in: [...actor.departmentIds] } } },
  };
  if (actor.role === 'FACULTY') return {
    subjects: { some: { evaluationAssignment: { faculty: { membershipId: actor.membershipId } } } },
  };
  if (actor.role === 'INVIGILATOR') return {
    papers: { some: { hallSittings: { some: { duties: { some: { faculty: { membershipId: actor.membershipId } } } } } } },
  };
  return { id: '__no_visible_exam__' };
}

function reportFileName(slug: string, kind: ReportKind): string {
  return `${slug}-${kind}.csv`;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  dashboard(tenantId: UUID, actor: DashboardActor, now = new Date()): Promise<DashboardSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const [tenant, exams] = await Promise.all([
        tx.tenant.findFirstOrThrow({ where: { id: tenantId }, select: { name: true, timezone: true } }),
        tx.exam.findMany({
          where: { tenantId, ...examScope(actor) },
          include: {
            term: { include: { academicYear: true } },
            registrations: { where: { state: 'APPROVED' }, select: { studentId: true } },
            subjects: {
              include: {
                subject: true,
                registrationSubjects: {
                  where: { registration: { state: 'APPROVED' } },
                  select: {
                    id: true,
                    registration: { select: { studentId: true } },
                    seatAssignments: { select: { id: true, attendance: { select: { state: true } } } },
                  },
                },
                marksBatch: { select: { state: true } },
                paper: {
                  include: {
                    seatAssignments: { select: { id: true } },
                    hallSittings: {
                      include: {
                        hall: { select: { name: true } },
                        attendanceBatch: { select: { state: true } },
                        incidents: {
                          select: {
                            kind: true,
                            disposition: true,
                            affectedStudents: {
                              select: {
                                registrationSubject: { select: { registration: { select: { studentId: true } } } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            resultRuns: { select: { id: true, inputRevision: true, computedAt: true }, orderBy: { computedAt: 'desc' } },
            publications: { where: { isCurrent: true }, select: { version: true, resultRunId: true }, take: 1 },
          },
          orderBy: [{ registrationClosesAt: 'desc' }, { code: 'asc' }],
        }),
      ]);

      const mapped: DashboardExam[] = exams.map((exam) => {
        const scheduledPapers = exam.subjects.filter((subject) => subject.paper?.startsAt && subject.paper.endsAt).length;
        const requiredSubjectSeats = exam.subjects.reduce((count, subject) => count + subject.registrationSubjects.length, 0);
        const allocatedSeats = exam.subjects.reduce((count, subject) => count + (subject.paper?.seatAssignments.length ?? 0), 0);
        const sittings = exam.subjects.flatMap((subject) => subject.paper?.hallSittings ?? []);
        const submittedSittings = sittings.filter((sitting) => sitting.attendanceBatch?.state === 'SUBMITTED').length;
        const incompleteAttendanceRows = exam.subjects.reduce((count, subject) => count + subject.registrationSubjects.filter((row) =>
          row.seatAssignments.length !== 1
          || !row.seatAssignments[0]?.attendance
          || row.seatAssignments[0]?.attendance?.state === 'NOT_MARKED',
        ).length, 0);
        const incidents = sittings.flatMap((sitting) => sitting.incidents);
        const heldStudents = new Set(incidents
          .filter((incident) => ['OPEN', 'RETAIN_WITHHELD'].includes(incident.disposition))
          .flatMap((incident) => incident.affectedStudents.map((entry) => entry.registrationSubject.registration.studentId)));
        const openIncidents = incidents.filter((incident) => incident.disposition === 'OPEN').length;
        const unresolvedHallIncidents = incidents.filter((incident) => incident.kind === 'HALL' && incident.disposition === 'OPEN' && incident.affectedStudents.length === 0).length;
        const approvedSubjects = exam.subjects.filter((subject) => subject.marksBatch?.state === 'APPROVED').length;
        const currentRun = exam.resultRuns.find((run) => run.inputRevision === exam.inputRevision) ?? null;
        const staleResultRun = !currentRun && exam.resultRuns.length > 0;
        const publication = exam.publications[0] ?? null;
        const academicReady = exam.subjects.length > 0 && exam.registrations.length > 0;
        const timetableReady = exam.subjects.length > 0 && scheduledPapers === exam.subjects.length && allocatedSeats === requiredSubjectSeats;
        const attendanceReady = sittings.length > 0 && submittedSittings === sittings.length && incompleteAttendanceRows === 0 && unresolvedHallIncidents === 0;
        const marksReady = exam.subjects.length > 0 && approvedSubjects === exam.subjects.length;
        const attention: string[] = [];
        if (!attendanceReady) attention.push(sittings.length === 0
          ? 'Conduct has not been initialized because no hall sittings exist.'
          : `${incompleteAttendanceRows} attendance row(s) and ${sittings.length - submittedSittings} sitting submission(s) remain incomplete.`);
        if (heldStudents.size > 0) attention.push(`${heldStudents.size} student result hold(s) remain explicit WITHHELD outcomes.`);
        if (!marksReady) attention.push(`${exam.subjects.length - approvedSubjects} subject marks batch(es) still require independent approval.`);
        if (staleResultRun) attention.push('The latest result run is stale because approved inputs changed.');
        if (!publication) attention.push('Results are not published to students.');

        return {
          examId: exam.id,
          examCode: exam.code,
          examName: exam.name,
          academicYear: exam.term.academicYear.name,
          termName: exam.term.name,
          state: exam.state,
          inputRevision: exam.inputRevision,
          registeredStudents: new Set(exam.registrations.map((registration) => registration.studentId)).size,
          scheduledPapers,
          totalPapers: exam.subjects.length,
          allocatedSeats,
          requiredSubjectSeats,
          submittedSittings,
          totalSittings: sittings.length,
          incompleteAttendanceRows,
          approvedSubjects,
          studentHolds: heldStudents.size,
          openIncidents,
          staleResultRun,
          currentRunId: currentRun?.id ?? null,
          currentPublicationVersion: publication?.version ?? null,
          steps: [
            { code: 'ACADEMIC_SETUP', label: 'Academic setup', detail: academicReady ? `${exam.registrations.length} approved registration(s) across ${exam.subjects.length} subject(s).` : 'Approved registrations and configured subjects are required.', status: academicReady ? 'COMPLETE' : 'PENDING' },
            { code: 'TIMETABLE', label: 'Timetable and hall plan', detail: `${scheduledPapers}/${exam.subjects.length} papers scheduled · ${allocatedSeats}/${requiredSubjectSeats} subject seats allocated.`, status: timetableReady ? 'COMPLETE' : 'PENDING' },
            { code: 'ATTENDANCE', label: 'Attendance and incident review', detail: `${submittedSittings}/${sittings.length} sittings submitted · ${heldStudents.size} student hold(s) · ${openIncidents} open incident(s).`, status: attendanceReady ? (heldStudents.size > 0 ? 'ATTENTION' : 'COMPLETE') : 'PENDING' },
            { code: 'MARKS', label: 'Marks approval', detail: `${approvedSubjects}/${exam.subjects.length} subject batches independently approved.`, status: marksReady ? 'COMPLETE' : 'PENDING' },
            { code: 'RESULT_RUN', label: 'Result computation', detail: currentRun ? `Current input revision ${exam.inputRevision} has a computed run.` : staleResultRun ? 'Available run is stale; recompute from approved inputs.' : 'No result run exists for the current inputs.', status: currentRun ? 'COMPLETE' : staleResultRun ? 'ATTENTION' : 'PENDING' },
            { code: 'PUBLICATION', label: 'Result publication', detail: publication ? `Publication v${publication.version} is visible to students.` : 'No current publication is visible to students.', status: publication ? 'COMPLETE' : 'PENDING' },
          ],
          attention,
          schedule: exam.subjects.flatMap((subject) => subject.paper ? [{
            paperId: subject.paper.id,
            subjectCode: subject.subject.code,
            subjectName: subject.subject.name,
            startsAt: subject.paper.startsAt?.toISOString() ?? null,
            halls: subject.paper.hallSittings.map((sitting) => sitting.hall.name).join(', ') || 'Not allocated',
          }] : []),
        };
      });

      return {
        institutionName: tenant.name,
        timezone: tenant.timezone,
        generatedAt: now.toISOString(),
        availableReports: availableReports(actor),
        exams: mapped,
      };
    });
  }

  activity(tenantId: UUID, limit = 100): Promise<readonly AuditActivityRow[]> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const rows = await tx.auditEvent.findMany({
        where: { tenantId },
        include: { actor: { include: { user: { select: { email: true } }, faculty: { select: { name: true } }, student: { select: { name: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        occurredAt: row.createdAt.toISOString(),
        actor: row.actor.faculty?.name ?? row.actor.student?.name ?? row.actor.user.email,
        actorRole: row.actorRole as TenantRole,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        reason: row.reason,
        requestId: row.requestId,
      }));
    });
  }

  record(input: {
    tenantId: UUID;
    actorMembershipId: UUID;
    actorRole: TenantRole;
    action: string;
    targetType: string;
    targetId: UUID | null;
    reason: string | null;
    requestId: string;
    createdAt?: Date;
  }): Promise<void> {
    return withTenant(this.prisma, input.tenantId, async (tx) => {
      await tx.auditEvent.createMany({ data: [input], skipDuplicates: true });
    });
  }

  export(tenantId: UUID, actor: ReportingActor, kind: ReportKind): Promise<CsvExport> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const tenant = await tx.tenant.findFirstOrThrow({ where: { id: tenantId }, select: { slug: true } });
      let headers: readonly string[];
      let rows: readonly (readonly unknown[])[];

      if (kind === 'registration-roster') {
        const records = await tx.registration.findMany({
          where: {
            tenantId,
            ...(actor.role === 'DEPARTMENT_ADMIN' ? { subjects: { some: { examSubject: { subject: { program: { departmentId: { in: [...actor.departmentIds] } } } } } } } : {}),
          },
          include: { exam: true, student: true, subjects: { include: { examSubject: { include: { subject: { include: { program: true } } } } } } },
          orderBy: [{ exam: { code: 'asc' } }, { student: { rollNo: 'asc' } }],
        });
        headers = ['Exam code', 'Exam name', 'Roll number', 'Student name', 'Registration state', 'Approved subject set'];
        rows = records.map((registration) => {
          const subjects = registration.subjects.filter((subject) => actor.role !== 'DEPARTMENT_ADMIN' || actor.departmentIds.includes(subject.examSubject.subject.program.departmentId));
          return [registration.exam.code, registration.exam.name, registration.student.rollNo, registration.student.name, registration.state, subjects.map((subject) => subject.examSubject.subject.code).sort().join(' | ')];
        });
      } else if (kind === 'timetable-hall-roster') {
        const papers = await tx.examPaper.findMany({
          where: { tenantId, ...(actor.role === 'INVIGILATOR' ? { hallSittings: { some: { duties: { some: { faculty: { membershipId: actor.membershipId } } } } } } : {}) },
          include: { exam: true, examSubject: { include: { subject: true } }, hallSittings: { include: { hall: true, duties: { include: { faculty: true } }, seatAssignments: { include: { registrationSubject: { include: { registration: { include: { student: true } } } } }, orderBy: { seatNumber: 'asc' } } }, orderBy: { roomOrder: 'asc' } } },
          orderBy: [{ exam: { code: 'asc' } }, { startsAt: 'asc' }],
        });
        headers = ['Exam code', 'Paper', 'Starts at', 'Ends at', 'Hall', 'Capacity', 'Roll number', 'Student name', 'Seat'];
        rows = papers.flatMap((paper) => paper.hallSittings
          .filter((sitting) => actor.role !== 'INVIGILATOR' || sitting.duties.some((duty) => duty.faculty.membershipId === actor.membershipId))
          .flatMap((sitting) => sitting.seatAssignments.length > 0
            ? sitting.seatAssignments.map((seat) => [paper.exam.code, `${paper.examSubject.subject.code} · ${paper.examSubject.subject.name}`, iso(paper.startsAt), iso(paper.endsAt), sitting.hall.name, sitting.hall.capacity, seat.registrationSubject.registration.student.rollNo, seat.registrationSubject.registration.student.name, seat.seatNumber])
            : [[paper.exam.code, `${paper.examSubject.subject.code} · ${paper.examSubject.subject.name}`, iso(paper.startsAt), iso(paper.endsAt), sitting.hall.name, sitting.hall.capacity, '', '', '']]));
      } else if (kind === 'attendance-incidents') {
        const sittings = await tx.hallSitting.findMany({
          where: {
            tenantId,
            ...(actor.role === 'INVIGILATOR' ? { duties: { some: { faculty: { membershipId: actor.membershipId } } } } : {}),
            ...(actor.role === 'DEPARTMENT_ADMIN' ? { examPaper: { examSubject: { subject: { program: { departmentId: { in: [...actor.departmentIds] } } } } } } : {}),
          },
          include: {
            hall: true,
            examPaper: { include: { exam: true, examSubject: { include: { subject: true } } } },
            seatAssignments: { include: { attendance: true, registrationSubject: { include: { registration: { include: { student: true } } } } }, orderBy: { seatNumber: 'asc' } },
            incidents: { include: { affectedStudents: true } },
          },
          orderBy: [{ examPaper: { exam: { code: 'asc' } } }, { roomOrder: 'asc' }],
        });
        headers = ['Exam code', 'Paper', 'Hall', 'Roll number', 'Student name', 'Seat', 'Attendance', 'Incident', 'Disposition'];
        rows = sittings.flatMap((sitting) => {
          const studentRows = sitting.seatAssignments.map((seat) => {
            const incidents = sitting.incidents.filter((incident) => incident.affectedStudents.some((entry) => entry.registrationSubjectId === seat.registrationSubjectId));
            return [sitting.examPaper.exam.code, sitting.examPaper.examSubject.subject.code, sitting.hall.name, seat.registrationSubject.registration.student.rollNo, seat.registrationSubject.registration.student.name, seat.seatNumber, seat.attendance?.state ?? 'NOT_MARKED', incidents.map((incident) => incident.kind).join(' | '), incidents.map((incident) => incident.disposition).join(' | ')];
          });
          const hallRows = sitting.incidents.filter((incident) => incident.kind === 'HALL' && incident.affectedStudents.length === 0).map((incident) => [sitting.examPaper.exam.code, sitting.examPaper.examSubject.subject.code, sitting.hall.name, '', '', '', '', 'HALL', incident.disposition]);
          return [...studentRows, ...hallRows];
        });
      } else if (kind === 'evaluation-progress') {
        const subjects = await tx.examSubject.findMany({
          where: { tenantId, ...(actor.role === 'DEPARTMENT_ADMIN' ? { subject: { program: { departmentId: { in: [...actor.departmentIds] } } } } : {}) },
          include: { exam: true, subject: true, evaluationAssignment: { include: { faculty: true } }, marksBatch: true },
          orderBy: [{ exam: { code: 'asc' } }, { subject: { code: 'asc' } }],
        });
        headers = ['Exam code', 'Exam name', 'Subject code', 'Subject name', 'Examiner', 'Batch state', 'Submitted at', 'Reviewed at'];
        rows = subjects.map((subject) => [subject.exam.code, subject.exam.name, subject.subject.code, subject.subject.name, subject.evaluationAssignment?.faculty.name ?? 'Not assigned', subject.marksBatch?.state ?? 'DRAFT', iso(subject.marksBatch?.submittedAt), iso(subject.marksBatch?.reviewedAt)]);
      } else if (kind === 'current-result-register') {
        const publications = await tx.publication.findMany({
          where: { tenantId, isCurrent: true },
          include: { exam: true, resultRun: { include: { students: { orderBy: { rollNo: 'asc' } } } } },
          orderBy: { publishedAt: 'desc' },
        });
        headers = ['Exam code', 'Exam name', 'Publication version', 'Published at', 'Roll number', 'Student name', 'Outcome', 'Percentage', 'GPA'];
        rows = publications.flatMap((publication) => publication.resultRun.students.map((student) => [publication.exam.code, publication.exam.name, publication.version, iso(publication.publishedAt), student.rollNo, student.studentName, student.outcome, student.outcome === 'WITHHELD' ? '' : student.percentage?.toString() ?? '', student.outcome === 'WITHHELD' ? '' : student.gpa?.toString() ?? '']));
      } else {
        const events = await tx.auditEvent.findMany({
          where: { tenantId },
          include: { actor: { include: { user: { select: { email: true } }, faculty: { select: { name: true } }, student: { select: { name: true } } } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1_000,
        });
        headers = ['Occurred at', 'Actor', 'Role', 'Action', 'Target type', 'Target ID', 'Reason', 'Request ID'];
        rows = events.map((event) => [iso(event.createdAt), event.actor.faculty?.name ?? event.actor.student?.name ?? event.actor.user.email, event.actorRole, event.action, event.targetType, event.targetId ?? '', event.reason ?? '', event.requestId]);
      }

      return {
        kind,
        fileName: reportFileName(tenant.slug, kind),
        contentType: 'text/csv;charset=utf-8',
        rowCount: rows.length,
        csv: buildCsv(headers, rows),
      };
    });
  }
}
