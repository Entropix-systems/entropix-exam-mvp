import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { AuthContext } from '../auth/auth-context'
import { PlatformPage } from './platform-page'

const currentUser: CurrentUserResponse = {
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'platform.admin@demo.example.test',
  institutions: [],
  context: {
    kind: 'PLATFORM',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'PLATFORM_ADMIN',
  },
}

describe('PlatformPage', () => {
  it('renders a truthful platform-scoped landing without institution overview state', () => {
    const html = renderToStaticMarkup(
      <AuthContext.Provider value={{
        status: 'AUTHENTICATED',
        currentUser,
        login: vi.fn(),
        switchInstitution: vi.fn(),
        returnToPlatform: vi.fn(),
        switchRole: vi.fn(),
        logout: vi.fn(),
        restore: vi.fn(),
      }}>
        <PlatformPage client={{ institutions: vi.fn(), onboard: vi.fn(), setStatus: vi.fn() } as never} />
      </AuthContext.Provider>,
    )

    expect(html).toContain('Institution management')
    expect(html).toContain('platform.admin@demo.example.test')
    expect(html).toContain('Create a new institution')
    expect(html).not.toContain('Overview unavailable')
    expect(html).not.toContain(currentUser.sessionId)
    expect(html).not.toContain(currentUser.context.userId)
  })
})
