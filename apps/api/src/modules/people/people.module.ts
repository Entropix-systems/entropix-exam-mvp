import { createPrismaClient, PrismaClient } from '@entropix/db';
import { Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthenticationGuard } from '../identity/authorization/guards.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PeopleController } from './people.controller.js';
import { PeopleRepository } from './people.repository.js';
import { PeopleService } from './people.service.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required people configuration: ${name}`);
  return value;
}

@Injectable()
class PeopleDatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}
  async onModuleDestroy(): Promise<void> { await this.prisma.$disconnect(); }
}

@Module({
  imports: [IdentityModule],
  controllers: [PeopleController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => createPrismaClient(required('DATABASE_URL'), {
        sslCaPath: process.env.DATABASE_SSL_CA_PATH || undefined,
      }),
    },
    PeopleDatabaseLifecycle,
    PeopleRepository,
    PeopleService,
    AuthenticationGuard,
  ],
})
export class PeopleModule {}
