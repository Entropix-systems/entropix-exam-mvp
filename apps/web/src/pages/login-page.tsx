import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { navigate } from '../auth/navigation'
import { AuthLayout, FormError } from './auth-layout'

export function LoginPage() {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      await login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      navigate('/', true)
    } catch (reason) {
      setError(reason instanceof AuthApiError ? reason.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      intro="Use the credentials supplied by your examination office. Your institution access is loaded securely after sign-in."
      footer={<button type="button" className="link-button" onClick={() => navigate('/forgot-password')}>Forgot password?</button>}
    >
      <form onSubmit={submit} className="auth-form">
        <label>Email <input name="email" type="email" autoComplete="username" required /></label>
        <label>Password <input name="password" type="password" autoComplete="current-password" required /></label>
        <FormError message={error} />
        <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthLayout>
  )
}
