import { describe, expect, it } from 'vitest'
import { TENANT_ROLE_OPTIONS, validateGrants } from './identity-access'

describe('tenant role grant policy', () => {
  it('never offers PLATFORM_ADMIN', () => {
    expect(TENANT_ROLE_OPTIONS.map((option) => option.value)).not.toContain(
      'PLATFORM_ADMIN',
    )
  })

  it('requires department scope for Department Admin only', () => {
    expect(
      validateGrants([{ role: 'DEPARTMENT_ADMIN', departmentId: null }]),
    ).toBe('Department Admin requires a department.')
    expect(validateGrants([{ role: 'FACULTY', departmentId: null }])).toBeNull()
  })
})
