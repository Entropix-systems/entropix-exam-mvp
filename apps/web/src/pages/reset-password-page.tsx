import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthApiClient } from '../auth/auth-client'
import { AuthApiError } from '../auth/auth-client'
import { navigate } from '../auth/navigation'
import { useOneTimeToken } from '../auth/use-one-time-token'
import { AuthLayout, FormError } from './auth-layout'
import { AsyncButton } from '../components/async-button'
import { useAsyncAction } from '../feedback/use-async-action'

export function ResetPasswordPage({ client }: { client: AuthApiClient }) {
  const token = useOneTimeToken()
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is not valid.')
  const { pendingAction, run } = useAsyncAction()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    setError(null)
    const result = await run('reset-password', () => client.resetPassword({ token, password }))
    if (result.ok) {
      setComplete(true)
    } else if (!result.duplicate) {
      setError(result.error instanceof AuthApiError ? result.error.message : 'Password reset failed')
    }
  }
  return (
    <AuthLayout title="Choose a new password" intro="Your reset link works once and expires after a short time.">
      {complete ? (
        <div className="auth-form"><p className="form-message success">Your password has been reset. Existing sessions have been revoked.</p><button type="button" className="primary-button" onClick={() => navigate('/login')}>Continue to sign in</button></div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>New password <input name="password" type="password" minLength={12} maxLength={1024} autoComplete="new-password" disabled={!token} required /></label>
          <FormError message={error} />
          <AsyncButton className="primary-button" disabled={!token} loading={pendingAction === 'reset-password'} loadingText="Resetting…">Reset password</AsyncButton>
        </form>
      )}
    </AuthLayout>
  )
}
