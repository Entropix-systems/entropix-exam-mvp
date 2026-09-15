import { useReducer } from 'react'
import type { FormEvent } from 'react'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { navigate } from '../auth/navigation'
import { landingDestination } from '../auth/route-policy'
import { AuthLayout, FormError } from './auth-layout'
import { INITIAL_LOGIN_STATE, loginStateReducer } from './login-state'

export function LoginPage() {
  const { login } = useAuth()
  const [state, dispatch] = useReducer(loginStateReducer, INITIAL_LOGIN_STATE)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'SUBMIT' })
    const form = new FormData(event.currentTarget)
    try {
      const currentUser = await login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      navigate(landingDestination(currentUser), true)
    } catch (reason) {
      dispatch({ type: 'FAIL', message: reason instanceof AuthApiError ? reason.message : 'Sign in failed' })
    } finally {
      dispatch({ type: 'FINISH' })
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      intro="Use the credentials supplied by your examination office. Your institution access is loaded securely after sign-in."
      footer={<button type="button" className="link-button" onClick={() => navigate('/forgot-password')}>Forgot password?</button>}
    >
      <form onSubmit={submit} className="auth-form">
        <label>Email <input name="email" type="email" autoComplete="username" required onChange={() => dispatch({ type: 'EDIT' })} /></label>
        <label>Password <input name="password" type="password" autoComplete="current-password" required onChange={() => dispatch({ type: 'EDIT' })} /></label>
        <FormError message={state.error} />
        <button className="primary-button" disabled={state.busy}>{state.busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthLayout>
  )
}
