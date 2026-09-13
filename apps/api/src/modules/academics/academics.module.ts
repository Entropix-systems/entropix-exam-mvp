import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AcademicsController } from './academics.controller.js';
import { AcademicsRepository } from './academics.repository.js';
import { AcademicsService } from './academics.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Missing required academic configuration: ${name}`);
  return value;
}

@Injectable()
class AcademicsDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [AcademicsController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () =>
        createPrismaClient(required('DATABASE_URL'), {
          sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
        }),
    },
    AcademicsDatabaseLifecycle,
    AcademicsRepository,
    AcademicsService,
    AuthenticationGuard,
  ],
})
export class AcademicsModule {}
