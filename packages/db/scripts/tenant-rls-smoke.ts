import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import {
  createPrismaClient,
  withTenant,
} from '../src/index.js';

dotenv.config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = createPrismaClient(connectionString);

const TENANT_A_ID =
  '11111111-1111-4111-8111-111111111111';

const TENANT_B_ID =
  '22222222-2222-4222-8222-222222222222';

const USER_A_ID =
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const USER_B_ID =
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function main() {
  /*
   * Tenant/User are global records.
   */

  const tenantA = await prisma.tenant.upsert({
    where: {
      slug: 'northstar-college',
    },
    update: {
      name: 'Northstar College',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    },
    create: {
      id: TENANT_A_ID,
      name: 'Northstar College',
      slug: 'northstar-college',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      plan: 'MVP',
    },
  });

  const tenantB = await prisma.tenant.upsert({
    where: {
      slug: 'cedar-school',
    },
    update: {
      name: 'Cedar School',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    },
    create: {
      id: TENANT_B_ID,
      name: 'Cedar School',
      slug: 'cedar-school',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      plan: 'MVP',
    },
  });

  const userA = await prisma.user.upsert({
    where: {
      email: 'student.a@example.test',
    },
    update: {
      status: 'ACTIVE',
    },
    create: {
      id: USER_A_ID,
      email: 'student.a@example.test',
      status: 'ACTIVE',
    },
  });

  const userB = await prisma.user.upsert({
    where: {
      email: 'student.b@example.test',
    },
    update: {
      status: 'ACTIVE',
    },
    create: {
      id: USER_B_ID,
      email: 'student.b@example.test',
      status: 'ACTIVE',
    },
  });

  /*
   * Tenant A membership.
   */

  const membershipA = await withTenant(
    prisma,
    tenantA.id,
    (tx) =>
      tx.membership.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenantA.id,
            userId: userA.id,
          },
        },
        update: {
          status: 'ACTIVE',
        },
        create: {
          tenantId: tenantA.id,
          userId: userA.id,
          status: 'ACTIVE',
        },
      }),
  );

  /*
   * Tenant B membership.
   */

  const membershipB = await withTenant(
    prisma,
    tenantB.id,
    (tx) =>
      tx.membership.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenantB.id,
            userId: userB.id,
          },
        },
        update: {
          status: 'ACTIVE',
        },
        create: {
          tenantId: tenantB.id,
          userId: userB.id,
          status: 'ACTIVE',
        },
      }),
  );

  /*
   * Tenant roles.
   */

  await withTenant(
    prisma,
    tenantA.id,
    (tx) =>
      tx.roleGrant.upsert({
        where: {
          tenantId_membershipId_role: {
            tenantId: tenantA.id,
            membershipId: membershipA.id,
            role: 'STUDENT',
          },
        },
        update: {},
        create: {
          tenantId: tenantA.id,
          membershipId: membershipA.id,
          role: 'STUDENT',
        },
      }),
  );

  await withTenant(
    prisma,
    tenantB.id,
    (tx) =>
      tx.roleGrant.upsert({
        where: {
          tenantId_membershipId_role: {
            tenantId: tenantB.id,
            membershipId: membershipB.id,
            role: 'STUDENT',
          },
        },
        update: {},
        create: {
          tenantId: tenantB.id,
          membershipId: membershipB.id,
          role: 'STUDENT',
        },
      }),
  );

  /*
   * 1. Missing tenant context must reveal nothing.
   */

  const unscoped =
    await prisma.membership.findMany();

  assert.equal(
    unscoped.length,
    0,
    'Unscoped runtime query exposed tenant records',
  );

  /*
   * 2. Tenant A sees only A.
   */

  const tenantARows =
    await withTenant(
      prisma,
      tenantA.id,
      (tx) => tx.membership.findMany(),
    );

  assert.equal(tenantARows.length, 1);

  for (const row of tenantARows) {
    assert.equal(row.tenantId, tenantA.id);
  }

  /*
   * 3. Tenant B sees only B.
   */

  const tenantBRows =
    await withTenant(
      prisma,
      tenantB.id,
      (tx) => tx.membership.findMany(),
    );

  assert.equal(tenantBRows.length, 1);

  for (const row of tenantBRows) {
    assert.equal(row.tenantId, tenantB.id);
  }

  /*
   * 4. Knowing Tenant B's UUID must not bypass RLS.
   */

  const foreignRecord =
    await withTenant(
      prisma,
      tenantA.id,
      (tx) =>
        tx.membership.findUnique({
          where: {
            id: membershipB.id,
          },
        }),
    );

  assert.equal(
    foreignRecord,
    null,
    'Tenant A read Tenant B through a known UUID',
  );

  /*
   * 5. Composite tenant FK must reject mismatched references.
   */

  let compositeFkDenied = false;

  try {
    await withTenant(
      prisma,
      tenantA.id,
      (tx) =>
        tx.roleGrant.create({
          data: {
            tenantId: tenantA.id,
            membershipId: membershipB.id,
            role: 'CROSS_TENANT_SHOULD_FAIL',
          },
        }),
    );
  } catch {
    compositeFkDenied = true;
  }

  assert.equal(
    compositeFkDenied,
    true,
    'Cross-tenant relationship was not rejected',
  );

  /*
   * 6. Exercise connection-pool reuse concurrently.
   */

  await Promise.all(
    Array.from(
      { length: 20 },
      async (_, index) => {
        const tenantId =
          index % 2 === 0
            ? tenantA.id
            : tenantB.id;

        const rows =
          await withTenant(
            prisma,
            tenantId,
            (tx) =>
              tx.membership.findMany(),
          );

        assert.equal(rows.length, 1);

        for (const row of rows) {
          assert.equal(
            row.tenantId,
            tenantId,
            `Tenant context leakage at iteration ${index}`,
          );
        }
      },
    ),
  );

  /*
   * 7. Context must disappear after those transactions.
   */

  const afterTransactions =
    await prisma.membership.findMany();

  assert.equal(
    afterTransactions.length,
    0,
    'Tenant context leaked into unscoped runtime client',
  );

  console.log('Tenant RLS smoke: PASS');
  console.log('  Missing tenant context: DENIED');
  console.log('  Tenant A isolation: PASS');
  console.log('  Tenant B isolation: PASS');
  console.log('  Known foreign ID: DENIED');
  console.log('  Cross-tenant composite FK: DENIED');
  console.log('  Concurrent pool reuse: PASS');
  console.log('  Post-transaction context leakage: NONE');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
