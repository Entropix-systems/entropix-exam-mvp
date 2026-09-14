import { describe, expect, it, vi } from 'vitest';
import { PlatformService } from './platform.service.js';

const actor = { kind: 'PLATFORM', userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'PLATFORM_ADMIN' } as const;
const tenantId = '11111111-1111-4111-8111-111111111111';
const input = { name: 'Demo Academy', code: 'DEMO_AC', type: 'School', primaryAdministratorName: 'Ada Admin', primaryAdministratorEmail: 'ada@example.test', academicYear: '2026-27', status: 'ACTIVE' as const, requestId: 'platform-onboard-1' };

function setup() {
  const repository = { listInstitutions: vi.fn(), onboard: vi.fn(), setStatus: vi.fn() };
  return { repository, service: new PlatformService(repository as never) };
}

describe('PlatformService', () => {
  it('permits only a real Platform Admin to enumerate institutions', async () => {
    const { service, repository } = setup();
    repository.listInstitutions.mockResolvedValue([]);
    await expect(service.list(actor)).resolves.toEqual([]);
    expect(() => service.list({ kind: 'TENANT', userId: actor.userId, tenantId, membershipId: '22222222-2222-4222-8222-222222222222', activeRole: 'INSTITUTION_ADMIN', grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }] })).toThrow(/Platform administrator access required/);
  });

  it('normalizes onboarding input and rejects duplicate institution codes', async () => {
    const { service, repository } = setup();
    repository.onboard.mockResolvedValue({ id: tenantId, name: input.name });
    await service.onboard(actor, { ...input, code: ' demo_ac ', primaryAdministratorEmail: ' ADA@EXAMPLE.TEST ' });
    expect(repository.onboard).toHaveBeenCalledWith(actor.userId, expect.objectContaining({ code: 'DEMO_AC', primaryAdministratorEmail: 'ada@example.test' }));
    repository.onboard.mockRejectedValue(new Error('DUPLICATE_CODE'));
    await expect(service.onboard(actor, input)).rejects.toMatchObject({ status: 409 });
  });

  it('audits an authorized activation or suspension through the repository', async () => {
    const { service, repository } = setup();
    repository.setStatus.mockResolvedValue({ id: tenantId, status: 'SUSPENDED' });
    await expect(service.setStatus(actor, tenantId, 'SUSPENDED', 'platform-status-1')).resolves.toMatchObject({ status: 'SUSPENDED' });
    expect(repository.setStatus).toHaveBeenCalledWith(actor.userId, tenantId, 'SUSPENDED', 'platform-status-1');
  });
});
