import type { EligibilitySnapshot, ExamCreateInput, ExamRecord, ExamsSnapshot, RegistrationRecord, UUID, ValidatedResultRule } from '@entropix/contracts';
import { Prisma, PrismaClient, withTenant } from '@entropix/db';
import { Injectable } from '@nestjs/common';

const registrationInclude = {
  student: true,
  subjects: { include: { examSubject: { include: { subject: true } } }, orderBy: { createdAt: 'asc' as const } },
} as const;
const examInclude = {
  ruleVersion: true,
  subjects: { include: { subject: true }, orderBy: { subject: { code: 'asc' as const } } },
  registrations: { include: registrationInclude, orderBy: { createdAt: 'desc' as const } },
} as const;
type ExamRow = Prisma.ExamGetPayload<{ include: typeof examInclude }>;
type RegistrationRow = Prisma.RegistrationGetPayload<{ include: typeof registrationInclude }>;

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;
function mapRegistration(row: RegistrationRow): RegistrationRecord {
  return {
    id: row.id, examId: row.examId, studentId: row.studentId,
    student: { rollNo: row.student.rollNo, name: row.student.name },
    state: row.state as RegistrationRecord['state'], version: row.version,
    controllerEligible: row.controllerEligible,
    controllerEligibilityReason: row.controllerEligibilityReason,
    eligibilitySnapshot: row.eligibilitySnapshot as EligibilitySnapshot | null,
    submittedAt: iso(row.submittedAt), reviewedByMembershipId: row.reviewedByMembershipId,
    reviewedAt: iso(row.reviewedAt), decisionReason: row.decisionReason,
    subjects: row.subjects.map((entry) => ({
      id: entry.id, examSubjectId: entry.examSubjectId, enrolmentId: entry.enrolmentId,
      subjectId: entry.examSubject.subject.id, code: entry.examSubject.subject.code, name: entry.examSubject.subject.name,
    })),
  };
}
function mapExam(row: ExamRow): ExamRecord {
  return {
    id: row.id, termId: row.termId, code: row.code, name: row.name,
    registrationMode: row.registrationMode as ExamRecord['registrationMode'],
    state: row.state as ExamRecord['state'], registrationOpensAt: row.registrationOpensAt.toISOString(),
    registrationClosesAt: row.registrationClosesAt.toISOString(), version: row.version,
    scheduleRevision: row.scheduleRevision, inputRevision: row.inputRevision,
    ruleVersion: { id: row.ruleVersion.id, version: row.ruleVersion.version, config: row.ruleVersion.config as unknown as ValidatedResultRule, frozenAt: iso(row.ruleVersion.frozenAt) },
    subjects: row.subjects.map((entry) => ({ id: entry.id, subjectId: entry.subject.id, code: entry.subject.code, name: entry.subject.name, credits: entry.subject.credits })),
    registrations: row.registrations.map((entry) => mapRegistration(entry as RegistrationRow)),
  };
}

export interface RegistrationEligibilityContext {
  registration: RegistrationRecord;
  studentStatus: string;
  studentTermId: UUID;
  examTermId: UUID;
  examState: string;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  selected: readonly { examSubjectId: UUID; enrolmentId: UUID; enrolmentStatus: string }[];
}

