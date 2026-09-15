import type {
  FacultyDirectoryRecord,
  StudentDirectoryRecord,
  StudentImportCommitResult,
  UUID,
} from '@entropix/contracts';
import { PrismaClient, withTenant } from '@entropix/db';
import type { Prisma } from '@entropix/db';
import { Injectable } from '@nestjs/common';

export interface ImportRowToCreate {
  rollNo: string;
  name: string;
  email: string;
  cohortId: UUID;
  subjectIds: readonly UUID[];
}

export interface ImportValidationContext {
  cohorts: readonly {
    id: UUID;
    code: string;
    programId: UUID;
  }[];
  subjects: readonly { id: UUID; code: string; programId: UUID }[];
  existingRolls: ReadonlySet<string>;
  committed: StudentImportCommitResult | null;
}

function committedResult(row: {
  id: string;
  contentHash: string;
  rowCount: number;
  createdCount: number;
  enrolmentCount: number;
  committedAt: Date;
}, replayed: boolean): StudentImportCommitResult {
  return {
    importId: row.id,
    contentHash: row.contentHash,
    rowCount: row.rowCount,
    createdCount: row.createdCount,
    enrolmentCount: row.enrolmentCount,
    replayed,
    committedAt: row.committedAt.toISOString(),
  };
}

