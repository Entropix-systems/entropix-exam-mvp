import type {
  CurrentStudentDocumentMetadata,
  OwnPublishedResultItemRecord,
  OwnPublishedResultRecord,
  OwnRegistrationRecord,
  OwnTimetableRecord,
  ResultComponentSnapshot,
  ResultOutcome,
  StudentPortalSnapshot,
  UUID,
} from '@entropix/contracts';
import { Prisma, PrismaClient, withTenant } from '@entropix/db';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

const studentSelect = {
  id: true,
  rollNo: true,
  name: true,
  cohort: { select: { name: true } },
  tenant: { select: { name: true, timezone: true } },
  registrations: {
    where: { state: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      version: true,
      reviewedAt: true,
      exam: {
        select: {
          id: true,
          code: true,
          name: true,
          state: true,
          scheduleRevision: true,
          term: { select: { name: true, academicYear: { select: { name: true } } } },
        },
      },
      subjects: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          examSubject: {
            select: {
              id: true,
              subject: { select: { code: true, name: true, credits: true } },
              paper: { select: { id: true, startsAt: true, endsAt: true } },
            },
          },
          seatAssignments: {
            select: {
              examPaperId: true,
              seatNumber: true,
              hallSitting: {
                select: { hall: { select: { id: true, code: true, name: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StudentSelect;

type StudentRow = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

function documentIssueId(
  kind: 'ADM' | 'GRC',
  tenantId: UUID,
  studentId: UUID,
  sourceId: UUID,
  version: number,
): string {
  const suffix = createHash('sha256')
    .update(`${kind}:${tenantId}:${studentId}:${sourceId}:${version}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `${kind}-${version}-${suffix}`;
}

function mapComponents(value: Prisma.JsonValue): readonly ResultComponentSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      component: row.component as ResultComponentSnapshot['component'],
      mark: typeof row.mark === 'string' ? row.mark : null,
      maximum: String(row.maximum),
      weight: String(row.weight),
      percentage: typeof row.percentage === 'string' ? row.percentage : null,
    };
  });
}

function mapRegistrations(student: StudentRow): OwnRegistrationRecord[] {
  return student.registrations.map((registration) => ({
    id: registration.id,
    examId: registration.exam.id,
    examCode: registration.exam.code,
    examName: registration.exam.name,
    academicYear: registration.exam.term.academicYear.name,
    termName: registration.exam.term.name,
    state: 'APPROVED',
    version: registration.version,
    approvedAt: registration.reviewedAt?.toISOString() ?? null,
    subjects: registration.subjects.map((subject) => ({
      registrationSubjectId: subject.id,
      examSubjectId: subject.examSubject.id,
      code: subject.examSubject.subject.code,
      name: subject.examSubject.subject.name,
      credits: subject.examSubject.subject.credits,
    })),
  }));
}

function mapTimetables(student: StudentRow): OwnTimetableRecord[] {
  return student.registrations.flatMap((registration) => {
    const exam = registration.exam;
    if (!['SCHEDULE_PUBLISHED', 'EVALUATION', 'PUBLISHED'].includes(exam.state) || exam.scheduleRevision < 1) return [];
    const papers = registration.subjects.map((subject) => {
      const paper = subject.examSubject.paper;
      const seat = paper
        ? subject.seatAssignments.find((assignment) => assignment.examPaperId === paper.id)
        : null;
      if (!paper?.startsAt || !paper.endsAt || !seat) return null;
      return {
        examPaperId: paper.id,
        examSubjectId: subject.examSubject.id,
        subjectCode: subject.examSubject.subject.code,
        subjectName: subject.examSubject.subject.name,
        startsAt: paper.startsAt.toISOString(),
        endsAt: paper.endsAt.toISOString(),
        hallId: seat.hallSitting.hall.id,
        hallCode: seat.hallSitting.hall.code,
        hallName: seat.hallSitting.hall.name,
        seatNumber: seat.seatNumber,
      };
    });
    if (papers.length !== registration.subjects.length || papers.some((paper) => !paper)) return [];
    const orderedPapers = [...papers as OwnTimetableRecord['papers']]
      .sort((first, second) => first.startsAt.localeCompare(second.startsAt));
    return [{
      examId: exam.id,
      examCode: exam.code,
      examName: exam.name,
      timezone: student.tenant.timezone,
      scheduleRevision: exam.scheduleRevision,
      papers: orderedPapers,
    }];
  });
}

@Injectable()
export class StudentPortalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  snapshot(tenantId: UUID, membershipId: UUID): Promise<StudentPortalSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { tenantId, membershipId },
        select: studentSelect,
      });
      if (!student) throw new Error('STUDENT_NOT_FOUND');

      const registrations = mapRegistrations(student);
      const timetables = mapTimetables(student);
      const current = await tx.publication.findFirst({
        where: {
          tenantId,
          isCurrent: true,
          exam: {
            state: 'PUBLISHED',
            registrations: { some: { studentId: student.id, state: 'APPROVED' } },
          },
          resultRun: { students: { some: { studentId: student.id } } },
        },
        select: {
          id: true,
          version: true,
          publishedAt: true,
          resultRunId: true,
          exam: { select: { id: true, code: true, name: true, ruleVersion: { select: { version: true } } } },
        },
        orderBy: { publishedAt: 'desc' },
      });

      let result: OwnPublishedResultRecord | null = null;
      if (current) {
        const aggregate = await tx.studentResult.findFirst({
          where: { tenantId, resultRunId: current.resultRunId, studentId: student.id },
        });
        if (aggregate) {
          const base = {
            publicationId: current.id,
            publicationVersion: current.version,
            publishedAt: current.publishedAt.toISOString(),
            examId: current.exam.id,
            examCode: current.exam.code,
            examName: current.exam.name,
            ruleVersion: current.exam.ruleVersion.version,
          };
          if (aggregate.outcome === 'WITHHELD') {
            result = {
              ...base,
              outcome: 'WITHHELD',
              holdMessage: aggregate.reason ?? 'Your result is withheld. Contact the examination office for assistance.',
            };
          } else {
            const items = await tx.resultItem.findMany({
              where: { tenantId, resultRunId: current.resultRunId, studentId: student.id },
              orderBy: { subjectCode: 'asc' },
            });
            result = {
              ...base,
              outcome: aggregate.outcome as Exclude<ResultOutcome, 'WITHHELD'>,
              percentage: aggregate.percentage?.toString() ?? null,
              gpa: aggregate.gpa?.toString() ?? null,
              totalCredits: aggregate.totalCredits.toString(),
              items: items.map((item): OwnPublishedResultItemRecord => {
                const hidden = item.outcome === 'ABSENT';
                return {
                  id: item.id,
                  subjectCode: item.subjectCode,
                  subjectName: item.subjectName,
                  credits: item.credits,
                  outcome: item.outcome as ResultOutcome,
                  percentage: hidden ? null : item.percentage?.toString() ?? null,
                  components: hidden ? [] : mapComponents(item.components),
                  grade: hidden ? null : item.grade,
                  gradePoints: hidden ? null : item.gradePoints?.toString() ?? null,
                  reason: item.reason,
                };
              }),
            };
          }
        }
      }

      const admitCards: CurrentStudentDocumentMetadata[] = timetables.map((timetable) => {
        const registration = registrations.find((entry) => entry.examId === timetable.examId)!;
        return {
          kind: 'ADMIT_CARD',
          issueId: documentIssueId('ADM', tenantId, student.id, registration.id, timetable.scheduleRevision),
          examId: timetable.examId,
          title: `${timetable.examName} admit card`,
          sourceId: registration.id,
          version: timetable.scheduleRevision,
          current: true,
        };
      });
      const gradeCard: CurrentStudentDocumentMetadata[] = result && result.outcome !== 'WITHHELD'
        ? [{
            kind: 'GRADE_CARD',
            issueId: documentIssueId('GRC', tenantId, student.id, result.publicationId, result.publicationVersion),
            examId: result.examId,
            title: `${result.examName} grade card`,
            sourceId: result.publicationId,
            version: result.publicationVersion,
            current: true,
          }]
        : [];

      return {
        student: {
          id: student.id,
          rollNo: student.rollNo,
          name: student.name,
          cohortName: student.cohort.name,
          institutionName: student.tenant.name,
        },
        registrations,
        timetables,
        result,
        documents: [...admitCards, ...gradeCard],
      };
    });
  }
}
