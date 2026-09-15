import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AuditController } from './audit.controller.js';
import { AuditCommandInterceptor } from './audit.interceptor.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required audit configuration: ${name}`);
  return value;
}

@Injectable()
class AuditDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [AuditController],
  providers: [
    { provide: PrismaClient, useFactory: () => createPrismaClient(required('DATABASE_URL'), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined }) },
    AuditDatabaseLifecycle,
    AuditRepository,
    AuditService,
    AuthenticationGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditCommandInterceptor },
  ],
})
export class AuditModule {}
