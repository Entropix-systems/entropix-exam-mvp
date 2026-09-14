import { describe, expect, it } from 'vitest'
import type { CurrentUserResponse, TenantRole } from '@entropix/contracts'
import { canAccessWorkspacePath, destinationAfterContextChange, landingDestination } from './route-policy'

function tenantUser(activeRole: TenantRole, grants: readonly TenantRole[] = [activeRole]): CurrentUserResponse {
  return {
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'user@example.test',
    institutions: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Northstar College', slug: 'northstar-college' }],
    context: {
      kind: 'TENANT',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      activeRole,
      grants: grants.map((role) => ({ role, departmentId: null })),
    },
  }
}

const platformUser: CurrentUserResponse = {
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'platform.admin@demo.example.test',
  institutions: [],
  context: {
    kind: 'PLATFORM',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'PLATFORM_ADMIN',
  },
}

describe('role-aware landing policy', () => {
  it.each([
    ['INSTITUTION_ADMIN', '/masters'],
    ['EXAM_CONTROLLER', '/results'],
    ['DEPARTMENT_ADMIN', '/marks'],
    ['FACULTY', '/marks'],
    ['INVIGILATOR', '/attendance'],
    ['AUDITOR', '/'],
    ['STUDENT', '/student'],
  ] as const)('lands %s on an authorized route', (role, expected) => {
    const user = tenantUser(role)
    expect(landingDestination(user)).toBe(expected)
    expect(canAccessWorkspacePath(user, expected)).toBe(true)
  })

  it('lands a platform-only identity on the explicit platform route', () => {
    expect(landingDestination(platformUser)).toBe('/platform')
    expect(canAccessWorkspacePath(platformUser, '/platform')).toBe(true)
    expect(canAccessWorkspacePath(platformUser, '/')).toBe(false)
  })

  it('takes a selected Platform Admin directly to the institution overview and keeps platform return available', () => {
    const selected: CurrentUserResponse = {
      ...platformUser,
      institutions: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Northstar College', slug: 'northstar-college' }],
      context: { ...platformUser.context, tenantId: '11111111-1111-4111-8111-111111111111' },
    }
    expect(canAccessWorkspacePath(selected, '/')).toBe(true)
    expect(destinationAfterContextChange('/platform', selected)).toBe('/')
    expect(canAccessWorkspacePath(selected, '/masters')).toBe(false)
  })

  it('routes Faculty to Invigilator from marks into attendance', () => {
    const invigilator = tenantUser('INVIGILATOR', ['FACULTY', 'INVIGILATOR'])
    expect(destinationAfterContextChange('/marks', invigilator)).toBe('/attendance')
  })

  it('retains an auditor-authorized route and otherwise uses the auditor landing', () => {
    const auditor = tenantUser('AUDITOR', ['EXAM_CONTROLLER', 'AUDITOR'])
    expect(destinationAfterContextChange('/reports', auditor)).toBe('/reports')
    expect(destinationAfterContextChange('/results', auditor)).toBe('/')
  })

  it('never treats another available grant as the active role', () => {
    const faculty = tenantUser('FACULTY', ['FACULTY', 'INVIGILATOR'])
    expect(canAccessWorkspacePath(faculty, '/marks')).toBe(true)
    expect(canAccessWorkspacePath(faculty, '/attendance')).toBe(false)
  })
})
