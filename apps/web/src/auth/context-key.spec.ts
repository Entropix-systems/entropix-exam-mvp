import { describe, expect, it } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { authContextKey } from './context-key'

function user(tenantId: string, membershipId: string, activeRole: 'INSTITUTION_ADMIN' | 'AUDITOR'): CurrentUserResponse {
  return {
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'admin@example.test', institutions: [],
    context: { kind: 'TENANT', userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenantId, membershipId, activeRole,
      grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }, { role: 'AUDITOR', departmentId: null }] },
  }
}
const platform: CurrentUserResponse = { sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'platform.admin@example.test', institutions: [], context: { kind: 'PLATFORM', userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'PLATFORM_ADMIN' } }

describe('authContextKey', () => {
  it('changes for institution and role switches so scoped screens remount', () => {
    const initial = user('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'INSTITUTION_ADMIN')
    const institution = user('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 'INSTITUTION_ADMIN')
    const role = user('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'AUDITOR')
    expect(authContextKey(institution)).not.toBe(authContextKey(initial))
    expect(authContextKey(role)).not.toBe(authContextKey(initial))
  })

  it('changes for every selected platform institution so old scoped requests unmount before rendering', () => {
    expect(authContextKey(platform)).toBe('platform:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:none')
    expect(authContextKey({ ...platform, context: { ...platform.context, tenantId: '11111111-1111-4111-8111-111111111111' } })).not.toBe(authContextKey({ ...platform, context: { ...platform.context, tenantId: '33333333-3333-4333-8333-333333333333' } }))
  })
})
