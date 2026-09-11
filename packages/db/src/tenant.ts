import type {
  Prisma,
  PrismaClient,
} from './generated/prisma/client.js';

export type TenantTransaction = Prisma.TransactionClient;

export async function withTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  operation: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ set_config: string }>>`
      SELECT set_config(
        'app.tenant_id',
        ${tenantId},
        true
      )
    `;

    return operation(tx);
  });
}
