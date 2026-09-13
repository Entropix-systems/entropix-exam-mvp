import { describe, expect, it, vi } from 'vitest'
import { AuthApiClient } from '../auth/auth-client'
import { AcademicsApiClient } from './academics-client'

describe('AcademicsApiClient', () => {
  it('loads the tenant academic snapshot from the v1 academics route', async () => {
    const request = vi.fn().mockResolvedValue({ tenant: { name: 'Northstar College' } })
    const client = new AcademicsApiClient({ request } as unknown as AuthApiClient)

    await expect(client.list()).resolves.toEqual({ tenant: { name: 'Northstar College' } })
    expect(request).toHaveBeenCalledWith('/academics')
  })

  it('sends typed subject creation without a client tenant ID', async () => {
    const request = vi.fn().mockResolvedValue({ id: 'subject-id' })
    const client = new AcademicsApiClient({ request } as unknown as AuthApiClient)

    await client.create('subjects', {
      code: 'CS301',
      name: 'Data Structures',
      programId: 'program-id',
      credits: 3,
    })

    expect(request).toHaveBeenCalledWith('/academics/subjects', {
      method: 'POST',
      body: JSON.stringify({
        code: 'CS301',
        name: 'Data Structures',
        programId: 'program-id',
        credits: 3,
      }),
    })
  })
})
