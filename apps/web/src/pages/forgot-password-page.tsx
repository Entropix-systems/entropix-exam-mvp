import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthApiClient } from '../auth/auth-client'
import { navigate } from '../auth/navigation'
import { AuthLayout } from './auth-layout'

export function ForgotPasswordPage({ client }: { client: AuthApiClient }) {
  const [sent, setSent] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    await client.forgotPassword({ email }).catch(() => undefined)
    setSent(true)
  }
  return (
    <AuthLayout
      title="Reset your password"
      intro="Enter your email. If it matches an eligible account, we’ll send a one-time reset link."
      footer={<button type="button" className="link-button" onClick={() => navigate('/login')}>Back to sign in</button>}
    >
      {sent ? (
        <p className="form-message success" role="status">If an eligible account exists, the reset instructions are on their way.</p>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>Email <input name="email" type="email" autoComplete="email" required /></label>
          <button className="primary-button">Send reset link</button>
        </form>
      )}
    </AuthLayout>
  )
}
