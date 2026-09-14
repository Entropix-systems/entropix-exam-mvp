import { useAuth } from '../auth/auth-context'
import { WorkspaceShell } from './workspace-shell'

export function PlatformPage() {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  if (!currentUser || currentUser.context.kind !== 'PLATFORM') return null

  return (
    <WorkspaceShell currentUser={currentUser} active="platform" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1>Platform workspace</h1>
          <p>Signed in as {currentUser.email}. This context has no institution membership or tenant authority.</p>
        </div>
      </div>
      <div className="overview-grid">
        <section className="overview-card">
          <header>
            <div><p className="eyebrow">Authorized scope</p><h2>Platform context active</h2></div>
            <span className="status-badge active">ACTIVE</span>
          </header>
          <ul className="attention-list">
            <li>Provision or suspend institutions through approved platform operations.</li>
            <li>Manage the first institution administrator for a provisioned institution.</li>
            <li>Review approved platform metadata and usage counts when those APIs are available.</li>
          </ul>
        </section>
        <section className="overview-card">
          <header><div><p className="eyebrow">Tenant boundary</p><h2>No institution selected</h2></div></header>
          <div className="reports-empty">
            <b>Institution data remains isolated</b>
            <p>This landing page uses only your authenticated account context and does not request institution overview data or grant tenant impersonation.</p>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  )
}
