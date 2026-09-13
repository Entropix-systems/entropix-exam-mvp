import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createPrismaClient } from "../src/client.js";
import { withTenant } from "../src/tenant.js";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

interface AcademicFixture {
  tenant: { name: string; slug: string; timezone: string };
  academicStructure: {
    campus: { code: string; name: string };
    academicYear: { code: string; name: string };
    term: { code: string; name: string };
    cohort: { code: string; name: string };
    departments: { code: string; name: string }[];
    program: { code: string; name: string };
    subjects: { code: string; name: string; credits: number }[];
  };
}

const fixtureUrls = [
  new URL("../../../fixtures/tenants/northstar-college.json", import.meta.url),
  new URL("../../../fixtures/tenants/cedar-school.json", import.meta.url),
];

const calendars: Record<
  string,
  {
    academicYear: { startsOn: Date; endsOn: Date };
    term: { startsOn: Date; endsOn: Date; sequence: number };
  }
> = {
  "northstar-college": {
    academicYear: {
      startsOn: new Date("2026-06-01T00:00:00.000Z"),
      endsOn: new Date("2027-05-31T00:00:00.000Z"),
    },
    term: {
      startsOn: new Date("2026-07-01T00:00:00.000Z"),
      endsOn: new Date("2026-12-31T00:00:00.000Z"),
      sequence: 3,
    },
  },
  "cedar-school": {
    academicYear: {
      startsOn: new Date("2026-06-01T00:00:00.000Z"),
      endsOn: new Date("2027-05-31T00:00:00.000Z"),
    },
    term: {
      startsOn: new Date("2026-06-01T00:00:00.000Z"),
      endsOn: new Date("2027-03-31T00:00:00.000Z"),
      sequence: 1,
    },
  },
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = createPrismaClient(connectionString, {
  sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
});

try {
  for (const fixtureUrl of fixtureUrls) {
    const fixture = JSON.parse(
      await readFile(fixtureUrl, "utf8"),
    ) as AcademicFixture;
    const calendar = calendars[fixture.tenant.slug];
    if (!calendar)
      throw new Error(`Academic calendar missing for ${fixture.tenant.slug}`);
    const tenant = await prisma.tenant.upsert({
      where: { slug: fixture.tenant.slug },
      update: { name: fixture.tenant.name, timezone: fixture.tenant.timezone },
      create: {
        name: fixture.tenant.name,
        slug: fixture.tenant.slug,
        timezone: fixture.tenant.timezone,
      },
    });

    await withTenant(prisma, tenant.id, async (tx) => {
      const campus = await tx.campus.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: fixture.academicStructure.campus.code,
          },
        },
        update: { name: fixture.academicStructure.campus.name },
        create: { tenantId: tenant.id, ...fixture.academicStructure.campus },
      });
      const departments = new Map<string, { id: string }>();
      for (const entry of fixture.academicStructure.departments) {
        const department = await tx.department.upsert({
          where: {
            tenantId_campusId_code: {
              tenantId: tenant.id,
              campusId: campus.id,
              code: entry.code,
            },
          },
          update: { name: entry.name },
          create: { tenantId: tenant.id, campusId: campus.id, ...entry },
        });
        departments.set(entry.code, department);
      }
      const departmentCode =
        fixture.tenant.slug === "cedar-school" ? "SCHOOL" : "CSE";
      const department = departments.get(departmentCode);
      if (!department)
        throw new Error(`Program department ${departmentCode} is missing`);
      const program = await tx.program.upsert({
        where: {
          tenantId_departmentId_code: {
            tenantId: tenant.id,
            departmentId: department.id,
            code: fixture.academicStructure.program.code,
          },
        },
        update: { name: fixture.academicStructure.program.name },
        create: {
          tenantId: tenant.id,
          departmentId: department.id,
          ...fixture.academicStructure.program,
        },
      });
      const academicYear = await tx.academicYear.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: fixture.academicStructure.academicYear.code,
          },
        },
        update: {
          name: fixture.academicStructure.academicYear.name,
          ...calendar.academicYear,
        },
        create: {
          tenantId: tenant.id,
          ...fixture.academicStructure.academicYear,
          ...calendar.academicYear,
        },
      });
      const term = await tx.term.upsert({
        where: {
          tenantId_programId_academicYearId_code: {
            tenantId: tenant.id,
            programId: program.id,
            academicYearId: academicYear.id,
            code: fixture.academicStructure.term.code,
          },
        },
        update: { name: fixture.academicStructure.term.name, ...calendar.term },
        create: {
          tenantId: tenant.id,
          programId: program.id,
          academicYearId: academicYear.id,
          ...fixture.academicStructure.term,
          ...calendar.term,
        },
      });
      await tx.cohort.upsert({
        where: {
          tenantId_termId_code: {
            tenantId: tenant.id,
            termId: term.id,
            code: fixture.academicStructure.cohort.code,
          },
        },
        update: { name: fixture.academicStructure.cohort.name },
        create: {
          tenantId: tenant.id,
          termId: term.id,
          ...fixture.academicStructure.cohort,
        },
      });
      for (const subject of fixture.academicStructure.subjects) {
        await tx.subject.upsert({
          where: {
            tenantId_programId_code: {
              tenantId: tenant.id,
              programId: program.id,
              code: subject.code,
            },
          },
          update: { name: subject.name, credits: subject.credits },
          create: { tenantId: tenant.id, programId: program.id, ...subject },
        });
      }
    });
    console.log(`Academic fixture ready: ${fixture.tenant.name}`);
  }
} finally {
  await prisma.$disconnect();
}
