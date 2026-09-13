import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ExamsController } from './exams.controller.js';
import { ExamsRepository } from './exams.repository.js';
import { ExamsService } from './exams.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required exams configuration: ${name}`);
  return value;
}
@Injectable()
class ExamsDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [ExamsController],
  providers: [
    { provide: PrismaClient, useFactory: () => createPrismaClient(required('DATABASE_URL'), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined }) },
    ExamsDatabaseLifecycle, ExamsRepository, ExamsService, AuthenticationGuard,
  ],
})
export class ExamsModule {}
