import { describe, expect, it, vi } from 'vitest'
import type { AuthApiClient } from '../auth/auth-client'
import { StudentPortalApiClient } from './student-portal-client'

describe('student portal API client', () => {
  it('uses only authenticated /me reads and accepts no student identifier', async () => {
    const request = vi.fn().mockResolvedValue(null)
    const client = new StudentPortalApiClient({ request } as unknown as AuthApiClient)

    await client.snapshot()
    await client.registrations()
    await client.timetable()
    await client.result()
    await client.documents()

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/me/student-portal',
      '/me/registrations',
      '/me/timetable',
      '/me/result',
      '/me/documents',
    ])
  })
})
