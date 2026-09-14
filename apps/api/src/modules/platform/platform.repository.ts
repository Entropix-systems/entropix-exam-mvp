import { PrismaClient } from '@entropix/db';
import type { OnboardInstitutionRequest, PlatformInstitutionSummary, UUID } from '@entropix/contracts';
import { Injectable } from '@nestjs/common';

const active = 'ACTIVE';

function slugFor(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function academicDates(value: string): { startsOn: Date; endsOn: Date } {
  const year = /^([0-9]{4})/.exec(value)?.[1];
  const start = Number(year ?? new Date().getUTCFullYear());
  return { startsOn: new Date(Date.UTC(start, 0, 1)), endsOn: new Date(Date.UTC(start + 1, 2, 31)) };
}

async function selectTenant(tx: { $queryRaw: PrismaClient['$queryRaw'] }, tenantId: string): Promise<void> {
  await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
}

function summary(tenant: {
  id: string; name: string; slug: string; code: string; type: string; status: string; onboardingState: string;
  academicYears: readonly { name: string }[];
}): PlatformInstitutionSummary {
  return {
    id: tenant.id, name: tenant.name, slug: tenant.slug, code: tenant.code,
    type: tenant.type, status: tenant.status, onboardingState: tenant.onboardingState,
    academicYear: tenant.academicYears[0]?.name ?? null,
  };
}

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listInstitutions(): Promise<readonly PlatformInstitutionSummary[]> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, code: true, type: true, status: true, onboardingState: true,
        academicYears: { select: { name: true }, orderBy: { startsOn: 'desc' }, take: 1 } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return tenants.map(summary);
  }

  async onboard(actorUserId: UUID, input: OnboardInstitutionRequest): Promise<PlatformInstitutionSummary> {
    const existing = await this.prisma.platformAuditEvent.findUnique({ where: { requestId: input.requestId }, select: { tenantId: true } });
    if (existing?.tenantId) {
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: existing.tenantId },
        select: { id: true, name: true, slug: true, code: true, type: true, status: true, onboardingState: true,
          academicYears: { select: { name: true }, orderBy: { startsOn: 'desc' }, take: 1 } },
      });
      return summary(tenant);
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.tenant.findFirst({ where: { code: input.code }, select: { id: true } });
      if (duplicate) return null;
      const tenant = await tx.tenant.create({ data: {
        name: input.name, code: input.code, slug: slugFor(input.code), type: input.type,
        primaryAdministratorName: input.primaryAdministratorName,
        primaryAdministratorEmail: input.primaryAdministratorEmail,
        status: input.status, onboardingState: 'COMPLETE', timezone: 'Asia/Kolkata', plan: 'MVP',
      } });
      await selectTenant(tx, tenant.id);
      const user = await tx.user.upsert({
        where: { email: input.primaryAdministratorEmail },
        update: {}, create: { email: input.primaryAdministratorEmail, status: active },
      });
      const membership = await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, status: 'INVITED' } });
      await tx.roleGrant.create({ data: { tenantId: tenant.id, membershipId: membership.id, role: 'INSTITUTION_ADMIN', departmentId: null } });
      const dates = academicDates(input.academicYear);
      await tx.academicYear.create({ data: { tenantId: tenant.id, code: input.academicYear, name: input.academicYear, ...dates } });
      await tx.platformAuditEvent.create({ data: {
        actorUserId, tenantId: tenant.id, action: 'INSTITUTION_ONBOARDED', requestId: input.requestId,
        next: { name: input.name, code: input.code, type: input.type, status: input.status, primaryAdministratorEmail: input.primaryAdministratorEmail },
      } });
      return tenant.id;
    });
    if (!created) throw new Error('DUPLICATE_CODE');
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: created }, select: {
      id: true, name: true, slug: true, code: true, type: true, status: true, onboardingState: true,
      academicYears: { select: { name: true }, orderBy: { startsOn: 'desc' }, take: 1 },
    } });
    return summary(tenant);
  }

  async setStatus(actorUserId: UUID, institutionId: UUID, status: 'ACTIVE' | 'SUSPENDED', requestId: string): Promise<PlatformInstitutionSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: institutionId }, select: { id: true, name: true, slug: true, code: true, type: true, status: true, onboardingState: true, academicYears: { select: { name: true }, orderBy: { startsOn: 'desc' }, take: 1 } } });
      if (!tenant) return null;
      if (tenant.status !== status) await tx.tenant.update({ where: { id: tenant.id }, data: { status } });
      await tx.platformAuditEvent.create({ data: {
        actorUserId, tenantId: tenant.id, action: status === 'ACTIVE' ? 'INSTITUTION_ACTIVATED' : 'INSTITUTION_SUSPENDED',
        requestId, previous: { status: tenant.status }, next: { status },
      } });
      return summary({ ...tenant, status });
    });
  }
}
