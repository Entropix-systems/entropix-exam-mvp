import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

interface TenantFixture {
  tenant: { slug: string; name: string; timezone: string };
  faculty: readonly {
    code: string;
    name: string;
    email: string;
    departmentCodes: readonly string[];
  }[];
}

const sources = [
  {
    tenant: new URL('../../../fixtures/tenants/northstar-college.json', import.meta.url),
    students: new URL('../../../fixtures/imports/northstar-students-valid.csv', import.meta.url),
  },
  {
    tenant: new URL('../../../fixtures/tenants/cedar-school.json', import.meta.url),
    students: new URL('../../../fixtures/imports/cedar-students-valid.csv', import.meta.url),
  },
];

function parseCsv(source: string) {
  return source.trim().split(/\r?\n/).slice(1).map((line) => {
    const [rollNo, name, email, cohortCode, subjects] = line.split(',');
    return {
      rollNo,
      name,
      email: email.toLowerCase(),
      cohortCode,
      subjectCodes: subjects.split('|'),
    };
  });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, {
  sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
});

try {
  for (const source of sources) {
    const fixture = JSON.parse(await readFile(source.tenant, 'utf8')) as TenantFixture;
    const csv = await readFile(source.students, 'utf8');
    const students = parseCsv(csv);
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { slug: fixture.tenant.slug },
    });
    await withTenant(prisma, tenant.id, async (tx) => {
      const departments = await tx.department.findMany({ where: { tenantId: tenant.id } });
      const departmentByCode = new Map(departments.map((row) => [row.code, row]));
      for (const entry of fixture.faculty) {
        for (const code of entry.departmentCodes) {
          if (!departmentByCode.has(code)) throw new Error(`Unknown faculty department ${code}`);
        }
      }
      const facultyEmails = fixture.faculty.map((entry) => entry.email);
      const existingFacultyUsers = await tx.user.findMany({ where: { email: { in: facultyEmails } } });
      const existingFacultyEmails = new Set(existingFacultyUsers.map((user) => user.email));
      await tx.user.createMany({
        data: facultyEmails.filter((email) => !existingFacultyEmails.has(email)).map((email) => ({ email, status: 'ACTIVE' })),
        skipDuplicates: true,
      });
      const facultyUsers = await tx.user.findMany({ where: { email: { in: facultyEmails } } });
      const facultyUserByEmail = new Map(facultyUsers.map((user) => [user.email, user]));
      const existingFacultyMemberships = await tx.membership.findMany({
        where: { tenantId: tenant.id, userId: { in: facultyUsers.map((user) => user.id) } },
      });
      const facultyMembershipUserIds = new Set(existingFacultyMemberships.map((membership) => membership.userId));
      await tx.membership.createMany({
        data: facultyUsers.filter((user) => !facultyMembershipUserIds.has(user.id)).map((user) => ({
          tenantId: tenant.id,
          userId: user.id,
          status: 'ACTIVE',
        })),
        skipDuplicates: true,
      });
      const facultyMemberships = await tx.membership.findMany({
        where: { tenantId: tenant.id, userId: { in: facultyUsers.map((user) => user.id) } },
      });
      const facultyMembershipByUser = new Map(facultyMemberships.map((membership) => [membership.userId, membership]));
      const desiredFacultyGrants = fixture.faculty.flatMap((entry) => {
        const user = facultyUserByEmail.get(entry.email)!;
        const membership = facultyMembershipByUser.get(user.id)!;
        return entry.departmentCodes.map((code) => ({
          tenantId: tenant.id,
          membershipId: membership.id,
          role: 'FACULTY',
          departmentId: departmentByCode.get(code)!.id,
        }));
      });
      const existingFacultyGrants = await tx.roleGrant.findMany({
        where: { tenantId: tenant.id, role: 'FACULTY', membershipId: { in: facultyMemberships.map((row) => row.id) } },
      });
      const facultyGrantKeys = new Set(existingFacultyGrants.map((grant) => `${grant.membershipId}:${grant.departmentId}`));
      await tx.roleGrant.createMany({
        data: desiredFacultyGrants.filter((grant) => !facultyGrantKeys.has(`${grant.membershipId}:${grant.departmentId}`)),
        skipDuplicates: true,
      });
      await tx.faculty.createMany({
        data: fixture.faculty.map((entry) => {
          const user = facultyUserByEmail.get(entry.email)!;
          return {
            tenantId: tenant.id,
            membershipId: facultyMembershipByUser.get(user.id)!.id,
            departmentId: departmentByCode.get(entry.departmentCodes[0])!.id,
            code: entry.code,
            name: entry.name,
            email: entry.email,
          };
        }),
        skipDuplicates: true,
      });

      const cohorts = await tx.cohort.findMany({
        where: { tenantId: tenant.id },
        include: { term: { select: { programId: true } } },
      });
      const subjects = await tx.subject.findMany({ where: { tenantId: tenant.id } });
      const cohortByCode = new Map(cohorts.map((row) => [row.code, row]));
      const subjectByCode = new Map(subjects.map((row) => [row.code, row]));
      for (const entry of students) {
        const cohort = cohortByCode.get(entry.cohortCode);
        if (!cohort) throw new Error(`Unknown cohort ${entry.cohortCode}`);
        for (const code of entry.subjectCodes) {
          const subject = subjectByCode.get(code);
          if (!subject || subject.programId !== cohort.term.programId)
            throw new Error(`Unknown subject ${code} for ${entry.cohortCode}`);
        }
      }
      const emails = students.map((entry) => entry.email);
      const existingUsers = await tx.user.findMany({ where: { email: { in: emails } } });
      const existingEmails = new Set(existingUsers.map((user) => user.email));
      await tx.user.createMany({
        data: emails.filter((email) => !existingEmails.has(email)).map((email) => ({ email, status: 'ACTIVE' })),
        skipDuplicates: true,
      });
      const users = await tx.user.findMany({ where: { email: { in: emails } } });
      const userByEmail = new Map(users.map((user) => [user.email, user]));
      const existingMemberships = await tx.membership.findMany({
        where: { tenantId: tenant.id, userId: { in: users.map((user) => user.id) } },
      });
      const membershipUserIds = new Set(existingMemberships.map((membership) => membership.userId));
      await tx.membership.createMany({
        data: users.filter((user) => !membershipUserIds.has(user.id)).map((user) => ({
          tenantId: tenant.id,
          userId: user.id,
          status: 'ACTIVE',
        })),
        skipDuplicates: true,
      });
      const memberships = await tx.membership.findMany({
        where: { tenantId: tenant.id, userId: { in: users.map((user) => user.id) } },
      });
      const membershipByUser = new Map(memberships.map((membership) => [membership.userId, membership]));
      const grants = await tx.roleGrant.findMany({
        where: {
          tenantId: tenant.id,
          membershipId: { in: memberships.map((membership) => membership.id) },
          role: 'STUDENT',
          departmentId: null,
        },
      });
      const grantedMembershipIds = new Set(grants.map((grant) => grant.membershipId));
      await tx.roleGrant.createMany({
        data: memberships.filter((membership) => !grantedMembershipIds.has(membership.id)).map((membership) => ({
          tenantId: tenant.id,
          membershipId: membership.id,
          role: 'STUDENT',
        })),
        skipDuplicates: true,
      });
      await tx.student.createMany({
        data: students.map((entry) => {
          const cohort = cohortByCode.get(entry.cohortCode)!;
          const user = userByEmail.get(entry.email)!;
          return {
            tenantId: tenant.id,
            membershipId: membershipByUser.get(user.id)!.id,
            cohortId: cohort.id,
            rollNo: entry.rollNo,
            name: entry.name,
            email: entry.email,
          };
        }),
        skipDuplicates: true,
      });
      const persistedStudents = await tx.student.findMany({
        where: { tenantId: tenant.id, rollNo: { in: students.map((entry) => entry.rollNo) } },
      });
      const studentByRoll = new Map(persistedStudents.map((student) => [student.rollNo, student]));
      const enrolments = students.flatMap((entry) => {
        const cohort = cohortByCode.get(entry.cohortCode)!;
        const student = studentByRoll.get(entry.rollNo)!;
        return entry.subjectCodes.map((code) => ({
          tenantId: tenant.id,
          studentId: student.id,
          cohortId: cohort.id,
          subjectId: subjectByCode.get(code)!.id,
          status: 'ACTIVE',
        }));
      });
      await tx.enrolment.createMany({ data: enrolments, skipDuplicates: true });
      const enrolmentCount = enrolments.length;
      const contentHash = createHash('sha256').update(csv, 'utf8').digest('hex');
      await tx.studentImport.upsert({
        where: { tenantId_contentHash: { tenantId: tenant.id, contentHash } },
        update: {
          fileName: fileURLToPath(source.students).split('/').at(-1)!,
          rowCount: students.length,
          createdCount: students.length,
          enrolmentCount,
        },
        create: {
          tenantId: tenant.id,
          contentHash,
          fileName: fileURLToPath(source.students).split('/').at(-1)!,
          rowCount: students.length,
          createdCount: students.length,
          enrolmentCount,
        },
      });
    }, { maxWait: 10_000, timeout: 180_000 });
    console.log(`People fixture ready: ${fixture.tenant.name} (${students.length} students)`);
  }
} finally {
  await prisma.$disconnect();
}
