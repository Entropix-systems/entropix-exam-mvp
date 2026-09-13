import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { AuthContext } from '../auth/auth-context'
import { HomePage } from './home-page'

const currentUser: CurrentUserResponse = {
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'admin@northstar.example.test',
  institutions: [{
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Northstar College',
    slug: 'northstar-college',
  }],
  context: {
    kind: 'TENANT',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    activeRole: 'INSTITUTION_ADMIN',
    grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }],
  },
}

describe('HomePage access context', () => {
  it('uses business labels and does not render user, tenant, membership, or session UUIDs', () => {
    const html = renderToStaticMarkup(
      <AuthContext.Provider value={{
        status: 'AUTHENTICATED',
        currentUser,
        login: vi.fn(),
        switchInstitution: vi.fn(),
        switchRole: vi.fn(),
        logout: vi.fn(),
        restore: vi.fn(),
      }}>
        <HomePage />
      </AuthContext.Provider>,
    )

    expect(html).toContain('admin@northstar.example.test')
    expect(html).toContain('Northstar College')
    for (const id of [
      currentUser.sessionId,
      currentUser.context.userId,
      currentUser.context.kind === 'TENANT' ? currentUser.context.membershipId : '',
    ]) expect(html).not.toContain(id)
  })
})
