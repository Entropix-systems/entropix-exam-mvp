import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { SchedulingController } from './scheduling.controller.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required scheduling configuration: ${name}`);
  return value;
}

@Injectable()
class SchedulingDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [SchedulingController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () =>
        createPrismaClient(required('DATABASE_URL'), {
          sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
        }),
    },
    SchedulingDatabaseLifecycle,
    SchedulingRepository,
    SchedulingService,
    AuthenticationGuard,
  ],
  exports: [SchedulingRepository],
})
export class SchedulingModule {}
