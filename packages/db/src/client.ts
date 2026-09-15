import fs from 'node:fs';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export interface PrismaConnectionOptions {
  sslCaPath?: string;
}

export function createPrismaClient(
  connectionString: string,
  options: PrismaConnectionOptions = {},
) {
  const host = new URL(connectionString).hostname;
  const localTarget = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const ssl =
    options.sslCaPath && !localTarget
      ? {
          ca: fs.readFileSync(
            options.sslCaPath,
            'utf8',
          ),
          rejectUnauthorized: true,
        }
      : undefined;

  const adapter = new PrismaPg({
    connectionString,
    ssl,
  });

  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 50_000,
      timeout: 120_000,
    },
  });
}
