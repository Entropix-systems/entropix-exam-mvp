import { useAuth } from '../auth/auth-context'
import { roleLabel } from '../identity/identity-access'
import { WorkspaceShell } from './workspace-shell'

export function HomePage() {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  if (!currentUser) return null
  const tenant = currentUser.context.kind === 'TENANT' ? currentUser.context : null
  const institutionName = tenant
    ? currentUser.institutions.find(
        (institution) => institution.id === tenant.tenantId,
      )?.name ?? 'Institution unavailable'
    : null
  return (
    <WorkspaceShell
      currentUser={currentUser}
      active="overview"
      onLogout={logout}
      onSwitchInstitution={switchInstitution}
      onSwitchRole={switchRole}
    >
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
          <div><dt>Signed in as</dt><dd>{currentUser.email}</dd></div>
          <div><dt>Context</dt><dd>{tenant ? 'Institution' : 'Platform'}</dd></div>
          {tenant ? (
            <>
              <div>
                <dt>Institution</dt>
                <dd>{institutionName}</dd>
              </div>
              <div><dt>Active role</dt><dd>{roleLabel(tenant.activeRole)}</dd></div>
            </>
          ) : null}
        </dl>
        <p className="field-help">Navigation reflects the current context for convenience. The API remains authoritative.</p>
      </section>
    </WorkspaceShell>
  )
}
