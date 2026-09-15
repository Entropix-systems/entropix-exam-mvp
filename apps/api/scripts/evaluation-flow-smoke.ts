import type { MarksSaveInput, ValidatedResultRule } from '@entropix/contracts';
import { createPrismaClient, withTenant } from '@entropix/db';
import { EvaluationRepository } from '../src/modules/evaluation/evaluation.repository.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const repository = new EvaluationRepository(prisma);

async function rejectsCode(operation: () => Promise<unknown>, code: string) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Error && error.message === code) return;
    throw error;
  }
  throw new Error('Expected rejection: ' + code);
}

try {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const fixture = await withTenant(prisma, tenant.id, async (tx) => {
    const controller = await tx.roleGrant.findFirstOrThrow({
      where: { tenantId: tenant.id, role: { in: ['EXAM_CONTROLLER', 'INSTITUTION_ADMIN'] }, membership: { status: 'ACTIVE' } },
    });
    const subject = await tx.examSubject.findFirstOrThrow({
      where: { tenantId: tenant.id, exam: { code: 'ANNUAL-2026' }, subject: { code: 'MAT10' } },
      include: {
        exam: { include: { ruleVersion: true } },
        evaluationAssignment: { include: { faculty: true } },
        registrationSubjects: {
          where: { registration: { state: 'APPROVED' } },
          include: { seatAssignments: { include: { hallSitting: true } } },
          orderBy: { registration: { student: { rollNo: 'asc' } } },
        },
      },
    });
    if (!subject.evaluationAssignment) throw new Error('Run the evaluation seed first');
    if (subject.registrationSubjects.length < 3) throw new Error('Cedar MAT10 roster is incomplete');
    await tx.exam.update({ where: { id: subject.examId }, data: { state: 'EVALUATION' } });
    await tx.marksBatch.deleteMany({ where: { tenantId: tenant.id, examSubjectId: subject.id } });
    await tx.incident.deleteMany({ where: { tenantId: tenant.id, hallSitting: { examPaper: { examSubjectId: subject.id } } } });

    const absentId = subject.registrationSubjects[0]!.id;
    const heldId = subject.registrationSubjects[1]!.id;
    for (const roster of subject.registrationSubjects) {
      const seat = roster.seatAssignments[0];
      if (!seat) throw new Error('Every roster row needs one seat assignment');
      const batch = await tx.attendanceBatch.upsert({
        where: { tenantId_hallSittingId: { tenantId: tenant.id, hallSittingId: seat.hallSittingId } },
        create: {
          tenantId: tenant.id,
          hallSittingId: seat.hallSittingId,
          state: 'SUBMITTED',
          submittedByMembershipId: controller.membershipId,
          submittedAt: new Date(),
        },
        update: {
          state: 'SUBMITTED',
          submittedByMembershipId: controller.membershipId,
          submittedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.attendance.upsert({
        where: { tenantId_seatAssignmentId: { tenantId: tenant.id, seatAssignmentId: seat.id } },
        create: {
          tenantId: tenant.id,
          attendanceBatchId: batch.id,
          hallSittingId: seat.hallSittingId,
          seatAssignmentId: seat.id,
          state: roster.id === absentId ? 'ABSENT' : 'PRESENT',
          updatedByMembershipId: controller.membershipId,
        },
        update: {
          attendanceBatchId: batch.id,
          state: roster.id === absentId ? 'ABSENT' : 'PRESENT',
          updatedByMembershipId: controller.membershipId,
          version: { increment: 1 },
        },
      });
    }
    const heldSeat = subject.registrationSubjects.find((entry) => entry.id === heldId)!.seatAssignments[0]!;
    await tx.incident.create({
      data: {
        tenantId: tenant.id,
        hallSittingId: heldSeat.hallSittingId,
        kind: 'STUDENT',
        description: 'Fictional Cedar result-hold fixture.',
        disposition: 'RETAIN_WITHHELD',
        createdByMembershipId: controller.membershipId,
        disposedByMembershipId: controller.membershipId,
        disposedAt: new Date(),
        dispositionReason: 'Retained for the B02 workflow smoke.',
        affectedStudents: { create: { registrationSubjectId: heldId } },
      },
    });
    return {
      examId: subject.examId,
      examSubjectId: subject.id,
      controllerMembershipId: controller.membershipId,
      examinerMembershipId: subject.evaluationAssignment.faculty.membershipId,
      rule: subject.exam.ruleVersion.config as unknown as ValidatedResultRule,
      rosterIds: subject.registrationSubjects.map((entry) => entry.id),
      absentId,
      heldId,
    };
  });

  const examiner = { membershipId: fixture.examinerMembershipId, examiner: true, controller: false, departmentIds: [] };
  const controller = { membershipId: fixture.controllerMembershipId, examiner: false, controller: true, departmentIds: [] };
  const initial = await repository.snapshot(tenant.id, examiner);
  const subject = initial.subjects.find((entry) => entry.examSubjectId === fixture.examSubjectId);
  if (initial.subjects.length !== 1 || !subject?.canEdit || !subject.conductReady) {
    throw new Error('Assigned examiner snapshot is not exactly scoped or ready for entry');
  }
  const unassignedSubject = (await repository.snapshot(tenant.id, controller)).subjects.find(
    (entry) => entry.examSubjectId !== fixture.examSubjectId,
  );
  if (!unassignedSubject) throw new Error('Unassigned-subject fixture is missing');
  await rejectsCode(
    () => repository.save(tenant.id, fixture.examinerMembershipId, unassignedSubject.examSubjectId, { expectedVersion: 0, rows: [] }, new Date()),
    'NOT_ASSIGNED',
  );

  const rows: MarksSaveInput['rows'] = fixture.rosterIds.map((registrationSubjectId, rowIndex) => ({
    registrationSubjectId,
    marks: fixture.rule.components.map((component) => ({
      component: component.component,
      value: registrationSubjectId === fixture.absentId && ['FINAL', 'EXTERNAL'].includes(component.component)
        ? null
        : String(Math.min(Number(component.maximum), 30 + rowIndex)),
    })),
  }));
  const invalidRows: MarksSaveInput['rows'] = rows.map((row, index) => index === 1 ? {
    ...row,
    marks: row.marks.map((mark, componentIndex) => componentIndex === 0 ? { ...mark, value: '9999' } : mark),
  } : row);
  await rejectsCode(() => repository.save(tenant.id, fixture.examinerMembershipId, fixture.examSubjectId, { expectedVersion: 0, rows: invalidRows }, new Date()), 'MARK_OUT_OF_RANGE');

  const draft = await repository.save(tenant.id, fixture.examinerMembershipId, fixture.examSubjectId, { expectedVersion: 0, rows }, new Date());
  await rejectsCode(() => repository.save(tenant.id, fixture.examinerMembershipId, fixture.examSubjectId, { expectedVersion: 0, rows }, new Date()), 'STALE_VERSION');
  const submitted = await repository.submit(tenant.id, fixture.examinerMembershipId, fixture.examSubjectId, draft.version, new Date());
  await rejectsCode(
    () => repository.review(tenant.id, { ...examiner, controller: true }, fixture.examSubjectId, 'APPROVED', { expectedVersion: submitted.version, reason: 'Self review must be denied.' }, new Date()),
    'SELF_APPROVAL',
  );
  const returned = await repository.review(tenant.id, controller, fixture.examSubjectId, 'RETURNED', { expectedVersion: submitted.version, reason: 'Return path verified with history.' }, new Date());
  const revised = await repository.save(tenant.id, fixture.examinerMembershipId, fixture.examSubjectId, { expectedVersion: returned.version, rows }, new Date());
  const resubmitted = await repository.submit(tenant.id, fixture.examinerMembershipId, fixture.examSubjectId, revised.version, new Date());
  const approved = await repository.review(tenant.id, controller, fixture.examSubjectId, 'APPROVED', { expectedVersion: resubmitted.version, reason: 'Independent roster and component review complete.' }, new Date());

  const reviewed = (await repository.snapshot(tenant.id, controller)).subjects.find((entry) => entry.examSubjectId === fixture.examSubjectId);
  const absent = reviewed?.roster.find((entry) => entry.registrationSubjectId === fixture.absentId);
  const held = reviewed?.roster.find((entry) => entry.registrationSubjectId === fixture.heldId);
  if (reviewed?.batch.state !== 'APPROVED' || !absent || !held?.held) throw new Error('Approved, ABSENT, or WITHHELD snapshot evidence is missing');
  if (absent.marks.some((mark) => ['FINAL', 'EXTERNAL'].includes(mark.component))) throw new Error('ABSENT external/final mark was persisted');
  if (reviewed.batch.history.map((event) => event.action).join(',') !== 'DRAFT_SAVED,SUBMITTED,RETURNED,DRAFT_SAVED,SUBMITTED,APPROVED') throw new Error('Batch history did not preserve the review loop');

  const reopened = await repository.reopen(tenant.id, controller, fixture.examSubjectId, { expectedVersion: approved.version, reason: 'Reopen invalidation verified.' }, new Date());
  const exam = await withTenant(prisma, tenant.id, (tx) => tx.exam.findFirstOrThrow({ where: { id: fixture.examId } }));
  if (reopened.state !== 'DRAFT' || exam.inputRevision < 4) throw new Error('Reopen did not invalidate candidate result inputs');
  console.log('Evaluation workflow: range + stale rejected; submit + return + resubmit + independent approve + reopen READY');
  console.log('ABSENT blank and WITHHELD visibility: READY');
} finally {
  await prisma.$disconnect();
}
