import { useAuth } from '../auth/auth-context'
import { WorkspaceShell } from './workspace-shell'

export function HomePage() {
  const { currentUser, logout } = useAuth()
  if (!currentUser) return null
  return (
    <WorkspaceShell currentUser={currentUser} active="overview" onLogout={logout}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Examination control</p>
          <h1>Identity ready</h1>
          <p>Your verified server context is active for this workspace.</p>
        </div>
      </div>
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
    </WorkspaceShell>
  )
}
