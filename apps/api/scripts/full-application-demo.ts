import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AttendanceState, AuthenticatedContext, TenantRole, UUID, ValidatedResultRule } from '@entropix/contracts';
import { createPrismaClient, withTenant } from '@entropix/db';
import dotenv from 'dotenv';
import { ExamsRepository } from '../src/modules/exams/exams.repository.js';
import { SchedulingRepository } from '../src/modules/scheduling/scheduling.repository.js';
import { ConductRepository } from '../src/modules/conduct/conduct.repository.js';
import { EvaluationRepository, type EvaluationActor } from '../src/modules/evaluation/evaluation.repository.js';
import { ResultsRepository } from '../src/modules/results/results.repository.js';
import { StudentPortalRepository } from '../src/modules/documents/student-portal.repository.js';
import { PrismaCurrentAuthorityRepository, PrismaIdentityRepository } from '../src/modules/identity/persistence/prisma-identity.repository.js';
import { AuthApplicationService } from '../src/modules/identity/application/auth.service.js';
import { IdentityNotificationSender } from '../src/modules/identity/application/identity-notifications.js';
import { Argon2PasswordHasher } from '../src/modules/identity/security/password-hasher.js';
import { JoseAccessTokenCodec } from '../src/modules/identity/security/access-token.js';
import { PeopleRepository } from '../src/modules/people/people.repository.js';
import { PeopleService } from '../src/modules/people/people.service.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const SEED_VERSION = 'full-application-v1';
const PASSWORD = 'DemoOnly!2026';
const HISTORICAL_NOW = new Date('2026-08-31T12:00:00.000Z');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

type Mode = 'guard' | 'seed' | 'smoke' | 'roles' | 'journey' | 'imports';
const mode = (process.argv[2] ?? 'smoke') as Mode;
if (!['guard', 'seed', 'smoke', 'roles', 'journey', 'imports'].includes(mode)) throw new Error('Expected guard, seed, smoke, roles, journey, or imports mode');

const target = new URL(connectionString);
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
const localHostname = ['localhost', '127.0.0.1', '::1'].includes(target.hostname);
const disposableDatabaseName = process.env.DEMO_LOCAL_DATABASE_NAME?.trim() || 'exam_mvp';
const disposableDatabasePort = process.env.DEMO_LOCAL_DATABASE_PORT?.trim() || '55432';
const targetPort = target.port || '5432';
const disposableLocal = localHostname && targetPort === disposableDatabasePort && databaseName === disposableDatabaseName;
const mutationMode = ['guard', 'seed', 'imports'].includes(mode);
const sharedAcknowledgement = `${target.host}/${databaseName}`;
if (process.env.NODE_ENV === 'production') throw new Error('Demo commands refuse NODE_ENV=production');
if (mutationMode && !disposableLocal) {
  if (process.env.DEMO_SEED_TARGET !== 'shared' || process.env.DEMO_SEED_ACK !== sharedAcknowledgement) {
    throw new Error(`Non-disposable demo mutation refused. Expected local ${disposableDatabaseName} on port ${disposableDatabasePort}, or set DEMO_SEED_TARGET=shared and DEMO_SEED_ACK=${sharedAcknowledgement}`);
  }
}

const targetCategory = disposableLocal ? 'disposable-local' : mutationMode ? 'acknowledged-shared' : 'non-disposable-read-only';
console.log(`Full demo preflight: ${targetCategory} database=${databaseName}; tenants=northstar-college,cedar-school; seed=${SEED_VERSION}; exams=CEDAR-HIST-2026,NORTHSTAR-HIST-2026 (ANNUAL-2026 preserved)`);

const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });
const exams = new ExamsRepository(prisma);
const scheduling = new SchedulingRepository(prisma);
const conduct = new ConductRepository(prisma);
const evaluation = new EvaluationRepository(prisma);
const results = new ResultsRepository(prisma);
const portal = new StudentPortalRepository(prisma);
const identities = new PrismaIdentityRepository(prisma);
const authority = new PrismaCurrentAuthorityRepository(prisma);

class SilentNotifications extends IdentityNotificationSender {
  async send(): Promise<void> {}
}

interface Credential {
  scenario: string;
  name: string;
  email: string;
  tenantSlug: string | null;
  roles: readonly { role: TenantRole; departmentCode?: string }[];
  expectedRole: TenantRole | 'PLATFORM_ADMIN' | 'DENIED';
  expectedRoute: string;
  profile?: { kind: 'student'; rollNo: string } | { kind: 'faculty'; code: string };
  suspended?: boolean;
}

