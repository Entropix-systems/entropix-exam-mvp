import type { MarksSaveInput, ValidatedResultRule } from '@entropix/contracts';
import { Prisma, createPrismaClient, withTenant } from '@entropix/db';
import { ResultInputError } from '@entropix/domain';
import { ConductRepository } from '../src/modules/conduct/conduct.repository.js';
import { EvaluationRepository } from '../src/modules/evaluation/evaluation.repository.js';
import { ResultsRepository } from '../src/modules/results/results.repository.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const conduct = new ConductRepository(prisma);
const results = new ResultsRepository(prisma);
const evaluation = new EvaluationRepository(prisma);

async function rejects(operation: () => Promise<unknown>, code: string) {
  try { await operation(); }
  catch (error) {
    if (error instanceof ResultInputError && error.code === code) return;
    if (error instanceof Error && error.message === code) return;
    throw error;
  }
  throw new Error('Expected rejection: ' + code);
}

try {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const existing = await withTenant(prisma, tenant.id, (tx) => tx.publication.findFirst({
    where: { tenantId: tenant.id, isCurrent: true, exam: { code: 'ANNUAL-2026' } },
  }));
  if (existing) await results.withdraw(tenant.id, existing.publishedByMembershipId, existing.examId, 'Reset before focused result verification.', new Date());

  const fixture = await withTenant(prisma, tenant.id, async (tx) => {
    const controller = await tx.roleGrant.findFirstOrThrow({ where: { tenantId: tenant.id, role: { in: ['EXAM_CONTROLLER', 'INSTITUTION_ADMIN'] }, membership: { status: 'ACTIVE' } } });
    const exam = await tx.exam.findFirstOrThrow({
      where: { tenantId: tenant.id, code: 'ANNUAL-2026' },
      include: {
        ruleVersion: true,
        subjects: {
          include: {
            evaluationAssignment: { include: { faculty: true } },
            paper: { include: { hallSittings: { include: { duties: true } } } },
            registrationSubjects: { where: { registration: { state: 'APPROVED' } }, include: { registration: { include: { student: true } }, seatAssignments: true }, orderBy: { registration: { student: { rollNo: 'asc' } } } },
          },
          orderBy: { subject: { code: 'asc' } },
        },
      },
    });
    const rule = exam.ruleVersion.config as unknown as ValidatedResultRule;
    if (exam.subjects.length === 0 || exam.subjects.some((subject) => !subject.evaluationAssignment || !subject.paper || subject.registrationSubjects.length < 3)) {
      throw new Error('Run the full seed chain through seed:evaluation first');
    }
    await tx.incident.deleteMany({ where: { tenantId: tenant.id, hallSitting: { examPaper: { examId: exam.id } } } });
    const absentStudentId = exam.subjects[0]!.registrationSubjects[0]!.registration.studentId;
    const heldStudent = exam.subjects[0]!.registrationSubjects[1]!.registration.student;
    let missingMark: { marksBatchId: string; examSubjectId: string; registrationSubjectId: string; component: string; value: Prisma.Decimal; updater: string } | null = null;

    for (const subject of exam.subjects) {
      const examinerMembershipId = subject.evaluationAssignment!.faculty.membershipId;
      for (const sitting of subject.paper!.hallSittings) {
        if (!sitting.duties[0]) throw new Error('Every sitting requires a seeded duty');
        await tx.duty.update({ where: { id: sitting.duties[0].id }, data: { state: 'ACCEPTED', respondedByMembershipId: sitting.duties[0].facultyId === subject.evaluationAssignment!.facultyId ? examinerMembershipId : controller.membershipId, respondedAt: new Date() } });
        const batch = await tx.attendanceBatch.upsert({
          where: { tenantId_hallSittingId: { tenantId: tenant.id, hallSittingId: sitting.id } },
          create: { tenantId: tenant.id, hallSittingId: sitting.id, state: 'SUBMITTED', submittedByMembershipId: controller.membershipId, submittedAt: new Date() },
          update: { state: 'SUBMITTED', submittedByMembershipId: controller.membershipId, submittedAt: new Date(), version: { increment: 1 } },
        });
        const seats = subject.registrationSubjects.flatMap((row) => row.seatAssignments.filter((seat) => seat.hallSittingId === sitting.id).map((seat) => ({ row, seat })));
        for (const { row, seat } of seats) await tx.attendance.upsert({
          where: { tenantId_seatAssignmentId: { tenantId: tenant.id, seatAssignmentId: seat.id } },
          create: { tenantId: tenant.id, attendanceBatchId: batch.id, hallSittingId: sitting.id, seatAssignmentId: seat.id, state: row.registration.studentId === absentStudentId ? 'ABSENT' : 'PRESENT', updatedByMembershipId: controller.membershipId },
          update: { attendanceBatchId: batch.id, state: row.registration.studentId === absentStudentId ? 'ABSENT' : 'PRESENT', updatedByMembershipId: controller.membershipId, version: { increment: 1 } },
        });
      }
      const marksBatch = await tx.marksBatch.upsert({
        where: { tenantId_examSubjectId: { tenantId: tenant.id, examSubjectId: subject.id } },
        create: { tenantId: tenant.id, examSubjectId: subject.id, state: 'APPROVED', submittedByMembershipId: examinerMembershipId, submittedAt: new Date(), reviewedByMembershipId: controller.membershipId, reviewedAt: new Date(), reviewReason: 'Prepared for B03 result verification.' },
        update: { state: 'APPROVED', submittedByMembershipId: examinerMembershipId, submittedAt: new Date(), reviewedByMembershipId: controller.membershipId, reviewedAt: new Date(), reviewReason: 'Prepared for B03 result verification.', version: { increment: 1 } },
      });
      await tx.mark.deleteMany({ where: { tenantId: tenant.id, marksBatchId: marksBatch.id } });
      for (const [rowIndex, row] of subject.registrationSubjects.entries()) for (const component of rule.components) {
        if (row.registration.studentId === absentStudentId && ['FINAL', 'EXTERNAL'].includes(component.component)) continue;
        const value = new Prisma.Decimal(Number(component.maximum) * (0.65 + (rowIndex % 3) * 0.05));
        const mark = await tx.mark.create({ data: { tenantId: tenant.id, marksBatchId: marksBatch.id, examSubjectId: subject.id, registrationSubjectId: row.id, component: component.component, value, updatedByMembershipId: examinerMembershipId } });
        if (!missingMark && rowIndex >= 2) missingMark = { marksBatchId: marksBatch.id, examSubjectId: subject.id, registrationSubjectId: row.id, component: component.component, value: mark.value, updater: examinerMembershipId };
      }
    }
    const heldRow = exam.subjects[0]!.registrationSubjects.find((row) => row.registration.studentId === heldStudent.id)!;
    const heldSeat = heldRow.seatAssignments[0]!;
    const staleRow = exam.subjects[0]!.registrationSubjects[2]!;
    const staleSeat = staleRow.seatAssignments[0]!;
    await tx.incident.create({ data: { tenantId: tenant.id, hallSittingId: heldSeat.hallSittingId, kind: 'STUDENT', description: 'Fictional retained result hold.', disposition: 'RETAIN_WITHHELD', createdByMembershipId: controller.membershipId, disposedByMembershipId: controller.membershipId, disposedAt: new Date(), dispositionReason: 'Retained for B03 verification.', affectedStudents: { create: { registrationSubjectId: heldRow.id } } } });
    await tx.exam.update({ where: { id: exam.id }, data: { state: 'EVALUATION', inputRevision: { increment: 1 } } });
    if (!missingMark) throw new Error('Missing-mark fixture could not be selected');
    return {
      examId: exam.id,
      controllerMembershipId: controller.membershipId,
      absentStudentId,
      heldStudent,
      missingMark,
      staleRegistrationSubjectId: staleRow.id,
      staleSittingId: staleSeat.hallSittingId,
    };
  }, { maxWait: 10_000, timeout: 120_000 });

  await withTenant(prisma, tenant.id, async (tx) => {
    await tx.mark.deleteMany({ where: { tenantId: tenant.id, marksBatchId: fixture.missingMark.marksBatchId, registrationSubjectId: fixture.missingMark.registrationSubjectId, component: fixture.missingMark.component } });
    await tx.exam.update({ where: { id: fixture.examId }, data: { inputRevision: { increment: 1 } } });
  });
  await rejects(() => results.compute(tenant.id, fixture.controllerMembershipId, fixture.examId, new Date()), 'INCOMPLETE_INPUT');
  await withTenant(prisma, tenant.id, async (tx) => {
    await tx.mark.create({ data: { tenantId: tenant.id, marksBatchId: fixture.missingMark.marksBatchId, examSubjectId: fixture.missingMark.examSubjectId, registrationSubjectId: fixture.missingMark.registrationSubjectId, component: fixture.missingMark.component, value: fixture.missingMark.value, updatedByMembershipId: fixture.missingMark.updater } });
    await tx.exam.update({ where: { id: fixture.examId }, data: { inputRevision: { increment: 1 } } });
  });

  const staleRun = await results.compute(tenant.id, fixture.controllerMembershipId, fixture.examId, new Date());
  const revisionBeforeIncident = await withTenant(prisma, tenant.id, (tx) => tx.exam.findUniqueOrThrow({ where: { id: fixture.examId }, select: { inputRevision: true } }));
  await conduct.createIncident(
    tenant.id,
    { membershipId: fixture.controllerMembershipId, controller: true },
    fixture.staleSittingId,
    {
      kind: 'STUDENT',
      description: 'Fictional post-computation incident used to prove stale-run rejection.',
      registrationSubjectIds: [fixture.staleRegistrationSubjectId],
    },
    new Date(),
  );
  const revisionAfterIncident = await withTenant(prisma, tenant.id, (tx) => tx.exam.findUniqueOrThrow({ where: { id: fixture.examId }, select: { inputRevision: true } }));
  if (revisionAfterIncident.inputRevision !== revisionBeforeIncident.inputRevision + 1) throw new Error('Conduct change did not advance result input revision');
  await rejects(() => results.publish(tenant.id, fixture.controllerMembershipId, staleRun.id, new Date()), 'STALE_RUN');
  const currentRun = await results.compute(tenant.id, fixture.controllerMembershipId, fixture.examId, new Date());
  if (currentRun.absentCount < 1 || currentRun.withheldCount < 1) throw new Error('ABSENT/WITHHELD counts were not persisted');
  const hidden = currentRun.students.find((student) => student.studentId === fixture.heldStudent.id);
  if (!hidden || hidden.outcome !== 'WITHHELD' || hidden.percentage !== null || hidden.gpa !== null || hidden.items.some((item) => item.percentage !== null || item.components.some((component) => component.mark !== null))) throw new Error('WITHHELD numeric data leaked');

  const firstPublication = await results.publish(tenant.id, fixture.controllerMembershipId, currentRun.id, new Date());
  const retry = await results.publish(tenant.id, fixture.controllerMembershipId, currentRun.id, new Date());
  if (retry.id !== firstPublication.id) throw new Error('Publish retry created a duplicate publication');
  const currentCount = await withTenant(prisma, tenant.id, (tx) => tx.publication.count({ where: { tenantId: tenant.id, examId: fixture.examId, isCurrent: true } }));
  if (currentCount !== 1) throw new Error('Exactly one current publication was not preserved');
  const heldRead = await results.currentStudent(tenant.id, fixture.heldStudent.membershipId);
  if (!heldRead || heldRead.outcome !== 'WITHHELD' || 'result' in heldRead || !heldRead.holdMessage) throw new Error('Current student read did not preserve WITHHELD privacy');

  await results.withdraw(tenant.id, fixture.controllerMembershipId, fixture.examId, 'Correction workflow verification.', new Date());
  const afterWithdrawal = await results.currentStudent(tenant.id, fixture.heldStudent.membershipId);
  if (afterWithdrawal?.examId === fixture.examId) throw new Error('Withdrawn result remained student-visible');
  const withdrawnCurrentCount = await withTenant(prisma, tenant.id, (tx) => tx.publication.count({
    where: { tenantId: tenant.id, examId: fixture.examId, isCurrent: true },
  }));
  if (withdrawnCurrentCount !== 0) throw new Error('Withdrawn publication remained current');

  const evaluationSnapshot = await evaluation.snapshot(tenant.id, { membershipId: fixture.controllerMembershipId, controller: true, examiner: false, departmentIds: [] });
  const subject = evaluationSnapshot.subjects.find((entry) => entry.examId === fixture.examId && entry.batch.state === 'APPROVED')!;
  const reopened = await evaluation.reopen(tenant.id, { membershipId: fixture.controllerMembershipId, controller: true, examiner: false, departmentIds: [] }, subject.examSubjectId, { expectedVersion: subject.batch.version, reason: 'Correct one approved result input.' }, new Date());
  const rows: MarksSaveInput['rows'] = subject.roster.map((row, rowIndex) => ({ registrationSubjectId: row.registrationSubjectId, marks: subject.components.map((component, componentIndex) => {
    const persisted = row.marks.find((mark) => mark.component === component.component)?.value ?? null;
    const corrected = rowIndex === 2 && componentIndex === 0 && persisted ? String(Math.max(0, Number(persisted) - 1)) : persisted;
    return { component: component.component, value: corrected };
  }) }));
  const examinerMembershipId = await withTenant(prisma, tenant.id, (tx) => tx.faculty.findFirstOrThrow({ where: { tenantId: tenant.id, id: subject.assignment!.facultyId }, select: { membershipId: true } }).then((row) => row.membershipId));
  const saved = await evaluation.save(tenant.id, examinerMembershipId, subject.examSubjectId, { expectedVersion: reopened.version, rows }, new Date());
  const submitted = await evaluation.submit(tenant.id, examinerMembershipId, subject.examSubjectId, saved.version, new Date());
  await evaluation.review(tenant.id, { membershipId: fixture.controllerMembershipId, controller: true, examiner: false, departmentIds: [] }, subject.examSubjectId, 'APPROVED', { expectedVersion: submitted.version, reason: 'Corrected input independently approved.' }, new Date());

  const republishRun = await results.compute(tenant.id, fixture.controllerMembershipId, fixture.examId, new Date());
  const secondPublication = await results.publish(tenant.id, fixture.controllerMembershipId, republishRun.id, new Date());
  if (secondPublication.version !== firstPublication.version + 1 || secondPublication.resultRunId === firstPublication.resultRunId) throw new Error('Versioned corrected publication was not created');
  let immutableRejected = false;
  try {
    await withTenant(prisma, tenant.id, (tx) => tx.resultRun.update({ where: { id: republishRun.id }, data: { checksum: 'tampered' } }));
  } catch {
    immutableRejected = true;
  }
  if (!immutableRejected) throw new Error('Database allowed an immutable result snapshot to change');
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  const foreignPublication = await withTenant(prisma, northstar.id, (tx) => tx.publication.findFirst({ where: { id: secondPublication.id } }));
  const unscopedPublication = await prisma.publication.findFirst({ where: { id: secondPublication.id } });
  if (foreignPublication || unscopedPublication) throw new Error('Publication RLS exposed a foreign or unscoped row');
  console.log('Result flow: missing blocked; stale rejected; compute + retry-safe publish + withdraw + corrected republish READY');
  console.log('Current publication: exactly one; student read current-only; ABSENT/WITHHELD numeric privacy READY');
  console.log('Result snapshots: database immutable; missing-context and cross-tenant publication reads denied');
} finally {
  await prisma.$disconnect();
}
