import type { AuthenticatedContext } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import { IdentityAdminController } from './identity-admin.controller.js';

const context: AuthenticatedContext = {
  kind: 'TENANT',
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: '11111111-1111-4111-8111-111111111111',
  membershipId: '22222222-2222-4222-8222-222222222222',
  activeRole: 'INSTITUTION_ADMIN',
  grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }],
};

describe('IdentityAdminController', () => {
  it('forwards the required invitation name from the HTTP contract', async () => {
    const invite = vi.fn().mockResolvedValue({ accepted: true });
    const controller = new IdentityAdminController({ invite } as never);
    const grants = [{ role: 'FACULTY', departmentId: null }];

    await controller.invite(context, {
      name: 'Faculty Member',
      email: 'faculty@example.test',
      grants,
    });

    expect(invite).toHaveBeenCalledWith(context, {
      name: 'Faculty Member',
      email: 'faculty@example.test',
      grants,
    });
  });
});
