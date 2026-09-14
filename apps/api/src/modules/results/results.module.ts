import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ResultsController } from './results.controller.js';
import { ResultsRepository } from './results.repository.js';
import { ResultsService } from './results.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required results configuration: ' + name);
  return value;
}

@Injectable()
class ResultsDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [ResultsController],
  providers: [
    { provide: PrismaClient, useFactory: () => createPrismaClient(required('DATABASE_URL'), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined }) },
    ResultsDatabaseLifecycle,
    ResultsRepository,
    ResultsService,
    AuthenticationGuard,
  ],
})
export class ResultsModule {}
