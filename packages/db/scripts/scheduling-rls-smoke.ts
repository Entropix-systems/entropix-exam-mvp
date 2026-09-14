import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createPrismaClient } from '../src/client.js';
import { withTenant } from '../src/tenant.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(connectionString, { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined });

try {
  const northstar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'northstar-college' } });
  const cedar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'cedar-school' } });
  const cedarState = await withTenant(prisma, cedar.id, async (tx) => {
    const exam = await tx.exam.findFirstOrThrow({ where: { code: 'ANNUAL-2026' }, include: { papers: { include: { hallSittings: { include: { seatAssignments: { include: { registrationSubject: { include: { registration: { include: { student: true } } } } } } } } } } } });
    const seats = exam.papers.flatMap((paper) => paper.hallSittings.flatMap((sitting) => sitting.seatAssignments));
    const halls = await tx.hall.count({ where: { code: { in: ['HALL-A', 'HALL-B'] } } });
    for (const paper of exam.papers) {
      const ordered = paper.hallSittings.flatMap((sitting) => sitting.seatAssignments).sort((a, b) => a.seatNumber - b.seatNumber);
      if (ordered.some((seat, index) => seat.seatNumber !== index + 1)) throw new Error('Seat numbers are not contiguous');
      const rolls = ordered.map((seat) => seat.registrationSubject.registration.student.rollNo);
      if (rolls.some((roll, index) => index > 0 && rolls[index - 1]! > roll)) throw new Error('Seats are not deterministic by roll number');
    }
    return { state: exam.state, revision: exam.scheduleRevision, papers: exam.papers.length, halls, seats: seats.length, uniqueRosterIds: new Set(seats.map((seat) => seat.registrationSubjectId)).size };
  });
  if (JSON.stringify(cedarState) !== JSON.stringify({ state: 'SCHEDULE_PUBLISHED', revision: 1, papers: 3, halls: 2, seats: 60, uniqueRosterIds: 60 })) throw new Error(`Cedar schedule is invalid: ${JSON.stringify(cedarState)}`);
  const unscoped = await Promise.all([prisma.examPaper.count(), prisma.hall.count(), prisma.hallSitting.count(), prisma.seatAssignment.count()]);
  if (unscoped.some(Boolean)) throw new Error('Missing tenant context exposed scheduling records');
  const cedarHallId = await withTenant(prisma, cedar.id, async (tx) => (await tx.hall.findFirstOrThrow()).id);
  if (await withTenant(prisma, northstar.id, (tx) => tx.hall.findFirst({ where: { id: cedarHallId } }))) throw new Error('Northstar scope exposed a Cedar hall');
  console.log(`Cedar schedule: ${JSON.stringify(cedarState)}`);
  console.log('Scheduling tenant isolation and deterministic seats: READY');
} finally {
  await prisma.$disconnect();
}
