import type { AuthenticatedContext } from '@entropix/contracts';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AcademicPersistenceError,
  AcademicsRepository,
} from './academics.repository.js';
import { AcademicsService } from './academics.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const recordId = '44444444-4444-4444-8444-444444444444';
const foreignId = '55555555-5555-4555-8555-555555555555';

const adminContext: AuthenticatedContext = {
  kind: 'TENANT',
  tenantId,
  membershipId,
  userId,
  activeRole: 'INSTITUTION_ADMIN',
  grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }],
};

function setup() {
  const repository = {
    snapshot: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return {
    repository,
    service: new AcademicsService(repository as unknown as AcademicsRepository),
  };
}

describe('AcademicsService', () => {
  it('derives list scope from the authenticated tenant', async () => {
    const { service, repository } = setup();
    repository.snapshot.mockResolvedValue({ tenant: { id: tenantId } });

    await service.list(adminContext);

    expect(repository.snapshot).toHaveBeenCalledWith(tenantId);
  });

  it('does not reveal a foreign-tenant record by UUID', async () => {
    const { service, repository } = setup();
    repository.get.mockResolvedValue(null);

    await expect(
      service.get(adminContext, 'subjects', foreignId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.get).toHaveBeenCalledWith(
      tenantId,
      'subjects',
      foreignId,
    );
  });

  it('rejects invalid academic-year date order before persistence', async () => {
    const { service, repository } = setup();

    await expect(
      service.create(adminContext, 'academic-years', {
        code: 'AY2026',
        name: '2026-27',
        startsOn: '2027-05-31',
        endsOn: '2026-06-01',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('normalizes a write and persists it in the authenticated tenant', async () => {
    const { service, repository } = setup();
    repository.create.mockResolvedValue({
      id: recordId,
      tenantId,
      code: 'MAIN',
      name: 'Main Campus',
    });

    await service.create(adminContext, 'campuses', {
      code: ' main ',
      name: ' Main Campus ',
      tenantId: foreignId,
    });

    expect(repository.create).toHaveBeenCalledWith(tenantId, 'campuses', {
      code: 'MAIN',
      name: 'Main Campus',
    });
  });

  it('returns a validation error for a cross-tenant parent reference', async () => {
    const { service, repository } = setup();
    repository.create.mockRejectedValue(
      new AcademicPersistenceError('INVALID_PARENT'),
    );

    await expect(
      service.create(adminContext, 'departments', {
        code: 'CSE',
        name: 'Computer Science',
        campusId: foreignId,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows only institution administrators to mutate masters', async () => {
    const { service } = setup();
    const studentContext: AuthenticatedContext = {
      ...adminContext,
      activeRole: 'STUDENT',
      grants: [{ role: 'STUDENT', departmentId: null }],
    };

    await expect(
      service.update(studentContext, 'campuses', recordId, {
        code: 'MAIN',
        name: 'Main Campus',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
