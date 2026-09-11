import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import { createPrismaClient } from '../src/client.js';

dotenv.config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = createPrismaClient(connectionString);

try {
  const count = await prisma.tenant.count();

  console.log('Runtime Prisma connection: READY');
  console.log(`Tenant count: ${count}`);
} finally {
  await prisma.$disconnect();
}
