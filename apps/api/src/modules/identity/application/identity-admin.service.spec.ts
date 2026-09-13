import type { AuthenticatedContext } from '@entropix/contracts';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { IdentityAdminRepository } from '../identity.repository.js';
import { IdentityNotificationSender } from './identity-notifications.js';
import { IdentityAdminService } from './identity-admin.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const cursor = '22222222-2222-4222-8222-222222222222';
const context: AuthenticatedContext = {
  kind: 'TENANT',
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId,
  membershipId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  activeRole: 'INSTITUTION_ADMIN',
  grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }],
};

function setup(result: unknown) {
  const listMemberships = vi.fn().mockResolvedValue(result);
  const repository = { listMemberships } as unknown as IdentityAdminRepository;
  const notifications = { send: vi.fn() } as unknown as IdentityNotificationSender;
  return {
    listMemberships,
    service: new IdentityAdminService(
      repository,
      notifications,
      { invitationUrl: 'https://app.example.test/accept-invitation' },
      () => new Date('2026-09-14T00:00:00Z'),
    ),
  };
}

describe('IdentityAdminService membership pagination', () => {
  it('returns cursor metadata and removes internal user IDs from directory items', async () => {
    const { service, listMemberships } = setup({
      institutionName: 'Northstar College',
      departments: [],
      memberships: {
        items: [{
          id: cursor,
          userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          email: 'staff@example.test',
          name: 'Staff Member',
          status: 'ACTIVE',
          version: 1,
          grants: [{ role: 'FACULTY', departmentId: null }],
        }],
        nextCursor: cursor,
      },
    });

    const response = await service.list(context, cursor, '10');

    expect(listMemberships).toHaveBeenCalledWith(tenantId, 10, cursor);
    expect(response).toMatchObject({
      institutionName: 'Northstar College',
      pageSize: 10,
      memberships: { nextCursor: cursor },
    });
    expect(response.memberships.items[0]).not.toHaveProperty('userId');
  });

  it('supports an empty first page and rejects invalid or inaccessible cursors', async () => {
    const empty = setup({
      institutionName: 'Northstar College',
      departments: [],
      memberships: { items: [], nextCursor: null },
    });
    await expect(empty.service.list(context, undefined, undefined)).resolves.toMatchObject({
      pageSize: 25,
      memberships: { items: [], nextCursor: null },
    });

    await expect(
      empty.service.list(context, undefined, '101'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      empty.service.list(context, 'not-a-uuid', '25'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const missing = setup(null);
    await expect(
      missing.service.list(context, cursor, '25'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
