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
  const ssl =
    options.sslCaPath
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
  });
}
