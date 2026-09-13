import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ConductController } from './conduct.controller.js';
import { ConductRepository } from './conduct.repository.js';
import { ConductService } from './conduct.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required conduct configuration: ${name}`);
  return value;
}

@Injectable()
class ConductDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [ConductController],
  providers: [
    { provide: PrismaClient, useFactory: () => createPrismaClient(required('DATABASE_URL'), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined }) },
    ConductDatabaseLifecycle, ConductRepository, ConductService, AuthenticationGuard,
  ],
  exports: [ConductRepository],
})
export class ConductModule {}
