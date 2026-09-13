import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });

try {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const result = await withTenant(prisma, tenant.id, async (tx) => {
    const exam = await tx.exam.findFirstOrThrow({ where: { tenantId: tenant.id, code: 'ANNUAL-2026' }, include: { subjects: { include: { subject: true } } } });
    const campus = await tx.campus.findFirstOrThrow({ where: { tenantId: tenant.id }, orderBy: { code: 'asc' } });
    const hallA = await tx.hall.upsert({
      where: { tenantId_campusId_code: { tenantId: tenant.id, campusId: campus.id, code: 'HALL-A' } },
      create: { tenantId: tenant.id, campusId: campus.id, code: 'HALL-A', name: 'Hall A', capacity: 30 },
      update: { name: 'Hall A', capacity: 30 },
    });
    await tx.hall.upsert({
      where: { tenantId_campusId_code: { tenantId: tenant.id, campusId: campus.id, code: 'HALL-B' } },
      create: { tenantId: tenant.id, campusId: campus.id, code: 'HALL-B', name: 'Hall B', capacity: 4 },
      update: { name: 'Hall B', capacity: 4 },
    });
    if (exam.state === 'REGISTRATION_OPEN') await tx.exam.update({ where: { id: exam.id }, data: { state: 'PREPARATION', version: { increment: 1 } } });
    await tx.examPaper.createMany({ data: exam.subjects.map((subject) => ({ tenantId: tenant.id, examId: exam.id, examSubjectId: subject.id })), skipDuplicates: true });
    const papers = await tx.examPaper.findMany({ where: { tenantId: tenant.id, examId: exam.id }, include: { examSubject: { include: { subject: true } } }, orderBy: { examSubject: { subject: { code: 'asc' } } } });
    for (const [index, paper] of papers.entries()) {
      const startsAt = new Date(`2026-09-${String(15 + index).padStart(2, '0')}T04:30:00.000Z`);
      const endsAt = new Date(`2026-09-${String(15 + index).padStart(2, '0')}T07:30:00.000Z`);
      await tx.examPaper.update({ where: { id: paper.id }, data: { startsAt, endsAt } });
      const roster = await tx.registrationSubject.findMany({
        where: { tenantId: tenant.id, examSubjectId: paper.examSubjectId, registration: { state: 'APPROVED' } },
        include: { registration: { include: { student: true } } },
        orderBy: { registration: { student: { rollNo: 'asc' } } },
      });
      if (roster.length > hallA.capacity) throw new Error(`${paper.examSubject.subject.code} roster exceeds Hall A capacity`);
      const existing = await tx.hallSitting.findMany({ where: { tenantId: tenant.id, examPaperId: paper.id }, include: { seatAssignments: { orderBy: { seatNumber: 'asc' } } }, orderBy: { roomOrder: 'asc' } });
      const exact = existing.length === 1 && existing[0]!.hallId === hallA.id && existing[0]!.seatAssignments.length === roster.length && roster.every((entry, seatIndex) => existing[0]!.seatAssignments[seatIndex]?.registrationSubjectId === entry.id && existing[0]!.seatAssignments[seatIndex]?.seatNumber === seatIndex + 1);
      if (!exact) {
        await tx.hallSitting.deleteMany({ where: { tenantId: tenant.id, examPaperId: paper.id } });
        const sitting = await tx.hallSitting.create({ data: { tenantId: tenant.id, examPaperId: paper.id, hallId: hallA.id, roomOrder: 1 } });
        await tx.seatAssignment.createMany({ data: roster.map((entry, seatIndex) => ({
          tenantId: tenant.id,
          examPaperId: paper.id,
          examSubjectId: paper.examSubjectId,
          hallSittingId: sitting.id,
          registrationSubjectId: entry.id,
          seatNumber: seatIndex + 1,
        })) });
      }
    }
    await tx.exam.update({ where: { id: exam.id }, data: { state: 'SCHEDULE_PUBLISHED', scheduleRevision: 1 } });
    return { papers: papers.length, halls: 2, seats: await tx.seatAssignment.count({ where: { tenantId: tenant.id, examPaper: { examId: exam.id } } }) };
  }, { maxWait: 10_000, timeout: 120_000 });
  console.log(`Scheduling fixture ready: ${tenant.name} (${result.papers} papers, ${result.halls} halls, ${result.seats} seats)`);
} finally {
  await prisma.$disconnect();
}
