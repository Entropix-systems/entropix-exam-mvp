import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { EvaluationController } from './evaluation.controller.js';
import { EvaluationRepository } from './evaluation.repository.js';
import { EvaluationService } from './evaluation.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required evaluation configuration: ' + name);
  return value;
}

@Injectable()
class EvaluationDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [EvaluationController],
  providers: [
    { provide: PrismaClient, useFactory: () => createPrismaClient(required('DATABASE_URL'), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined }) },
    EvaluationDatabaseLifecycle,
    EvaluationRepository,
    EvaluationService,
    AuthenticationGuard,
  ],
  exports: [EvaluationRepository],
})
export class EvaluationModule {}
