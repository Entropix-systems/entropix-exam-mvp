import type { AuthenticatedContext, OnboardInstitutionRequest, UUID } from '@entropix/contracts';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PlatformRepository } from './platform.repository.js';

function platformActor(context: AuthenticatedContext): UUID {
  if (context.kind !== 'PLATFORM' || context.role !== 'PLATFORM_ADMIN') throw new ForbiddenException('Platform administrator access required');
  return context.userId;
}

function code(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null;
}
function email(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

@Injectable()
export class PlatformService {
  constructor(private readonly repository: PlatformRepository) {}
  list(context: AuthenticatedContext) { platformActor(context); return this.repository.listInstitutions(); }
  async onboard(context: AuthenticatedContext, raw: Partial<OnboardInstitutionRequest>) {
    const actor = platformActor(context);
    const normalizedCode = code(raw.code); const adminEmail = email(raw.primaryAdministratorEmail);
    if (!normalizedCode || !adminEmail || !raw.name?.trim() || !raw.type?.trim() || !raw.primaryAdministratorName?.trim() || !raw.academicYear?.trim() || !raw.requestId || !['ACTIVE', 'SUSPENDED'].includes(raw.status ?? ''))
      throw new UnprocessableEntityException('Institution onboarding details are invalid');
    try {
      return await this.repository.onboard(actor, { ...raw, code: normalizedCode, primaryAdministratorEmail: adminEmail } as OnboardInstitutionRequest);
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_CODE') throw new ConflictException('Institution code already exists');
      throw error;
    }
  }
  async setStatus(context: AuthenticatedContext, institutionId: UUID, rawStatus: unknown, requestId: string) {
    const actor = platformActor(context);
    if (rawStatus !== 'ACTIVE' && rawStatus !== 'SUSPENDED') throw new UnprocessableEntityException('Institution status is invalid');
    const result = await this.repository.setStatus(actor, institutionId, rawStatus, requestId);
    if (!result) throw new NotFoundException('Institution not found');
    return result;
  }
}
