import { describe, expect, it, vi } from 'vitest'
import { AuthApiClient } from '../auth/auth-client'
import { PeopleApiClient } from './people-client'

describe('PeopleApiClient', () => {
  it('loads and searches the real student directory route', async () => {
    const request = vi.fn().mockResolvedValue({ students: [], total: 0 })
    const client = new PeopleApiClient({ request } as unknown as AuthApiClient)
    await client.listStudents('NS26001')
    expect(request).toHaveBeenCalledWith('/people/students?search=NS26001')
  })

  it('sends the exact previewed CSV to the atomic commit route', async () => {
    const request = vi.fn().mockResolvedValue({ replayed: false })
    const client = new PeopleApiClient({ request } as unknown as AuthApiClient)
    const input = { fileName: 'students.csv', sourceText: 'roll_no,name,email,cohort_code,subject_codes' }
    await client.commitStudents(input)
    expect(request).toHaveBeenCalledWith('/people/student-imports/commit', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  })
})
