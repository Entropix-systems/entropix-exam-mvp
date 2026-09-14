import { describe, expect, it, vi } from 'vitest'
import { IdentityApiClient } from './identity-client'

describe('IdentityApiClient', () => {
  it('loads the tenant membership directory', async () => {
    const request = vi.fn().mockResolvedValue({
      institutionName: 'Northstar College',
      memberships: { items: [], nextCursor: 'next-membership' },
      departments: [],
      pageSize: 10,
    })
    const client = new IdentityApiClient({ request })

    await expect(client.listMemberships({ cursor: 'cursor-1', pageSize: 10 })).resolves.toMatchObject({
      institutionName: 'Northstar College',
      nextCursor: 'next-membership',
      pageSize: 10,
    })
    expect(request).toHaveBeenCalledWith('/identity/memberships?cursor=cursor-1&pageSize=10')
  })

  it('submits invitations and role grants without platform authority', async () => {
    const request = vi.fn().mockResolvedValue({})
    const client = new IdentityApiClient({ request })
    const grants = [
      { role: 'FACULTY' as const, departmentId: 'department-1' },
    ]

    await client.createInvitation({ email: 'faculty@example.test', name: 'Faculty Member', grants })
    await client.replaceRoleGrants('membership/1', {
      expectedVersion: 3,
      grants,
    })

    expect(request).toHaveBeenNthCalledWith(1, '/identity/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: 'faculty@example.test', grants }),
    })
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/identity/memberships/membership%2F1/role-grants',
      {
        method: 'PUT',
        body: JSON.stringify({ expectedVersion: 3, grants }),
      },
    )
  })

  it('calls activate and deactivate with optimistic versions', async () => {
    const request = vi.fn().mockResolvedValue({})
    const client = new IdentityApiClient({ request })

    await client.deactivate('membership-1', 4)
    await client.activate('membership-1', 5)

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/identity/memberships/membership-1/deactivate',
      { method: 'POST', body: JSON.stringify({ expectedVersion: 4 }) },
    )
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/identity/memberships/membership-1/activate',
      { method: 'POST', body: JSON.stringify({ expectedVersion: 5 }) },
    )
  })
})
