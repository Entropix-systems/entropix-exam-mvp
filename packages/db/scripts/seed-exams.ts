import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const rule = {
  kind: 'VALIDATED_RESULT_RULE',
  components: [
    { component: 'INTERNAL', maximum: '40', weight: '40', minimumPassPercentage: '40' },
    { component: 'EXTERNAL', maximum: '60', weight: '60', minimumPassPercentage: '40' },
  ],
  totalPassPercentage: '40',
  gradeBands: [
    { grade: 'F', minInclusive: '0', maxExclusive: '40', maxInclusive: null, points: '0' },
    { grade: 'C', minInclusive: '40', maxExclusive: '60', maxInclusive: null, points: '6' },
    { grade: 'B', minInclusive: '60', maxExclusive: '80', maxInclusive: null, points: '8' },
    { grade: 'A', minInclusive: '80', maxExclusive: null, maxInclusive: '100', points: '10' },
  ],
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });

try {
  for (const fixture of [
    { slug: 'northstar-college', code: 'SEM3-2026', name: 'Semester 3 Examination', mode: 'APPLICATION' },
    { slug: 'cedar-school', code: 'ANNUAL-2026', name: 'Class 10 Annual Examination', mode: 'AUTO_ENROL' },
  ] as const) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: fixture.slug } });
    const counts = await withTenant(prisma, tenant.id, async (tx) => {
      const term = await tx.term.findFirstOrThrow({ where: { tenantId: tenant.id }, orderBy: { sequence: 'asc' } });
      const subjects = await tx.subject.findMany({ where: { tenantId: tenant.id, programId: term.programId }, orderBy: { code: 'asc' } });
      let exam = await tx.exam.findUnique({ where: { tenantId_termId_code: { tenantId: tenant.id, termId: term.id, code: fixture.code } }, include: { subjects: true } });
      if (!exam) {
        const latest = await tx.ruleVersion.aggregate({ where: { tenantId: tenant.id }, _max: { version: true } });
        const ruleVersion = await tx.ruleVersion.create({ data: { tenantId: tenant.id, version: (latest._max.version ?? 0) + 1, config: rule, frozenAt: new Date() } });
        const created = await tx.exam.create({
          data: {
            tenantId: tenant.id, termId: term.id, ruleVersionId: ruleVersion.id, code: fixture.code, name: fixture.name,
            registrationMode: fixture.mode, state: 'REGISTRATION_OPEN', registrationOpensAt: new Date('2026-09-01T00:00:00.000Z'),
            registrationClosesAt: new Date('2026-09-30T18:29:59.000Z'),
          },
        });
        await tx.examSubject.createMany({ data: subjects.map((subject) => ({ tenantId: tenant.id, examId: created.id, subjectId: subject.id })) });
        exam = await tx.exam.findUniqueOrThrow({ where: { id: created.id }, include: { subjects: true } });
      }
      const students = await tx.student.findMany({ where: { tenantId: tenant.id, status: 'ACTIVE', cohort: { termId: term.id } }, include: { enrolments: { where: { status: 'ACTIVE' } } }, orderBy: { rollNo: 'asc' } });
      const targets = fixture.mode === 'APPLICATION' ? students.filter((student) => student.rollNo === 'NS26007') : students;
      let created = 0;
      for (const student of targets) {
        const bySubject = new Map(student.enrolments.map((entry) => [entry.subjectId, entry]));
        if (exam.subjects.some((entry) => !bySubject.has(entry.subjectId))) continue;
        const existing = await tx.registration.findUnique({ where: { tenantId_examId_studentId: { tenantId: tenant.id, examId: exam.id, studentId: student.id } } });
        if (existing) continue;
        const evaluatedAt = new Date();
        const snapshot = {
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
            tenantId: tenant.id, examId: exam.id, studentId: student.id,
            state: fixture.mode === 'APPLICATION' ? 'SUBMITTED' : 'APPROVED', submittedAt: evaluatedAt,
            reviewedAt: fixture.mode === 'AUTO_ENROL' ? evaluatedAt : null, eligibilitySnapshot: snapshot,
          },
        });
        await tx.registrationSubject.createMany({ data: exam.subjects.map((entry) => ({ tenantId: tenant.id, registrationId: registration.id, examId: exam.id, examSubjectId: entry.id, enrolmentId: bySubject.get(entry.subjectId)!.id })) });
        created += 1;
      }
      return { subjects: exam.subjects.length, registrations: targets.length, created };
    }, { maxWait: 10_000, timeout: 120_000 });
    console.log(`Exam fixture ready: ${tenant.name} (${counts.subjects} subjects, ${counts.registrations} registrations, ${counts.created} created)`);
  }
} finally {
  await prisma.$disconnect();
}
