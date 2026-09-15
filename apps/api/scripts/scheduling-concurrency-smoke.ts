import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient, withTenant } from '@entropix/db';
import { ConductRepository } from '../src/modules/conduct/conduct.repository.js';
import { SchedulingRepository, intervalsOverlap } from '../src/modules/scheduling/scheduling.repository.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const scheduling = new SchedulingRepository(prisma);
const conduct = new ConductRepository(prisma);

interface Fixture {
  tenantId: string;
  examIds: string[];
  mainPaperIds: [string, string];
  roomPaperIds: [string, string];
  hallIds: [string, string];
  facultyId: string;
  controllerMembershipId: string;
  expectedSeatCount: number;
}

function rejectionCode(results: PromiseSettledResult<unknown>[]): string {
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert.equal(rejected.length, 1, 'Exactly one concurrent command must be rejected');
  return rejected[0].reason instanceof Error ? rejected[0].reason.message : String(rejected[0].reason);
}

async function createFixture(): Promise<Fixture> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  return withTenant(prisma, tenant.id, async (tx) => {
    const [term, ruleVersion, student, controller, faculty, campus] = await Promise.all([
      tx.term.findFirstOrThrow({ orderBy: { sequence: 'asc' } }),
      tx.ruleVersion.findFirstOrThrow({ orderBy: { version: 'asc' } }),
      tx.student.findFirstOrThrow({
        where: { status: 'ACTIVE', enrolments: { some: { status: 'ACTIVE' } } },
        include: { enrolments: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
      }),
      tx.roleGrant.findFirstOrThrow({ where: { role: { in: ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'] }, membership: { status: 'ACTIVE' } } }),
      tx.faculty.findFirstOrThrow({ where: { status: 'ACTIVE', membership: { roleGrants: { some: { role: 'INVIGILATOR' } } } } }),
      tx.campus.findFirstOrThrow({ orderBy: { code: 'asc' } }),
    ]);
    assert.ok(student.enrolments.length >= 2, 'Concurrency fixture requires two active subject enrolments');
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const hallA = await tx.hall.create({ data: { tenantId: tenant.id, campusId: campus.id, code: `A06-A-${suffix}`, name: 'A06 Concurrency Hall A', capacity: 10 } });
    const hallB = await tx.hall.create({ data: { tenantId: tenant.id, campusId: campus.id, code: `A06-B-${suffix}`, name: 'A06 Concurrency Hall B', capacity: 10 } });

    const createExam = async (code: string, subjectIds: string[]) => {
      const exam = await tx.exam.create({ data: {
        tenantId: tenant.id,
        termId: term.id,
        ruleVersionId: ruleVersion.id,
        code,
        name: `A06 concurrency ${code}`,
        registrationMode: 'AUTO_ENROL',
        state: 'PREPARATION',
        registrationOpensAt: new Date('2031-01-01T00:00:00.000Z'),
        registrationClosesAt: new Date('2031-01-31T00:00:00.000Z'),
      } });
      const examSubjects = [];
      for (const subjectId of subjectIds) examSubjects.push(await tx.examSubject.create({ data: { tenantId: tenant.id, examId: exam.id, subjectId } }));
      const papers = [];
      for (const examSubject of examSubjects) papers.push(await tx.examPaper.create({ data: { tenantId: tenant.id, examId: exam.id, examSubjectId: examSubject.id } }));
      return { exam, examSubjects, papers };
    };

    const main = await createExam(`A06-MAIN-${suffix}`, student.enrolments.slice(0, 2).map((entry) => entry.subjectId));
    const roomA = await createExam(`A06-ROOM-A-${suffix}`, [student.enrolments[0]!.subjectId]);
    const roomB = await createExam(`A06-ROOM-B-${suffix}`, [student.enrolments[0]!.subjectId]);
    const registration = await tx.registration.create({ data: { tenantId: tenant.id, examId: main.exam.id, studentId: student.id, state: 'APPROVED' } });
    for (const [index, examSubject] of main.examSubjects.entries()) {
      await tx.registrationSubject.create({ data: {
        tenantId: tenant.id,
        registrationId: registration.id,
        examId: main.exam.id,
        examSubjectId: examSubject.id,
        enrolmentId: student.enrolments[index]!.id,
      } });
    }

    await tx.examPaper.update({ where: { id: main.papers[0]!.id }, data: { startsAt: new Date('2031-02-01T04:30:00.000Z'), endsAt: new Date('2031-02-01T07:30:00.000Z') } });
    await tx.examPaper.update({ where: { id: main.papers[1]!.id }, data: { startsAt: new Date('2031-02-02T04:30:00.000Z'), endsAt: new Date('2031-02-02T07:30:00.000Z') } });
    for (const paper of [...roomA.papers, ...roomB.papers]) {
      await tx.examPaper.update({ where: { id: paper.id }, data: { startsAt: new Date('2031-02-03T04:30:00.000Z'), endsAt: new Date('2031-02-03T07:30:00.000Z') } });
    }

    return {
      tenantId: tenant.id,
      examIds: [main.exam.id, roomA.exam.id, roomB.exam.id],
      mainPaperIds: [main.papers[0]!.id, main.papers[1]!.id],
      roomPaperIds: [roomA.papers[0]!.id, roomB.papers[0]!.id],
      hallIds: [hallA.id, hallB.id],
      facultyId: faculty.id,
      controllerMembershipId: controller.membershipId,
      expectedSeatCount: 1,
    };
  }, { maxWait: 10_000, timeout: 120_000 });
}

async function cleanup(fixture: Fixture) {
  await withTenant(prisma, fixture.tenantId, async (tx) => {
    await tx.duty.deleteMany({ where: { hallSitting: { examPaper: { examId: { in: fixture.examIds } } } } });
    await tx.seatAssignment.deleteMany({ where: { examPaper: { examId: { in: fixture.examIds } } } });
    await tx.hallSitting.deleteMany({ where: { examPaper: { examId: { in: fixture.examIds } } } });
    await tx.examPaper.deleteMany({ where: { examId: { in: fixture.examIds } } });
    await tx.registrationSubject.deleteMany({ where: { examId: { in: fixture.examIds } } });
    await tx.registration.deleteMany({ where: { examId: { in: fixture.examIds } } });
    await tx.examSubject.deleteMany({ where: { examId: { in: fixture.examIds } } });
    await tx.exam.deleteMany({ where: { id: { in: fixture.examIds } } });
    await tx.hall.deleteMany({ where: { id: { in: fixture.hallIds } } });
  }, { maxWait: 10_000, timeout: 120_000 });
}

let fixture: Fixture | null = null;
try {
  fixture = await createFixture();
  const overlapStart = new Date('2031-02-04T04:30:00.000Z');
  const overlapEnd = new Date('2031-02-04T07:30:00.000Z');

  const studentRace = await Promise.allSettled(fixture.mainPaperIds.map((paperId) => scheduling.updatePaperSchedule(fixture!.tenantId, paperId, overlapStart, overlapEnd, 1)));
  assert.equal(studentRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(rejectionCode(studentRace), 'STUDENT_OVERLAP');
  const mainPapers = await withTenant(prisma, fixture.tenantId, (tx) => tx.examPaper.findMany({ where: { id: { in: fixture!.mainPaperIds } }, orderBy: { id: 'asc' } }));
  assert.equal(intervalsOverlap(mainPapers[0]!.startsAt!, mainPapers[0]!.endsAt!, mainPapers[1]!.startsAt!, mainPapers[1]!.endsAt!), false, 'Concurrent student papers were double-booked');

  const seatPaper = mainPapers.find((paper) => paper.startsAt?.getTime() === overlapStart.getTime())!;
  const seatRace = await Promise.allSettled([
    scheduling.commitAllocation(fixture.tenantId, seatPaper.id, [fixture.hallIds[0]], seatPaper.version),
    scheduling.commitAllocation(fixture.tenantId, seatPaper.id, [fixture.hallIds[0]], seatPaper.version),
  ]);
  assert.equal(seatRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(rejectionCode(seatRace), 'STALE_VERSION');
  const seats = await withTenant(prisma, fixture.tenantId, (tx) => tx.seatAssignment.findMany({ where: { examPaperId: seatPaper.id } }));
  assert.equal(seats.length, fixture.expectedSeatCount);
  assert.equal(new Set(seats.map((seat) => seat.registrationSubjectId)).size, fixture.expectedSeatCount);
  assert.equal(new Set(seats.map((seat) => `${seat.hallSittingId}:${seat.seatNumber}`)).size, fixture.expectedSeatCount);

  const roomRace = await Promise.allSettled(fixture.roomPaperIds.map((paperId) => scheduling.commitAllocation(fixture!.tenantId, paperId, [fixture!.hallIds[0]], 1)));
  assert.equal(roomRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(rejectionCode(roomRace), 'HALL_OVERLAP');
  const roomPapers = await withTenant(prisma, fixture.tenantId, (tx) => tx.examPaper.findMany({ where: { id: { in: fixture!.roomPaperIds } }, include: { hallSittings: true } }));
  const roomWinner = roomPapers.find((paper) => paper.hallSittings.length === 1)!;
  const roomLoser = roomPapers.find((paper) => paper.hallSittings.length === 0)!;
  await scheduling.commitAllocation(fixture.tenantId, roomLoser.id, [fixture.hallIds[1]], roomLoser.version);
  const sittings = await withTenant(prisma, fixture.tenantId, (tx) => tx.hallSitting.findMany({ where: { examPaperId: { in: [roomWinner.id, roomLoser.id] } }, orderBy: { id: 'asc' } }));
  assert.equal(sittings.length, 2);
  assert.equal(new Set(sittings.map((sitting) => sitting.hallId)).size, 2, 'Concurrent room allocation double-booked one hall');

  const dutyRace = await Promise.allSettled(sittings.map((sitting) => conduct.assignDuty(fixture!.tenantId, fixture!.controllerMembershipId, sitting.id, { facultyId: fixture!.facultyId })));
  assert.equal(dutyRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(rejectionCode(dutyRace), 'DUTY_OVERLAP');
  const activeDuties = await withTenant(prisma, fixture.tenantId, (tx) => tx.duty.count({ where: { hallSittingId: { in: sittings.map((sitting) => sitting.id) }, facultyId: fixture!.facultyId, state: { in: ['PENDING', 'ACCEPTED'] } } }));
  assert.equal(activeDuties, 1, 'Concurrent duty assignment double-booked an invigilator');

  console.log('A06 scheduling concurrency: PASS');
  console.log('  Student overlap race: one commit, one STUDENT_OVERLAP');
  console.log('  Seat allocation race: one commit, one STALE_VERSION, no duplicate seat');
  console.log('  Room allocation race: one commit, one HALL_OVERLAP');
  console.log('  Invigilator assignment race: one commit, one DUTY_OVERLAP');
} finally {
  if (fixture) await cleanup(fixture);
  await prisma.$disconnect();
}
