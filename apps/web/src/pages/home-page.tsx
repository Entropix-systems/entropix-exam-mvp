import { useAuth } from '../auth/auth-context'

export function HomePage() {
  const { currentUser, logout } = useAuth()
  if (!currentUser) return null
  return (
    <main className="home-shell">
      <header><div><p className="eyebrow">Examination ERP</p><h1>Identity ready</h1></div><button type="button" className="secondary-button" onClick={() => void logout()}>Sign out</button></header>
      <section className="context-card">
        <h2>Current access context</h2>
        <dl>
          <div><dt>User</dt><dd>{currentUser.context.userId}</dd></div>
          <div><dt>Context</dt><dd>{currentUser.context.kind}</dd></div>
          {currentUser.context.kind === 'TENANT' ? <div><dt>Tenant</dt><dd>{currentUser.context.tenantId}</dd></div> : null}
          <div><dt>Session</dt><dd>{currentUser.sessionId}</dd></div>
        </dl>
        <p className="field-help">Navigation reflects the current context for convenience. The API remains authoritative.</p>
      </section>
    </main>
  )
}