@Injectable()
export class ExamsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async snapshot(tenantId: UUID, studentMembershipId: UUID | null): Promise<ExamsSnapshot> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const rows = await tx.exam.findMany({
        where: { tenantId },
        include: {
          ...examInclude,
          registrations: { ...examInclude.registrations, where: studentMembershipId ? { student: { membershipId: studentMembershipId } } : undefined },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { exams: rows.map((row) => mapExam(row as ExamRow)) };
    });
  }

  async createExam(tenantId: UUID, input: ExamCreateInput, rule: ValidatedResultRule): Promise<ExamRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const term = await tx.term.findFirst({ where: { tenantId, id: input.termId } });
      if (!term) throw new Error('INVALID_TERM');
      const subjectIds = [...new Set(input.subjectIds)];
      const subjects = await tx.subject.findMany({ where: { tenantId, id: { in: subjectIds }, programId: term.programId } });
      if (subjects.length !== subjectIds.length) throw new Error('INVALID_SUBJECT');
      const existing = await tx.exam.findUnique({ where: { tenantId_termId_code: { tenantId, termId: input.termId, code: input.code } }, include: examInclude });
      if (existing) {
        const sameSubjects = new Set(existing.subjects.map((entry) => entry.subjectId));
        if (existing.name === input.name && existing.registrationMode === input.registrationMode && existing.registrationOpensAt.getTime() === new Date(input.registrationOpensAt).getTime() && existing.registrationClosesAt.getTime() === new Date(input.registrationClosesAt).getTime() && subjectIds.length === sameSubjects.size && subjectIds.every((id) => sameSubjects.has(id)) && JSON.stringify(existing.ruleVersion.config) === JSON.stringify(rule)) return mapExam(existing);
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      const latest = await tx.ruleVersion.aggregate({ where: { tenantId }, _max: { version: true } });
      const ruleVersion = await tx.ruleVersion.create({ data: { tenantId, version: (latest._max.version ?? 0) + 1, config: rule as unknown as Prisma.InputJsonValue } });
      const created = await tx.exam.create({
        data: {
          tenantId, termId: input.termId, ruleVersionId: ruleVersion.id, code: input.code, name: input.name,
          registrationMode: input.registrationMode, registrationOpensAt: new Date(input.registrationOpensAt), registrationClosesAt: new Date(input.registrationClosesAt),
        },
      });
      await tx.examSubject.createMany({ data: subjects.map((subject) => ({ tenantId, examId: created.id, subjectId: subject.id })) });
      return mapExam(await tx.exam.findUniqueOrThrow({ where: { id: created.id }, include: examInclude }));
    });
  }

  async openRegistration(tenantId: UUID, examId: UUID): Promise<ExamRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { tenantId, id: examId } });
      if (!exam) return null;
      if (exam.state === 'REGISTRATION_OPEN') return mapExam(await tx.exam.findUniqueOrThrow({ where: { id: exam.id }, include: examInclude }));
      if (exam.state !== 'DRAFT') return null;
      await tx.ruleVersion.update({ where: { id: exam.ruleVersionId }, data: { frozenAt: new Date() } });
      return mapExam(await tx.exam.update({ where: { id: exam.id }, data: { state: 'REGISTRATION_OPEN', version: { increment: 1 } }, include: examInclude }));
    });
  }

  async closeRegistration(tenantId: UUID, examId: UUID): Promise<ExamRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const existing = await tx.exam.findFirst({ where: { tenantId, id: examId }, include: examInclude });
      if (existing?.state === 'PREPARATION') return mapExam(existing);
      const changed = await tx.exam.updateMany({ where: { tenantId, id: examId, state: 'REGISTRATION_OPEN' }, data: { state: 'PREPARATION', version: { increment: 1 } } });
      return changed.count ? mapExam(await tx.exam.findUniqueOrThrow({ where: { id: examId }, include: examInclude })) : null;
    });
  }

  async studentIdForMembership(tenantId: UUID, membershipId: UUID): Promise<UUID | null> {
    return withTenant(this.prisma, tenantId, async (tx) => (await tx.student.findFirst({ where: { tenantId, membershipId }, select: { id: true } }))?.id ?? null);
  }

  async saveDraft(tenantId: UUID, examId: UUID, studentId: UUID, examSubjectIds: readonly UUID[], now = new Date()): Promise<RegistrationRecord> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { tenantId, id: examId }, include: { subjects: true } });
      if (!exam) throw new Error('EXAM_NOT_FOUND');
      if (exam.registrationMode !== 'APPLICATION') throw new Error('APPLICATION_MODE_REQUIRED');
      if (exam.state !== 'REGISTRATION_OPEN' || now < exam.registrationOpensAt || now > exam.registrationClosesAt) throw new Error('REGISTRATION_CLOSED');
      const selectedIds = [...new Set(examSubjectIds)];
      if (!selectedIds.length || selectedIds.some((id) => !exam.subjects.some((subject) => subject.id === id))) throw new Error('INVALID_SUBJECT');
      const selected = await tx.examSubject.findMany({ where: { tenantId, examId, id: { in: selectedIds } } });
      const student = await tx.student.findFirst({ where: { tenantId, id: studentId } });
      if (!student) throw new Error('STUDENT_NOT_FOUND');
      const enrolments = await tx.enrolment.findMany({ where: { tenantId, studentId, cohortId: student.cohortId, subjectId: { in: selected.map((entry) => entry.subjectId) } } });
      if (enrolments.length !== selected.length) throw new Error('UNENROLLED_SUBJECT');
      const enrolmentBySubject = new Map(enrolments.map((entry) => [entry.subjectId, entry]));
      const existing = await tx.registration.findUnique({ where: { tenantId_examId_studentId: { tenantId, examId, studentId } }, include: { subjects: true } });
      if (existing && !['DRAFT', 'REJECTED'].includes(existing.state)) throw new Error('INVALID_TRANSITION');
      if (existing) {
        const currentIds = new Set(existing.subjects.map((entry) => entry.examSubjectId));
        if (currentIds.size === selectedIds.length && selectedIds.every((id) => currentIds.has(id))) return mapRegistration(await tx.registration.findUniqueOrThrow({ where: { id: existing.id }, include: registrationInclude }));
      }
      const registration = existing
        ? await tx.registration.update({ where: { id: existing.id }, data: { eligibilitySnapshot: Prisma.JsonNull, reviewedAt: null, reviewedByMembershipId: null, decisionReason: null, version: { increment: 1 } } })
        : await tx.registration.create({ data: { tenantId, examId, studentId } });
      await tx.registrationSubject.deleteMany({ where: { tenantId, registrationId: registration.id } });
      await tx.registrationSubject.createMany({ data: selected.map((entry) => ({ tenantId, registrationId: registration.id, examId, examSubjectId: entry.id, enrolmentId: enrolmentBySubject.get(entry.subjectId)!.id })) });
      return mapRegistration(await tx.registration.findUniqueOrThrow({ where: { id: registration.id }, include: registrationInclude }));
    });
  }

  async eligibilityContext(tenantId: UUID, registrationId: UUID): Promise<RegistrationEligibilityContext | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const row = await tx.registration.findFirst({
        where: { tenantId, id: registrationId },
        include: { student: { include: { cohort: true } }, exam: true, subjects: { include: { enrolment: true, examSubject: { include: { subject: true } } } } },
      });
      if (!row) return null;
      const registration = await tx.registration.findUniqueOrThrow({ where: { id: row.id }, include: registrationInclude });
      return {
        registration: mapRegistration(registration), studentStatus: row.student.status, studentTermId: row.student.cohort.termId,
        examTermId: row.exam.termId, examState: row.exam.state, registrationOpensAt: row.exam.registrationOpensAt, registrationClosesAt: row.exam.registrationClosesAt,
        selected: row.subjects.map((entry) => ({ examSubjectId: entry.examSubjectId, enrolmentId: entry.enrolmentId, enrolmentStatus: entry.enrolment.status })),
      };
    });
  }

  async transition(tenantId: UUID, registrationId: UUID, from: readonly string[], state: string, snapshot: EligibilitySnapshot | null, reviewerMembershipId: UUID | null, reason: string | null, now = new Date()): Promise<RegistrationRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const changed = await tx.registration.updateMany({
        where: { tenantId, id: registrationId, state: { in: [...from] } },
        data: {
          state, version: { increment: 1 }, eligibilitySnapshot: snapshot ? snapshot as unknown as Prisma.InputJsonValue : undefined,
          submittedAt: state === 'SUBMITTED' ? now : undefined, reviewedByMembershipId: reviewerMembershipId,
          reviewedAt: reviewerMembershipId ? now : null, decisionReason: reason,
        },
      });
      if (changed.count) return mapRegistration(await tx.registration.findUniqueOrThrow({ where: { id: registrationId }, include: registrationInclude }));
      const existing = await tx.registration.findFirst({ where: { tenantId, id: registrationId }, include: registrationInclude });
      return existing?.state === state ? mapRegistration(existing) : null;
    });
  }

  async setControllerEligibility(tenantId: UUID, registrationId: UUID, eligible: boolean, reason: string | null): Promise<RegistrationRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const changed = await tx.registration.updateMany({ where: { tenantId, id: registrationId, state: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] } }, data: { controllerEligible: eligible, controllerEligibilityReason: reason, eligibilitySnapshot: Prisma.JsonNull, version: { increment: 1 } } });
      if (changed.count) return mapRegistration(await tx.registration.findUniqueOrThrow({ where: { id: registrationId }, include: registrationInclude }));
      const existing = await tx.registration.findFirst({ where: { tenantId, id: registrationId }, include: registrationInclude });
      return existing && existing.controllerEligible === eligible && existing.controllerEligibilityReason === reason ? mapRegistration(existing) : null;
    });
  }

  async autoEnrol(tenantId: UUID, examId: UUID, evaluatedAt: Date): Promise<number> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { tenantId, id: examId }, include: { subjects: true } });
      if (!exam) throw new Error('EXAM_NOT_FOUND');
      if (exam.registrationMode !== 'AUTO_ENROL') throw new Error('AUTO_ENROL_MODE_REQUIRED');
      if (exam.state !== 'REGISTRATION_OPEN' || evaluatedAt < exam.registrationOpensAt || evaluatedAt > exam.registrationClosesAt) throw new Error('REGISTRATION_CLOSED');
      const students = await tx.student.findMany({ where: { tenantId, status: 'ACTIVE', cohort: { termId: exam.termId } }, include: { enrolments: { where: { status: 'ACTIVE', subjectId: { in: exam.subjects.map((entry) => entry.subjectId) } } } } });
      let created = 0;
      for (const student of students) {
        if (student.enrolments.length !== exam.subjects.length) continue;
        if (await tx.registration.findUnique({ where: { tenantId_examId_studentId: { tenantId, examId, studentId: student.id } } })) continue;
        const bySubject = new Map(student.enrolments.map((entry) => [entry.subjectId, entry]));
        const snapshot: EligibilitySnapshot = {
          evaluatedAt: evaluatedAt.toISOString(), eligible: true,
          checks: [
            { code: 'ACTIVE_STUDENT', passed: true, reason: 'Student is active.' },
            { code: 'CORRECT_TERM_COHORT', passed: true, reason: 'Student cohort belongs to the exam term.' },
            { code: 'ACTIVE_ENROLMENT', passed: true, reason: 'Every exam subject has an active enrolment.' },
            { code: 'CONTROLLER_ELIGIBLE', passed: true, reason: 'Controller eligibility flag allows registration.' },
          ],
          examSubjectIds: exam.subjects.map((entry) => entry.id), enrolmentIds: exam.subjects.map((entry) => bySubject.get(entry.subjectId)!.id),
        };
        const registration = await tx.registration.create({
          data: {
            tenantId, examId, studentId: student.id, state: 'APPROVED', submittedAt: evaluatedAt, reviewedAt: evaluatedAt,
            eligibilitySnapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.registrationSubject.createMany({ data: exam.subjects.map((entry) => ({ tenantId, registrationId: registration.id, examId, examSubjectId: entry.id, enrolmentId: bySubject.get(entry.subjectId)!.id })) });
        created += 1;
      }
      return created;
    }, { maxWait: 50_000, timeout: 120_000 });
  }
}
