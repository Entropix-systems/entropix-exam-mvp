import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { StudentPortalController } from './student-portal.controller.js';
import { StudentPortalRepository } from './student-portal.repository.js';
import { StudentPortalService } from './student-portal.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required documents configuration: ${name}`);
  return value;
}

@Injectable()
class DocumentsDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [StudentPortalController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => createPrismaClient(required('DATABASE_URL'), {
        sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
      }),
    },
    DocumentsDatabaseLifecycle,
    StudentPortalRepository,
    StudentPortalService,
    AuthenticationGuard,
  ],
})
export class DocumentsModule {}
