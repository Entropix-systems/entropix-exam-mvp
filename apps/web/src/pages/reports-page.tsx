import { useEffect, useState } from 'react'
import { AuditApiClient, type AuditActivityRow, type DashboardSnapshot, type ReportKind } from '../audit/audit-client'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { WorkspaceShell } from './workspace-shell'

const catalogue: readonly { kind: ReportKind; name: string; scope: string; access: string }[] = [
  { kind: 'registration-roster', name: 'Registration roster', scope: 'Exam and approved subject set', access: 'Controller / HOD' },
  { kind: 'timetable-hall-roster', name: 'Timetable and hall roster', scope: 'Exam, paper, hall and assigned seats', access: 'Controller / Assigned invigilator' },
  { kind: 'attendance-incidents', name: 'Attendance and incidents', scope: 'Paper, submitted attendance and disposition', access: 'Controller / Scoped staff' },
  { kind: 'evaluation-progress', name: 'Evaluation progress', scope: 'Subject assignment and batch status', access: 'Controller / HOD' },
  { kind: 'current-result-register', name: 'Current result register', scope: 'Active publication only; WITHHELD stays nonnumeric', access: 'Controller / Scoped auditor' },
  { kind: 'audit-activity', name: 'Audit activity', scope: 'Tenant, actor, action, target and request ID', access: 'Controller / Auditor' },
]

const errorMessage = (reason: unknown) => reason instanceof AuthApiError ? `${reason.message}${reason.requestId ? ` · Request ${reason.requestId}` : ''}` : 'Reports could not be loaded.'

function saveExport(file: { fileName: string; contentType: string; csv: string }) {
  const url = URL.createObjectURL(new Blob([file.csv], { type: file.contentType }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = file.fileName; anchor.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage({ client }: { client: AuditApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [events, setEvents] = useState<readonly AuditActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<ReportKind | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const snapshot = await client.dashboard()
        const activity = snapshot.availableReports.includes('audit-activity') ? await client.activity() : []
        if (active) { setDashboard(snapshot); setEvents(activity); setLoading(false) }
      } catch (reason) {
        if (active) { setNotice(errorMessage(reason)); setLoading(false) }
      }
    })()
    return () => { active = false }
  }, [client])

  async function exportReport(kind: ReportKind) {
    setBusy(kind); setNotice(null)
    try {
      const file = await client.export(kind)
      saveExport(file)
      setNotice(`${file.fileName} exported with ${file.rowCount} data row(s).`)
    } catch (reason) { setNotice(errorMessage(reason)) }
    finally { setBusy(null) }
  }

  if (!currentUser) return null
  const allowed = new Set(dashboard?.availableReports ?? [])
  return <WorkspaceShell currentUser={currentUser} active="reports" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">Operational visibility</p><h1>Reports &amp; audit</h1><p>Exports and activity use the current institution and active server-authorized role.</p></div>{allowed.has('audit-activity') ? <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void exportReport('audit-activity')}>Export audit activity</button> : null}</div>
    {notice ? <p className="form-message page-message" role="status">{notice}</p> : null}
    {loading ? <div className="reports-empty"><b>Loading report catalogue…</b><p>Resolving the active role scope.</p></div> : !dashboard ? <div className="reports-error" role="alert"><b>Reports unavailable</b><p>{notice ?? 'Reload this page to try again.'}</p></div> : <>
      <section className="overview-card"><header><div><p className="eyebrow">Download catalogue</p><h2>Current operational reports</h2></div><span className="status-badge active">{dashboard.institutionName}</span></header>
        <div className="reports-table-wrap"><table><thead><tr><th>Report</th><th>Scope</th><th>Access</th><th>Action</th></tr></thead><tbody>{catalogue.map((report) => <tr key={report.kind}><td><b>{report.name}</b></td><td>{report.scope}</td><td>{report.access}</td><td>{allowed.has(report.kind) ? <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void exportReport(report.kind)}>{busy === report.kind ? 'Preparing…' : 'Export CSV'}</button> : <span className="status-badge">NOT IN ACTIVE SCOPE</span>}</td></tr>)}</tbody></table></div>
      </section>
      {allowed.has('audit-activity') ? <section className="overview-card"><header><div><p className="eyebrow">Real command events</p><h2>Recent audit activity</h2></div><span className="status-badge">LATEST 100</span></header>
        {events.length === 0 ? <div className="reports-empty"><b>No command events recorded yet</b><p>Historical state is not inferred. Successful API commands performed after the B05 audit migration appear here.</p></div> : <div className="reports-table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target / reason</th><th>Request ID</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.occurredAt).toLocaleString()}</td><td><b>{event.actor}</b><small>{event.actorRole.replaceAll('_', ' ')}</small></td><td>{event.action.replaceAll('_', ' ')}</td><td><b>{event.targetType.replaceAll('_', ' ')}</b>{event.targetId ? <small>{event.targetId}</small> : null}{event.reason ? <small>{event.reason}</small> : null}</td><td><code>{event.requestId}</code></td></tr>)}</tbody></table></div>}
      </section> : null}
    </>}
  </WorkspaceShell>
}
