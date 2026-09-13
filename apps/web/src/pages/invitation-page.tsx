import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthApiClient } from '../auth/auth-client'
import { invitationErrorMessage } from '../auth/invitation-errors'
import { navigate } from '../auth/navigation'
import { useOneTimeToken } from '../auth/use-one-time-token'
import { AuthLayout, FormError } from './auth-layout'

export function InvitationPage({ client }: { client: AuthApiClient }) {
  const token = useOneTimeToken()
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : 'This invitation link is not valid.')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    setBusy(true)
    setError(null)
    try {
      await client.acceptInvitation({ token, password: password || undefined })
      setComplete(true)
    } catch (reason) {
      setError(invitationErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthLayout title="Accept invitation" intro="Confirm this one-time invitation to activate your institution membership.">
      {complete ? (
        <div className="auth-form"><p className="form-message success">Invitation accepted.</p><button type="button" className="primary-button" onClick={() => navigate('/login')}>Continue to sign in</button></div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>Password for a new account <input name="password" type="password" minLength={12} maxLength={1024} autoComplete="new-password" disabled={!token} /></label>
          <p className="field-help">Already have an account? Leave this blank. You may be asked to sign in before acceptance.</p>
          <FormError message={error} />
          <button className="primary-button" disabled={!token || busy}>{busy ? 'Accepting…' : 'Accept invitation'}</button>
        </form>
      )}
    </AuthLayout>
  )
}
