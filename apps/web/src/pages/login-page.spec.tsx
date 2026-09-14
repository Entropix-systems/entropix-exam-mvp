import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { LoginPage } from './login-page'
import { INITIAL_LOGIN_STATE, loginStateReducer } from './login-state'

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
    expect(html.match(/required=""/g)).toHaveLength(2)
    expect(html).not.toContain('institutionSlug')
    expect(html).not.toContain('Institution (if applicable)')
  })

  it('clears a failed server response when either credential changes', () => {
    const failed = loginStateReducer(INITIAL_LOGIN_STATE, { type: 'FAIL', message: 'Invalid credentials' })
    expect(failed.error).toBe('Invalid credentials')

    const editedEmail = loginStateReducer(failed, { type: 'EDIT' })
    expect(editedEmail.error).toBeNull()

    const failedAgain = loginStateReducer(editedEmail, { type: 'FAIL', message: 'Invalid credentials' })
    expect(failedAgain.error).toBe('Invalid credentials')
    expect(loginStateReducer(failedAgain, { type: 'EDIT' }).error).toBeNull()
  })

  it('starts every submission without a stale server error', () => {
    const failed = { error: 'Invalid credentials', busy: false }
    expect(loginStateReducer(failed, { type: 'SUBMIT' })).toEqual({ error: null, busy: true })
    expect(loginStateReducer({ error: null, busy: true }, { type: 'FINISH' })).toEqual({ error: null, busy: false })
  })
})
