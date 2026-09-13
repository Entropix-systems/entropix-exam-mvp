import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "../src/client.js";
import { withTenant } from "../src/tenant.js";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = createPrismaClient(connectionString, {
  sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
});

try {
  const northstar = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "northstar-college" },
  });
  const cedar = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "cedar-school" },
  });
  const northstarCounts = await withTenant(
    prisma,
    northstar.id,
    async (tx) => ({
      campuses: await tx.campus.count(),
      departments: await tx.department.count(),
      programs: await tx.program.count(),
      academicYears: await tx.academicYear.count(),
      terms: await tx.term.count(),
      cohorts: await tx.cohort.count(),
      subjects: await tx.subject.count(),
    }),
  );
  const cedarState = await withTenant(prisma, cedar.id, async (tx) => ({
    counts: {
      campuses: await tx.campus.count(),
      departments: await tx.department.count(),
      programs: await tx.program.count(),
      academicYears: await tx.academicYear.count(),
      terms: await tx.term.count(),
      cohorts: await tx.cohort.count(),
      subjects: await tx.subject.count(),
    },
    campusId: (await tx.campus.findFirstOrThrow()).id,
    subjectId: (await tx.subject.findFirstOrThrow()).id,
  }));
  if (
    northstarCounts.campuses !== 1 ||
    northstarCounts.departments !== 3 ||
    northstarCounts.programs !== 1 ||
    northstarCounts.academicYears !== 1 ||
    northstarCounts.terms !== 1 ||
    northstarCounts.cohorts !== 1 ||
    northstarCounts.subjects !== 3
  )
    throw new Error(
      `Northstar fixture counts are invalid: ${JSON.stringify(northstarCounts)}`,
    );
  if (
    cedarState.counts.campuses !== 1 ||
    cedarState.counts.departments !== 1 ||
    cedarState.counts.programs !== 1 ||
    cedarState.counts.academicYears !== 1 ||
    cedarState.counts.terms !== 1 ||
    cedarState.counts.cohorts !== 1 ||
    cedarState.counts.subjects !== 3
  )
    throw new Error(
      `Cedar fixture counts are invalid: ${JSON.stringify(cedarState.counts)}`,
    );
  const unscopedSubjects = await prisma.subject.count();
  if (unscopedSubjects !== 0)
    throw new Error(
      `Missing tenant context exposed ${unscopedSubjects} subjects`,
    );
  const foreignRead = await withTenant(prisma, northstar.id, (tx) =>
    tx.subject.findFirst({ where: { id: cedarState.subjectId } }),
  );
  if (foreignRead) throw new Error("Northstar scope exposed a Cedar subject");

  let foreignParentRejected = false;
  try {
    await withTenant(prisma, northstar.id, async (tx) => {
      await tx.department.create({
        data: {
          id: randomUUID(),
          tenantId: northstar.id,
          campusId: cedarState.campusId,
          code: "ILLEGAL",
          name: "Cross tenant write must roll back",
        },
      });
      throw new Error("CROSS_TENANT_WRITE_SUCCEEDED");
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CROSS_TENANT_WRITE_SUCCEEDED"
    )
      throw error;
    foreignParentRejected = true;
  }
  if (!foreignParentRejected)
    throw new Error("Cross-tenant parent was accepted");

  console.log(`Northstar academic counts: ${JSON.stringify(northstarCounts)}`);
  console.log(`Cedar academic counts: ${JSON.stringify(cedarState.counts)}`);
  console.log("Academic tenant isolation: READY");
} finally {
  await prisma.$disconnect();
}