@Injectable()
export class PeopleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listStudents(
    tenantId: UUID,
    membershipId: UUID | null,
    search: string,
    pageSize: number,
    cursor: UUID | null,
  ): Promise<{
    students: StudentDirectoryRecord[];
    total: number;
    nextCursor: UUID | null;
  } | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const where: Prisma.StudentWhereInput = {
        tenantId,
        ...(membershipId ? { membershipId } : {}),
        ...(search
          ? {
              OR: [
                { rollNo: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      if (cursor) {
        const cursorExists = await tx.student.findFirst({
          where: { ...where, id: cursor },
          select: { id: true },
        });
        if (!cursorExists) return null;
      }
      const [total, rows] = await Promise.all([
        tx.student.count({ where }),
        tx.student.findMany({
          where,
          include: {
            cohort: { select: { id: true, code: true, name: true } },
            enrolments: {
              where: { status: 'ACTIVE' },
              include: { subject: { select: { id: true, code: true, name: true } } },
              orderBy: { subject: { code: 'asc' } },
            },
          },
          orderBy: [{ rollNo: 'asc' }, { id: 'asc' }],
          take: pageSize + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      ]);
      const hasMore = rows.length > pageSize;
      const visibleRows = hasMore ? rows.slice(0, pageSize) : rows;
      return {
        students: visibleRows.map((row) => ({
          id: row.id,
          membershipId: row.membershipId,
          rollNo: row.rollNo,
          name: row.name,
          email: row.email,
          status: row.status as 'ACTIVE' | 'INACTIVE',
          cohort: row.cohort,
          subjects: row.enrolments.map((entry) => entry.subject),
        })),
        total,
        nextCursor: hasMore
          ? visibleRows[visibleRows.length - 1]?.id ?? null
          : null,
      };
    });
  }

  async getStudent(
    tenantId: UUID,
    id: UUID,
    membershipId: UUID | null,
  ): Promise<StudentDirectoryRecord | null> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const row = await tx.student.findFirst({
        where: { tenantId, id, ...(membershipId ? { membershipId } : {}) },
        include: {
          cohort: { select: { id: true, code: true, name: true } },
          enrolments: {
            where: { status: 'ACTIVE' },
            include: { subject: { select: { id: true, code: true, name: true } } },
            orderBy: { subject: { code: 'asc' } },
          },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        membershipId: row.membershipId,
        rollNo: row.rollNo,
        name: row.name,
        email: row.email,
        status: row.status as 'ACTIVE' | 'INACTIVE',
        cohort: row.cohort,
        subjects: row.enrolments.map((entry) => entry.subject),
      };
    });
  }

  async listFaculty(tenantId: UUID): Promise<FacultyDirectoryRecord[]> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const rows = await tx.faculty.findMany({
        where: { tenantId },
        include: { department: { select: { id: true, code: true, name: true } } },
        orderBy: { code: 'asc' },
      });
      return rows.map((row) => ({
        id: row.id,
        membershipId: row.membershipId,
        code: row.code,
        name: row.name,
        email: row.email,
        status: row.status as 'ACTIVE' | 'INACTIVE',
        department: row.department,
      }));
    });
  }

  async importContext(
    tenantId: UUID,
    contentHash: string,
  ): Promise<ImportValidationContext> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const [cohorts, subjects, students, committed] = await Promise.all([
        tx.cohort.findMany({
          where: { tenantId },
          select: { id: true, code: true, term: { select: { programId: true } } },
        }),
        tx.subject.findMany({
          where: { tenantId },
          select: { id: true, code: true, programId: true },
        }),
        tx.student.findMany({ where: { tenantId }, select: { rollNo: true } }),
        tx.studentImport.findUnique({
          where: { tenantId_contentHash: { tenantId, contentHash } },
        }),
      ]);
      return {
        cohorts: cohorts.map((row) => ({
          id: row.id,
          code: row.code,
          programId: row.term.programId,
        })),
        subjects,
        existingRolls: new Set(students.map((row) => row.rollNo)),
        committed: committed ? committedResult(committed, true) : null,
      };
    });
  }

  async commitImport(
    tenantId: UUID,
    fileName: string,
    contentHash: string,
    rows: readonly ImportRowToCreate[],
  ): Promise<StudentImportCommitResult> {
    return withTenant(this.prisma, tenantId, async (tx) => {
      const previous = await tx.studentImport.findUnique({
        where: { tenantId_contentHash: { tenantId, contentHash } },
      });
      if (previous) return committedResult(previous, true);

      const emails = rows.map((row) => row.email);
      const existingUsers = await tx.user.findMany({ where: { email: { in: emails } } });
      const existingEmails = new Set(existingUsers.map((user) => user.email));
      await tx.user.createMany({
        data: emails.filter((email) => !existingEmails.has(email)).map((email) => ({
          email,
          status: 'ACTIVE',
        })),
        skipDuplicates: true,
      });
      const users = await tx.user.findMany({ where: { email: { in: emails } } });
      const userByEmail = new Map(users.map((user) => [user.email, user]));
      const userIds = users.map((user) => user.id);
      const existingMemberships = await tx.membership.findMany({
        where: { tenantId, userId: { in: userIds } },
      });
      const membershipUserIds = new Set(existingMemberships.map((membership) => membership.userId));
      await tx.membership.createMany({
        data: userIds.filter((userId) => !membershipUserIds.has(userId)).map((userId) => ({
          tenantId,
          userId,
          status: 'ACTIVE',
        })),
        skipDuplicates: true,
      });
      const memberships = await tx.membership.findMany({
        where: { tenantId, userId: { in: userIds } },
      });
      const membershipByUser = new Map(memberships.map((membership) => [membership.userId, membership]));
      const existingGrants = await tx.roleGrant.findMany({
        where: {
          tenantId,
          membershipId: { in: memberships.map((membership) => membership.id) },
          role: 'STUDENT',
          departmentId: null,
        },
      });
      const grantedMemberships = new Set(existingGrants.map((grant) => grant.membershipId));
      await tx.roleGrant.createMany({
        data: memberships.filter((membership) => !grantedMemberships.has(membership.id)).map((membership) => ({
          tenantId,
          membershipId: membership.id,
          role: 'STUDENT',
        })),
        skipDuplicates: true,
      });
      await tx.student.createMany({
        data: rows.map((row) => {
          const user = userByEmail.get(row.email)!;
          const membership = membershipByUser.get(user.id)!;
          return {
            tenantId,
            membershipId: membership.id,
            cohortId: row.cohortId,
            rollNo: row.rollNo,
            name: row.name,
            email: row.email,
          };
        }),
      });
      const students = await tx.student.findMany({
        where: { tenantId, rollNo: { in: rows.map((row) => row.rollNo) } },
      });
      const studentByRoll = new Map(students.map((student) => [student.rollNo, student]));
      const enrolments = rows.flatMap((row) => row.subjectIds.map((subjectId) => ({
        tenantId,
        studentId: studentByRoll.get(row.rollNo)!.id,
        cohortId: row.cohortId,
        subjectId,
      })));
      await tx.enrolment.createMany({ data: enrolments });
      const enrolmentCount = enrolments.length;
      const committed = await tx.studentImport.create({
        data: {
          tenantId,
          contentHash,
          fileName,
          rowCount: rows.length,
          createdCount: rows.length,
          enrolmentCount,
        },
      });
      return committedResult(committed, false);
    }, { maxWait: 50_000, timeout: 120_000 });
  }
}
