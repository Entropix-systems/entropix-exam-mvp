import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { LoginPage } from './login-page'

describe('LoginPage', () => {
  it('asks only for credentials and never submits institution selection', () => {
    const html = renderToStaticMarkup(
      <AuthContext.Provider value={{
        status: 'UNAUTHENTICATED',
        currentUser: null,
        login: vi.fn(),
        switchInstitution: vi.fn(),
        switchRole: vi.fn(),
        logout: vi.fn(),
        restore: vi.fn(),
      }}>
        <LoginPage />
      </AuthContext.Provider>,
    )

    expect(html).toContain('name="email"')
    expect(html).toContain('name="password"')
    expect(html).not.toContain('institutionSlug')
    expect(html).not.toContain('Institution (if applicable)')
  })
})
