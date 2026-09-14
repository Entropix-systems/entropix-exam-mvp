import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { PlatformController } from './platform.controller.js';
import { PlatformRepository } from './platform.repository.js';
import { PlatformService } from './platform.service.js';

function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`Missing required platform configuration: ${name}`); return value; }
@Injectable()
class PlatformDatabaseLifecycle implements OnModuleDestroy { constructor(private readonly prisma: PrismaClient) {} async onModuleDestroy() { await this.prisma.$disconnect(); } }
@Module({ imports: [IdentityModule], controllers: [PlatformController], providers: [
  { provide: PrismaClient, useFactory: () => createPrismaClient(required('DATABASE_URL'), { sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined }) },
  PlatformDatabaseLifecycle, PlatformRepository, PlatformService, AuthenticationGuard,
] })
export class PlatformModule {}