export const demoCredentials: readonly Credential[] = [
  { scenario: 'Platform administration', name: 'Demo Platform Admin', email: 'platform.admin@demo.example.test', tenantSlug: null, roles: [], expectedRole: 'PLATFORM_ADMIN', expectedRoute: '/platform' },
  { scenario: 'Northstar tenant administration', name: 'Northstar Administrator', email: 'institution.admin@northstar.example.test', tenantSlug: 'northstar-college', roles: [{ role: 'INSTITUTION_ADMIN' }], expectedRole: 'INSTITUTION_ADMIN', expectedRoute: '/masters' },
  { scenario: 'Cedar tenant administration', name: 'Cedar Administrator', email: 'institution.admin@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'INSTITUTION_ADMIN' }], expectedRole: 'INSTITUTION_ADMIN', expectedRoute: '/masters' },
  { scenario: 'Exam configuration and publication', name: 'Cedar Exam Controller', email: 'exam.controller@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'EXAM_CONTROLLER' }], expectedRole: 'EXAM_CONTROLLER', expectedRoute: '/results' },
  { scenario: 'Department-scoped review', name: 'Northstar Department Admin', email: 'department.admin@northstar.example.test', tenantSlug: 'northstar-college', roles: [{ role: 'DEPARTMENT_ADMIN', departmentCode: 'CSE' }], expectedRole: 'DEPARTMENT_ADMIN', expectedRoute: '/marks' },
  { scenario: 'Assigned marks entry', name: 'Ananya Iyer', email: 'ananya.iyer@northstar.example.test', tenantSlug: 'northstar-college', roles: [{ role: 'FACULTY', departmentCode: 'CSE' }], expectedRole: 'FACULTY', expectedRoute: '/marks', profile: { kind: 'faculty', code: 'NSF001' } },
  { scenario: 'Assigned conduct and marks', name: 'Nisha Rao', email: 'nisha.rao@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'INVIGILATOR' }, { role: 'FACULTY', departmentCode: 'SCHOOL' }], expectedRole: 'FACULTY', expectedRoute: '/marks', profile: { kind: 'faculty', code: 'CSF001' } },
  { scenario: 'Read-only institution access', name: 'Northstar Auditor', email: 'auditor@northstar.example.test', tenantSlug: 'northstar-college', roles: [{ role: 'AUDITOR' }], expectedRole: 'AUDITOR', expectedRoute: '/' },
  { scenario: 'Normal student result', name: 'Cedar Student 03', email: 'student.03@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'STUDENT' }], expectedRole: 'STUDENT', expectedRoute: '/student', profile: { kind: 'student', rollNo: 'CED10A03' } },
  { scenario: 'Absent student result', name: 'Cedar Student 01', email: 'student.01@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'STUDENT' }], expectedRole: 'STUDENT', expectedRoute: '/student', profile: { kind: 'student', rollNo: 'CED10A01' } },
  { scenario: 'Held student result', name: 'Cedar Student 02', email: 'student.02@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'STUDENT' }], expectedRole: 'STUDENT', expectedRoute: '/student', profile: { kind: 'student', rollNo: 'CED10A02' } },
  { scenario: 'Northstar passing student', name: 'Northstar Student 001', email: 'student.001@northstar.example.test', tenantSlug: 'northstar-college', roles: [{ role: 'STUDENT' }], expectedRole: 'STUDENT', expectedRoute: '/student', profile: { kind: 'student', rollNo: 'NS26001' } },
  { scenario: 'Context switch', name: 'Northstar Context Switcher', email: 'context.switch@northstar.example.test', tenantSlug: 'northstar-college', roles: [{ role: 'EXAM_CONTROLLER' }, { role: 'AUDITOR' }], expectedRole: 'EXAM_CONTROLLER', expectedRoute: '/results' },
  { scenario: 'Negative login and authority', name: 'Suspended Cedar Auditor', email: 'suspended@cedar.example.test', tenantSlug: 'cedar-school', roles: [{ role: 'AUDITOR' }], expectedRole: 'DENIED', expectedRoute: '/login', suspended: true },
] as const;

const rule: ValidatedResultRule = {
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

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fallbackNameForEmail(email: string): string {
  const [localPart = 'demo-user', host = ''] = email.split('@');
  const words = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`);
  if (localPart === 'admin' && host.startsWith('northstar.')) {
    return 'Northstar Administrator';
  }
  return words.join(' ') || 'Demo User';
}

async function authService(clock = () => new Date()) {
  const passwords = new Argon2PasswordHasher();
  const dummyPasswordHash = await passwords.hash('UnknownOnly!2026');
  return new AuthApplicationService(
    identities,
    passwords,
    accessTokenCodec(clock),
    new SilentNotifications(),
    { passwordResetUrl: 'http://127.0.0.1:5173/reset-password', dummyPasswordHash },
    clock,
  );
}

function accessTokenCodec(clock = () => new Date()) {
  return new JoseAccessTokenCodec({ algorithm: 'HS256', issuer: 'entropix-demo', audience: 'entropix-demo', secret: new TextEncoder().encode('demo-only-access-token-secret-32-bytes') }, clock);
}

async function provisionCredentials() {
  for (const credential of demoCredentials) {
    expect(credential.email.endsWith('.example.test'), `Non-fictional credential refused: ${credential.email}`);
    let user = await prisma.user.findUnique({ where: { email: credential.email } });
    if (!user) user = await prisma.user.create({ data: { name: credential.name, email: credential.email, status: 'ACTIVE', platformRole: credential.expectedRole === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : null } });
    else await prisma.user.update({ where: { id: user.id }, data: { name: credential.name, status: 'ACTIVE', platformRole: credential.expectedRole === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : null } });

    if (credential.tenantSlug) {
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: credential.tenantSlug } });
      await withTenant(prisma, tenant.id, async (tx) => {
        const membership = await tx.membership.upsert({
          where: { tenantId_userId: { tenantId: tenant.id, userId: user!.id } },
          create: { tenantId: tenant.id, userId: user!.id, status: 'ACTIVE' },
          update: { status: 'ACTIVE' },
        });
        const expectedGrantKeys = new Set<string>();
        for (const grant of credential.roles) {
          const department = grant.departmentCode ? await tx.department.findFirstOrThrow({ where: { tenantId: tenant.id, code: grant.departmentCode } }) : null;
          expectedGrantKeys.add(`${grant.role}:${department?.id ?? ''}`);
          const existing = await tx.roleGrant.findFirst({ where: { tenantId: tenant.id, membershipId: membership.id, role: grant.role, departmentId: department?.id ?? null } });
          if (!existing) await tx.roleGrant.create({ data: { tenantId: tenant.id, membershipId: membership.id, role: grant.role, departmentId: department?.id ?? null } });
        }
        const currentGrants = await tx.roleGrant.findMany({ where: { tenantId: tenant.id, membershipId: membership.id }, select: { id: true, role: true, departmentId: true } });
        const staleGrantIds = currentGrants.filter((grant) => !expectedGrantKeys.has(`${grant.role}:${grant.departmentId ?? ''}`)).map((grant) => grant.id);
        if (staleGrantIds.length) await tx.roleGrant.deleteMany({ where: { tenantId: tenant.id, id: { in: staleGrantIds } } });
        if (credential.profile?.kind === 'faculty') {
          const departmentCode = credential.roles.find((grant) => grant.departmentCode)?.departmentCode ?? (credential.tenantSlug === 'cedar-school' ? 'SCHOOL' : 'CSE');
          const department = await tx.department.findFirstOrThrow({ where: { tenantId: tenant.id, code: departmentCode } });
          await tx.faculty.upsert({
            where: { tenantId_code: { tenantId: tenant.id, code: credential.profile.code } },
            create: { tenantId: tenant.id, membershipId: membership.id, departmentId: department.id, code: credential.profile.code, name: credential.scenario, email: credential.email, status: 'ACTIVE' },
            update: { membershipId: membership.id, departmentId: department.id, name: credential.scenario, email: credential.email, status: 'ACTIVE' },
          });
        }
      });
    }

    if (credential.suspended) await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
  }
  await provisionFixtureProfileNames();
  await provisionFixturePasswords();
}

async function provisionFixtureProfileNames() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: ['northstar-college', 'cedar-school'] } },
    select: { id: true },
  });
  const profiles = (await Promise.all(tenants.map((tenant) =>
    withTenant(prisma, tenant.id, async (tx) => {
      const [faculty, students] = await Promise.all([
        tx.faculty.findMany({
          where: { tenantId: tenant.id },
          select: { name: true, membership: { select: { userId: true } } },
        }),
        tx.student.findMany({
          where: { tenantId: tenant.id },
          select: { name: true, membership: { select: { userId: true } } },
        }),
      ]);
      return [
        ...faculty.map((faculty) => ({ userId: faculty.membership.userId, name: faculty.name })),
        ...students.map((student) => ({ userId: student.membership.userId, name: student.name })),
      ];
    }),
  ))).flat();
  for (const profile of profiles) {
    await prisma.user.update({ where: { id: profile.userId }, data: { name: profile.name } });
  }
  const unnamedUsers = await prisma.user.findMany({
    where: {
      email: { endsWith: '.example.test' },
      OR: [{ name: null }, { name: '' }],
    },
    select: { id: true, email: true },
  });
  for (const user of unnamedUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: fallbackNameForEmail(user.email) },
    });
  }
}

async function provisionFixturePasswords() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '.example.test' } },
    select: { id: true, name: true },
  });
  expect(users.length > 0, 'No fictional demo users are available for password provisioning');
  expect(users.every((user) => user.name), 'Every fictional demo user must have a name before password provisioning');

  const passwords = new Argon2PasswordHasher();
  const now = new Date();
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await passwords.hash(PASSWORD) },
    });
  }
  const userIds = users.map((user) => user.id);
  await prisma.session.updateMany({
    where: { userId: { in: userIds }, revokedAt: null },
    data: { revokedAt: now, revocationReason: 'PASSWORD_RESET' },
  });
  await prisma.authToken.updateMany({
    where: {
      userId: { in: userIds },
      purpose: { in: ['PASSWORD_RESET', 'REFRESH'] },
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
  console.log(`Shared demo password provisioned for ${users.length} fictional users`);
}

async function tenantContext(slug: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const controller = await withTenant(prisma, tenant.id, (tx) => tx.roleGrant.findFirstOrThrow({ where: { tenantId: tenant.id, role: { in: ['EXAM_CONTROLLER', 'INSTITUTION_ADMIN'] }, membership: { status: 'ACTIVE' } } }));
  const term = await withTenant(prisma, tenant.id, (tx) => tx.term.findFirstOrThrow({ where: { tenantId: tenant.id }, orderBy: { sequence: 'asc' } }));
  const subjects = await withTenant(prisma, tenant.id, (tx) => tx.subject.findMany({ where: { tenantId: tenant.id, programId: term.programId }, orderBy: { code: 'asc' } }));
  return { tenant, controller, term, subjects };
}

async function approveNorthstarRegistrations(tenantId: UUID, examId: UUID, examSubjectIds: readonly UUID[], controllerMembershipId: UUID) {
  const students = await withTenant(prisma, tenantId, (tx) => tx.student.findMany({ where: { tenantId, rollNo: { in: ['NS26001', 'NS26002', 'NS26098'] } }, orderBy: { rollNo: 'asc' } }));
  for (const student of students) {
    let registration = await exams.saveDraft(tenantId, examId, student.id, examSubjectIds, new Date('2026-07-15T12:00:00.000Z'));
    const context = await exams.eligibilityContext(tenantId, registration.id);
    expect(context, 'Northstar eligibility context missing');
    const eligible = student.rollNo !== 'NS26098';
    const snapshot = {
      evaluatedAt: HISTORICAL_NOW.toISOString(), eligible,
      checks: [
        { code: 'ACTIVE_STUDENT' as const, passed: true, reason: 'Student is active.' },
        { code: 'CORRECT_TERM_COHORT' as const, passed: true, reason: 'Student cohort belongs to the exam term.' },
        { code: 'ACTIVE_ENROLMENT' as const, passed: true, reason: 'Every selected subject has an active enrolment.' },
        { code: 'CONTROLLER_ELIGIBLE' as const, passed: eligible, reason: eligible ? 'Controller eligibility allows registration.' : 'Fictional rejected-application fixture.' },
      ],
      examSubjectIds: context.selected.map((row) => row.examSubjectId),
      enrolmentIds: context.selected.map((row) => row.enrolmentId),
    };
    registration = (await exams.transition(tenantId, registration.id, ['DRAFT', 'REJECTED'], 'SUBMITTED', snapshot, null, null, new Date('2026-07-15T12:00:00.000Z')))!;
    await exams.transition(tenantId, registration.id, ['SUBMITTED'], eligible ? 'APPROVED' : 'REJECTED', snapshot, controllerMembershipId, eligible ? 'Approved for historical demo.' : 'Fixture rejection for eligibility workflow testing', new Date('2026-07-16T12:00:00.000Z'));
  }
}

async function ensureHistoricalExam(slug: 'cedar-school' | 'northstar-college', code: string, name: string, mode: 'AUTO_ENROL' | 'APPLICATION', day: number) {
  const { tenant, controller, term, subjects } = await tenantContext(slug);
  const existing = await withTenant(prisma, tenant.id, (tx) => tx.exam.findFirst({ where: { tenantId: tenant.id, code }, include: { publications: { where: { isCurrent: true } } } }));
  if (existing?.publications.length) return { tenantId: tenant.id, examId: existing.id, controllerMembershipId: controller.membershipId };

  let exam = existing
    ? (await exams.snapshot(tenant.id, null)).exams.find((entry) => entry.id === existing.id)!
    : await exams.createExam(tenant.id, {
        termId: term.id, code, name, registrationMode: mode,
        registrationOpensAt: '2026-07-01T00:00:00.000Z', registrationClosesAt: '2026-08-01T00:00:00.000Z',
        subjectIds: subjects.map((subject) => subject.id), rule,
      }, rule);
  if (exam.state === 'DRAFT') exam = (await exams.openRegistration(tenant.id, exam.id))!;
  if (exam.state === 'REGISTRATION_OPEN') {
    if (mode === 'AUTO_ENROL') await exams.autoEnrol(tenant.id, exam.id, new Date('2026-07-15T12:00:00.000Z'));
    else await approveNorthstarRegistrations(tenant.id, exam.id, exam.subjects.map((subject) => subject.id), controller.membershipId);
    exam = (await exams.closeRegistration(tenant.id, exam.id))!;
  }

  const campus = await withTenant(prisma, tenant.id, (tx) => tx.campus.findFirstOrThrow({ where: { tenantId: tenant.id }, orderBy: { code: 'asc' } }));
  const hall = await scheduling.createHall(tenant.id, { campusId: campus.id, code: code.startsWith('CEDAR') ? 'HIST-HALL' : 'NORTH-HIST-HALL', name: code.startsWith('CEDAR') ? 'Historical Hall' : 'Northstar Historical Hall', capacity: code.startsWith('CEDAR') ? 30 : 120 });
  let schedule = await scheduling.initializeExam(tenant.id, exam.id);
  for (const [index, paper] of schedule.papers.entries()) {
    const date = String(day + index).padStart(2, '0');
    let updated = await scheduling.updatePaperSchedule(tenant.id, paper.id, new Date(`2026-08-${date}T04:30:00.000Z`), new Date(`2026-08-${date}T07:30:00.000Z`), paper.version);
    updated = await scheduling.commitAllocation(tenant.id, updated.id, [hall.id], updated.version);
  }
  schedule = await scheduling.publish(tenant.id, exam.id, schedule.version);

  const faculty = await withTenant(prisma, tenant.id, (tx) => tx.faculty.findMany({ where: { tenantId: tenant.id, status: 'ACTIVE' }, orderBy: { code: 'asc' } }));
  expect(faculty.length > 0, `${slug} needs active faculty`);
  for (const [paperIndex, paper] of schedule.papers.entries()) {
    const sitting = paper.sittings[0]!;
    const invigilator = faculty[paperIndex % faculty.length]!;
    await withTenant(prisma, tenant.id, async (tx) => {
      const grant = await tx.roleGrant.findFirst({ where: { tenantId: tenant.id, membershipId: invigilator.membershipId, role: 'INVIGILATOR', departmentId: null } });
      if (!grant) await tx.roleGrant.create({ data: { tenantId: tenant.id, membershipId: invigilator.membershipId, role: 'INVIGILATOR' } });
    });
    let duty = await withTenant(prisma, tenant.id, (tx) => tx.duty.findFirst({ where: { tenantId: tenant.id, hallSittingId: sitting.id, facultyId: invigilator.id, state: { in: ['PENDING', 'ACCEPTED'] } } }));
    if (!duty) duty = await conduct.assignDuty(tenant.id, controller.membershipId, sitting.id, { facultyId: invigilator.id });
    const actionTime = new Date(new Date(paper.startsAt!).getTime() + 60_000);
    if (duty.state === 'PENDING') duty = await conduct.respondDuty(tenant.id, invigilator.membershipId, duty.id, 'ACCEPTED', null, actionTime);
    const snapshot = await conduct.snapshot(tenant.id, { membershipId: invigilator.membershipId, controller: false }, actionTime);
    const current = snapshot.sittings.find((row) => row.id === sitting.id)!;
    if (current.attendance.state !== 'SUBMITTED') {
      const rows = current.attendance.rows.map((row, rowIndex) => ({
        seatAssignmentId: row.seatAssignmentId,
        state: (slug === 'cedar-school' && row.rollNo === 'CED10A01' ? 'ABSENT' : rowIndex === 3 ? 'LATE' : 'PRESENT') as AttendanceState,
      }));
      const saved = await conduct.saveAttendance(tenant.id, invigilator.membershipId, sitting.id, { expectedVersion: current.attendance.version, rows }, actionTime);
      await conduct.submitAttendance(tenant.id, invigilator.membershipId, sitting.id, saved.version, actionTime);
    }
  }

  const firstSitting = schedule.papers[0]!.sittings[0]!;
  if (slug === 'cedar-school') {
    const student02 = firstSitting.seats.find((seat) => seat.rollNo === 'CED10A02')!;
    const description = `${SEED_VERSION}: fictional retained student hold`;
    let incident = await withTenant(prisma, tenant.id, (tx) => tx.incident.findFirst({ where: { tenantId: tenant.id, hallSittingId: firstSitting.id, description } }));
    if (!incident) incident = await conduct.createIncident(tenant.id, { membershipId: controller.membershipId, controller: true }, firstSitting.id, { kind: 'STUDENT', description, registrationSubjectIds: [student02.registrationSubjectId] }, HISTORICAL_NOW);
    if (incident.disposition === 'OPEN') await conduct.disposeIncident(tenant.id, controller.membershipId, incident.id, 'RETAIN_WITHHELD', incident.version, 'Retained for the fictional privacy scenario.', HISTORICAL_NOW);
  }
  const hallDescription = `${SEED_VERSION}: resolved hall note`;
  let hallIncident = await withTenant(prisma, tenant.id, (tx) => tx.incident.findFirst({ where: { tenantId: tenant.id, hallSittingId: firstSitting.id, description: hallDescription } }));
  if (!hallIncident) hallIncident = await conduct.createIncident(tenant.id, { membershipId: controller.membershipId, controller: true }, firstSitting.id, { kind: 'HALL', description: hallDescription, registrationSubjectIds: [] }, HISTORICAL_NOW);
  if (hallIncident.disposition === 'OPEN') await conduct.disposeIncident(tenant.id, controller.membershipId, hallIncident.id, 'NO_RESULT_IMPACT', hallIncident.version, 'Resolved with no result impact.', HISTORICAL_NOW);

  const actor: EvaluationActor = { membershipId: controller.membershipId, controller: true, examiner: false, departmentIds: [] };
  let evaluationSnapshot = await evaluation.snapshot(tenant.id, actor);
  for (const subject of evaluationSnapshot.subjects.filter((entry) => entry.examId === exam.id)) {
    const matching = faculty.find((entry) => entry.departmentId === subject.departmentId)!;
    expect(matching, `No department-valid examiner for ${subject.subjectCode}`);
    if (!subject.assignment) await evaluation.assign(tenant.id, actor, subject.examSubjectId, { facultyId: matching.id, expectedVersion: 0 }, HISTORICAL_NOW);
    const refreshed = (await evaluation.snapshot(tenant.id, actor)).subjects.find((entry) => entry.examSubjectId === subject.examSubjectId)!;
    if (refreshed.batch.state === 'APPROVED') continue;
    const examinerMembershipId = faculty.find((entry) => entry.id === refreshed.assignment!.facultyId)!.membershipId;
    const rows = refreshed.roster.map((row) => ({
      registrationSubjectId: row.registrationSubjectId,
      marks: refreshed.components.map((component) => {
        if (row.attendanceState === 'ABSENT' && ['FINAL', 'EXTERNAL'].includes(component.component)) return { component: component.component, value: null };
        const fail = slug === 'northstar-college' && row.rollNo === 'NS26002';
        const maximum = Number(component.maximum);
        return { component: component.component, value: String(maximum * (fail ? 0.3 : 0.75)) };
      }),
    }));
    const saved = await evaluation.save(tenant.id, examinerMembershipId, subject.examSubjectId, { expectedVersion: refreshed.batch.version, rows }, HISTORICAL_NOW);
    const submitted = await evaluation.submit(tenant.id, examinerMembershipId, subject.examSubjectId, saved.version, HISTORICAL_NOW);
    await evaluation.review(tenant.id, actor, subject.examSubjectId, 'APPROVED', { expectedVersion: submitted.version, reason: 'Independent fictional demo approval.' }, HISTORICAL_NOW);
  }
  const run = await results.compute(tenant.id, controller.membershipId, exam.id, HISTORICAL_NOW);
  const publication = await results.publish(tenant.id, controller.membershipId, run.id, HISTORICAL_NOW);
  const retry = await results.publish(tenant.id, controller.membershipId, run.id, HISTORICAL_NOW);
  expect(retry.id === publication.id, `${code} retry changed publication identity`);
  return { tenantId: tenant.id, examId: exam.id, controllerMembershipId: controller.membershipId };
}

async function seed() {
  await provisionCredentials();
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  await withTenant(prisma, northstar.id, async (tx) => {
    const inactive = await tx.student.findFirstOrThrow({ where: { tenantId: northstar.id, rollNo: 'NS26099' } });
    if (inactive.status !== 'INACTIVE') await tx.student.update({ where: { id: inactive.id }, data: { status: 'INACTIVE' } });
  });
  await ensureHistoricalExam('cedar-school', 'CEDAR-HIST-2026', 'Cedar Completed Annual Examination 2026', 'AUTO_ENROL', 20);
  await ensureHistoricalExam('northstar-college', 'NORTHSTAR-HIST-2026', 'Northstar Completed Semester Examination 2026', 'APPLICATION', 24);
  console.log('Full application demo seed READY');
  await structuralSmoke();
}

async function structuralSmoke() {
  const tenants = await prisma.tenant.findMany({ where: { slug: { in: ['northstar-college', 'cedar-school'] }, status: 'ACTIVE' } });
  expect(tenants.length === 2, 'Both ACTIVE demo tenants are required');
  for (const tenant of tenants) {
    const summary = await withTenant(prisma, tenant.id, async (tx) => {
      const graphCounts = await Promise.all([
        tx.campus.count({ where: { tenantId: tenant.id } }),
        tx.department.count({ where: { tenantId: tenant.id } }),
        tx.program.count({ where: { tenantId: tenant.id } }),
        tx.academicYear.count({ where: { tenantId: tenant.id } }),
        tx.term.count({ where: { tenantId: tenant.id } }),
        tx.cohort.count({ where: { tenantId: tenant.id } }),
        tx.subject.count({ where: { tenantId: tenant.id } }),
        tx.student.count({ where: { tenantId: tenant.id } }),
        tx.faculty.count({ where: { tenantId: tenant.id } }),
        tx.enrolment.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }),
      ]);
      expect(graphCounts.every((count) => count > 0), `${tenant.slug} academic/people graph is incomplete`);
      const exam = await tx.exam.findFirstOrThrow({ where: { tenantId: tenant.id, code: tenant.slug === 'cedar-school' ? 'CEDAR-HIST-2026' : 'NORTHSTAR-HIST-2026' }, include: { subjects: { include: { paper: { include: { hallSittings: { include: { duties: true, attendanceBatch: { include: { rows: true } }, incidents: true } } } }, marksBatch: { include: { marks: true } }, registrationSubjects: { where: { registration: { state: 'APPROVED' } }, include: { seatAssignments: true, registration: { include: { student: true } } } } } }, publications: { where: { isCurrent: true }, include: { resultRun: { include: { students: true } } } } } });
      expect(exam.publications.length === 1, `${exam.code} needs exactly one current publication`);
      expect(exam.subjects.every((subject) => subject.paper && subject.paper.hallSittings.length > 0 && subject.marksBatch?.state === 'APPROVED'), `${exam.code} subject readiness incomplete`);
      expect(exam.subjects.every((subject) => subject.marksBatch?.submittedByMembershipId && subject.marksBatch.reviewedByMembershipId && subject.marksBatch.submittedByMembershipId !== subject.marksBatch.reviewedByMembershipId), `${exam.code} marks were not independently approved`);
      expect(exam.subjects.every((subject) => subject.registrationSubjects.every((row) => row.seatAssignments.length === 1)), `${exam.code} exact seat coverage failed`);
      expect(exam.subjects.every((subject) => subject.paper!.hallSittings.every((sitting) => sitting.duties.some((duty) => duty.state === 'ACCEPTED') && sitting.attendanceBatch?.state === 'SUBMITTED' && sitting.attendanceBatch.rows.every((row) => row.state !== 'NOT_MARKED'))), `${exam.code} conduct incomplete`);
      const run = exam.publications[0]!.resultRun;
      expect(run.inputRevision === exam.inputRevision && run.ruleVersionId === exam.ruleVersionId, `${exam.code} current publication is stale`);
      const outcomes = Object.fromEntries(['PASS', 'FAIL', 'ABSENT', 'WITHHELD'].map((outcome) => [outcome, run.students.filter((row) => row.outcome === outcome).length]));
      const registrations = await tx.registration.groupBy({ by: ['state'], where: { tenantId: tenant.id, examId: exam.id }, _count: true });
      if (tenant.slug === 'cedar-school') {
        expect(registrations.some((row) => row.state === 'APPROVED' && row._count === 20), 'Cedar auto-enrol roster is incomplete');
        expect(run.students.length === 20 && outcomes.PASS === 18 && outcomes.FAIL === 0 && outcomes.ABSENT === 1 && outcomes.WITHHELD === 1, 'Cedar result distribution changed');
        expect(exam.subjects.some((subject) => subject.paper!.hallSittings.some((sitting) => sitting.incidents.some((incident) => incident.kind === 'STUDENT' && incident.disposition === 'RETAIN_WITHHELD'))), 'Cedar retained student incident is missing');
        expect(exam.subjects.some((subject) => subject.paper!.hallSittings.some((sitting) => sitting.incidents.some((incident) => incident.kind === 'HALL' && incident.disposition === 'NO_RESULT_IMPACT'))), 'Cedar resolved hall incident is missing');
        const attendanceStates = new Set(exam.subjects.flatMap((subject) => subject.paper!.hallSittings.flatMap((sitting) => sitting.attendanceBatch?.rows.map((row) => row.state) ?? [])));
        expect(['PRESENT', 'LATE', 'ABSENT'].every((state) => attendanceStates.has(state)), 'Cedar attendance mix is incomplete');
        const absentRegistrations = exam.subjects.flatMap((subject) => subject.registrationSubjects.filter((row) => row.registration.student.rollNo === 'CED10A01').map((row) => row.id));
        expect(absentRegistrations.length === exam.subjects.length, 'Cedar absent student subject coverage is incomplete');
        const absentExternalMarks = exam.subjects.flatMap((subject) => subject.marksBatch?.marks ?? []).filter((mark) => absentRegistrations.includes(mark.registrationSubjectId) && ['FINAL', 'EXTERNAL'].includes(mark.component));
        expect(absentExternalMarks.length === 0, 'Cedar absent student has a final/external mark');
      } else {
        expect(registrations.some((row) => row.state === 'APPROVED' && row._count === 2) && registrations.some((row) => row.state === 'REJECTED' && row._count >= 1), 'Northstar approval/rejection fixtures are incomplete');
        expect(run.students.length === 2 && outcomes.PASS === 1 && outcomes.FAIL === 1 && outcomes.ABSENT === 0 && outcomes.WITHHELD === 0, 'Northstar result distribution changed');
        expect(exam.subjects.some((subject) => subject.paper!.hallSittings.some((sitting) => sitting.incidents.some((incident) => incident.kind === 'HALL' && incident.disposition === 'NO_RESULT_IMPACT'))), 'Northstar resolved hall incident is missing');
        const inactive = await tx.student.findFirstOrThrow({ where: { tenantId: tenant.id, rollNo: 'NS26099', status: 'INACTIVE' }, include: { registrations: { where: { examId: exam.id } } } });
        expect(inactive.registrations.length === 0, 'Inactive Northstar student entered the historical exam');
      }
      return { exam: exam.code, students: run.students.length, outcomes, publicationId: exam.publications[0]!.id };
    });
    console.log(`Smoke ${tenant.slug}: ${JSON.stringify(summary)}`);
  }
  const cedar = tenants.find((tenant) => tenant.slug === 'cedar-school')!;
  const annual = await withTenant(prisma, cedar.id, (tx) => tx.exam.findFirstOrThrow({ where: { tenantId: cedar.id, code: 'ANNUAL-2026' }, include: { papers: true } }));
  expect(annual.scheduleRevision === 1 && annual.papers.length === 3 && annual.papers.every((paper) => paper.startsAt && paper.startsAt >= new Date('2026-09-15T00:00:00.000Z')), 'ANNUAL-2026 future schedule changed');
  const declared = await prisma.user.count({ where: { email: { in: demoCredentials.map((entry) => entry.email) } } });
  expect(declared === demoCredentials.length, 'Declared credential graph is incomplete');
  const tenantRoles = new Set((await Promise.all(tenants.map((tenant) => withTenant(prisma, tenant.id, (tx) => tx.roleGrant.findMany({ where: { tenantId: tenant.id }, select: { role: true } }))))).flat().map((grant) => grant.role));
  for (const role of ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY', 'INVIGILATOR', 'STUDENT', 'AUDITOR']) expect(tenantRoles.has(role), `Canonical role ${role} is missing`);
  const demoUsers = await prisma.user.findMany({ where: { email: { in: demoCredentials.map((entry) => entry.email) } }, select: { email: true, platformRole: true } });
  expect(demoUsers.every((user) => user.platformRole === (user.email === 'platform.admin@demo.example.test' ? 'PLATFORM_ADMIN' : null)), 'A reserved demo credential has unexpected platform authority');
  console.log('Full application structural/business smoke READY');
}

async function cleanupBulkImport(tenantId: UUID, contentHash: string, rollNos: readonly string[]) {
  const userIds = await withTenant(prisma, tenantId, async (tx) => {
    const students = await tx.student.findMany({ where: { tenantId, rollNo: { in: [...rollNos] } }, select: { id: true, membershipId: true, membership: { select: { userId: true } } } });
    const studentIds = students.map((student) => student.id);
    const membershipIds = students.flatMap((student) => student.membershipId ? [student.membershipId] : []);
    const registrationSubjects = await tx.registrationSubject.findMany({ where: { tenantId, registration: { studentId: { in: studentIds } } }, select: { id: true } });
    const registrationSubjectIds = registrationSubjects.map((row) => row.id);
    const seatAssignments = await tx.seatAssignment.findMany({ where: { tenantId, registrationSubjectId: { in: registrationSubjectIds } }, select: { id: true } });
    const seatAssignmentIds = seatAssignments.map((row) => row.id);
    await tx.attendance.deleteMany({ where: { tenantId, seatAssignmentId: { in: seatAssignmentIds } } });
    await tx.incidentStudent.deleteMany({ where: { tenantId, registrationSubjectId: { in: registrationSubjectIds } } });
    await tx.mark.deleteMany({ where: { tenantId, registrationSubjectId: { in: registrationSubjectIds } } });
    await tx.resultItem.deleteMany({ where: { tenantId, registrationSubjectId: { in: registrationSubjectIds } } });
    await tx.seatAssignment.deleteMany({ where: { tenantId, id: { in: seatAssignmentIds } } });
    await tx.registrationSubject.deleteMany({ where: { tenantId, id: { in: registrationSubjectIds } } });
    await tx.registration.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });
    await tx.studentResult.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });
    await tx.enrolment.deleteMany({ where: { tenantId, studentId: { in: studentIds } } });
    await tx.student.deleteMany({ where: { tenantId, id: { in: studentIds } } });
    await tx.roleGrant.deleteMany({ where: { tenantId, membershipId: { in: membershipIds } } });
    await tx.membership.deleteMany({ where: { tenantId, id: { in: membershipIds } } });
    await tx.studentImport.deleteMany({ where: { tenantId, contentHash } });
    return students.map((student) => student.membership?.userId).filter((userId): userId is string => Boolean(userId));
  });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds }, email: { endsWith: '.example.test' }, memberships: { none: {} } } });
}

async function bulkImports() {
  const people = new PeopleService(new PeopleRepository(prisma));
  for (const fixture of [
    { tenantSlug: 'northstar-college', fileName: 'northstar-students-upload.csv' },
    { tenantSlug: 'cedar-school', fileName: 'cedar-students-upload.csv' },
  ]) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: fixture.tenantSlug } });
    const membership = await withTenant(prisma, tenant.id, (tx) => tx.membership.findFirstOrThrow({ where: { tenantId: tenant.id, user: { email: `institution.admin@${fixture.tenantSlug === 'cedar-school' ? 'cedar' : 'northstar'}.example.test` } } }));
    const context: AuthenticatedContext = { kind: 'TENANT', userId: membership.userId, tenantId: tenant.id, membershipId: membership.id, activeRole: 'INSTITUTION_ADMIN', grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }] };
    const sourceText = await readFile(fileURLToPath(new URL(`../../../fixtures/imports/bulk/${fixture.fileName}`, import.meta.url)), 'utf8');
    const request = { fileName: fixture.fileName, sourceText };
    const preview = await people.previewImport(context, request);
    expect(preview.rowCount === 12 && preview.acceptedCount === 12 && preview.rejectedCount === 0, `${fixture.fileName} preview failed`);
    const importedRolls = preview.rows.map((row) => row.rollNo);
    try {
      const committed = await people.commitImport(context, request);
      const replay = await people.commitImport(context, request);
      expect(committed.rowCount === 12 && committed.createdCount === 12 && committed.enrolmentCount === 36, `${fixture.fileName} commit counts changed`);
      expect(replay.replayed && replay.importId === committed.importId, `${fixture.fileName} commit replay was not idempotent`);
      const imported = await withTenant(prisma, tenant.id, (tx) => tx.student.findMany({ where: { tenantId: tenant.id, rollNo: { in: importedRolls } }, include: { enrolments: { where: { status: 'ACTIVE' } }, membership: { include: { roleGrants: true } } } }));
      expect(imported.length === 12 && imported.every((student) => student.enrolments.length === 3 && student.membership?.roleGrants.some((grant) => grant.role === 'STUDENT')), `${fixture.fileName} persisted graph is incomplete`);
    } finally {
      await cleanupBulkImport(tenant.id, preview.contentHash, importedRolls);
    }
  }

  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  const membership = await withTenant(prisma, northstar.id, (tx) => tx.membership.findFirstOrThrow({ where: { tenantId: northstar.id, user: { email: 'institution.admin@northstar.example.test' } } }));
  const context: AuthenticatedContext = { kind: 'TENANT', userId: membership.userId, tenantId: northstar.id, membershipId: membership.id, activeRole: 'INSTITUTION_ADMIN', grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }] };
  const fileName = 'student-import-reconciliation.csv';
  const sourceText = await readFile(fileURLToPath(new URL(`../../../fixtures/imports/bulk/${fileName}`, import.meta.url)), 'utf8');
  const preview = await people.previewImport(context, { fileName, sourceText });
  const errorCodes = new Set(preview.errors.map((error) => error.code));
  expect(preview.rowCount === 7 && preview.rejectedCount === 6, 'Reconciliation preview row counts changed');
  expect(['EXISTING_ROLL', 'UNKNOWN_SUBJECT', 'MALFORMED_VALUE', 'MISSING_VALUE', 'UNKNOWN_COHORT', 'DUPLICATE_FILE_ROLL'].every((code) => errorCodes.has(code as never)), 'Reconciliation preview error coverage changed');
  let rejected = false;
  try { await people.commitImport(context, { fileName, sourceText }); } catch { rejected = true; }
  expect(rejected, 'Invalid reconciliation file unexpectedly committed');
  console.log('Bulk student import preview/commit/replay, cleanup, and reconciliation rejection READY');
}

async function roleMatrix() {
  const auth = await authService();
  const tokens = accessTokenCodec();
  for (const credential of demoCredentials) {
    let denied = false;
    try {
      const session = await auth.login({ email: credential.email, password: PASSWORD });
      if (credential.expectedRole === 'DENIED') throw new Error('Suspended credential unexpectedly authenticated');
      let identity = await tokens.verify(session.accessToken);
      let context = await authority.resolveCurrentAuthority(identity, new Date());
      expect(context, `${credential.email} did not resolve live authority`);
      let principal = { identity, context };
      if (credential.expectedRole !== 'PLATFORM_ADMIN' && context.kind === 'TENANT' && context.activeRole !== credential.expectedRole) {
        const selected = await auth.switchContext(principal, { institutionId: context.tenantId, role: credential.expectedRole });
        identity = await tokens.verify(selected.accessToken);
        context = await authority.resolveCurrentAuthority(identity, new Date());
        expect(context, `${credential.email} selected role lost live authority`);
        principal = { identity, context };
      }
      if (credential.expectedRole === 'PLATFORM_ADMIN') expect(context.kind === 'PLATFORM', `${credential.email} did not resolve platform context`);
      else expect(context.kind === 'TENANT' && context.activeRole === credential.expectedRole, `${credential.email} resolved incorrect active role`);
      if (credential.scenario === 'Context switch' && context.kind === 'TENANT') {
        const switched = await auth.switchContext(principal, { institutionId: context.tenantId, role: 'AUDITOR' });
        expect(switched.accessToken.length > 20, 'Context switch did not issue a replacement access token');
      }
      await auth.logout(principal);
      try { await auth.refresh(session.refreshToken); } catch { denied = true; }
      expect(denied, `${credential.email} refresh survived logout`);
    } catch (error) {
      if (credential.expectedRole === 'DENIED') denied = true;
      else throw error;
    }
    expect(credential.expectedRole !== 'DENIED' || denied, `${credential.email} negative login was not denied`);
  }
  const cedar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  const foreignStudent = await withTenant(prisma, cedar.id, (tx) => tx.student.findFirstOrThrow({ where: { tenantId: cedar.id }, select: { id: true } }));
  const leaked = await withTenant(prisma, northstar.id, (tx) => tx.student.findFirst({ where: { id: foreignStudent.id } }));
  expect(!leaked, 'Known foreign student ID crossed tenant boundary');
  console.log(`Authenticated role matrix READY (${demoCredentials.length - 1} usable, 1 expected denial; logout revocation and tenant isolation verified)`);
}

async function journeys() {
  const cedar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  for (const fixture of [
    { tenant: cedar, email: 'student.03@cedar.example.test', outcome: 'PASS', grade: true },
    { tenant: cedar, email: 'student.01@cedar.example.test', outcome: 'ABSENT', grade: true },
    { tenant: cedar, email: 'student.02@cedar.example.test', outcome: 'WITHHELD', grade: false },
    { tenant: northstar, email: 'student.001@northstar.example.test', outcome: 'PASS', grade: true },
  ]) {
    const membership = await withTenant(prisma, fixture.tenant.id, (tx) => tx.membership.findFirstOrThrow({ where: { tenantId: fixture.tenant.id, user: { email: fixture.email } } }));
    const snapshot = await portal.snapshot(fixture.tenant.id, membership.id);
    expect(snapshot.result?.outcome === fixture.outcome, `${fixture.email} expected ${fixture.outcome}`);
    expect(snapshot.registrations.length > 0 && snapshot.timetables.length > 0, `${fixture.email} journey lacks registration or timetable`);
    expect(snapshot.documents.some((entry) => entry.kind === 'GRADE_CARD') === fixture.grade, `${fixture.email} grade-card eligibility mismatch`);
    if (fixture.outcome === 'WITHHELD') expect(snapshot.result && !('items' in snapshot.result), 'WITHHELD portal leaked result detail');
  }
  console.log('School and college API journeys READY (PASS/ABSENT/WITHHELD privacy and grade-card eligibility verified)');
}

try {
  if (mode === 'guard') console.log('Full application demo mutation guard READY');
  else if (mode === 'seed') await seed();
  else if (mode === 'smoke') await structuralSmoke();
  else if (mode === 'roles') await roleMatrix();
  else if (mode === 'journey') await journeys();
  else await bulkImports();
} finally {
  await prisma.$disconnect();
}
