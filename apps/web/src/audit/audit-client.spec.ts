import { describe, expect, it, vi } from 'vitest'
import type { AuthApiClient } from '../auth/auth-client'
import { AuditApiClient } from './audit-client'

describe('AuditApiClient', () => {
  it('uses the focused dashboard, activity, and encoded export routes', async () => {
    const request = vi.fn().mockResolvedValue({})
    const client = new AuditApiClient({ request } as unknown as AuthApiClient)
    await client.dashboard()
    await client.activity()
    await client.export('current-result-register')
    expect(request.mock.calls).toEqual([
      ['/audit/dashboard'],
      ['/audit/activity'],
      ['/audit/exports/current-result-register'],
    ])
  })
})
