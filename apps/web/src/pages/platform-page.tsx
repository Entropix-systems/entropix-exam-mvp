import { useEffect, useMemo, useState } from 'react'
import type { OnboardInstitutionRequest, PlatformInstitutionSummary } from '@entropix/contracts'
import { useAuth } from '../auth/auth-context'
import { navigate } from '../auth/navigation'
import { PlatformApiClient } from '../platform/platform-client'
import { WorkspaceShell } from './workspace-shell'
import { AsyncButton } from '../components/async-button'
import { apiErrorMessage } from '../feedback/api-error-message'
import { useNotification } from '../feedback/notification-context'
import { useAsyncAction } from '../feedback/use-async-action'

type Form = Omit<OnboardInstitutionRequest, 'requestId'>
const blank: Form = { name: '', code: '', type: 'College', primaryAdministratorName: '', primaryAdministratorEmail: '', academicYear: '2026-27', status: 'ACTIVE' }
const errorText = (error: unknown) => apiErrorMessage(error, 'Institution administration could not be completed.')

export function PlatformPage({ client }: { client: PlatformApiClient }) {
  const { currentUser, logout, switchInstitution, returnToPlatform, switchRole } = useAuth()
  const [institutions, setInstitutions] = useState<readonly PlatformInstitutionSummary[]>([])
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const { notify } = useNotification()
  const { pendingAction, isPending, run } = useAsyncAction()

  function load() {
    setLoading(true); setPageError(null)
    void client.institutions().then((next) => { setInstitutions(next); setLoading(false) }, (reason: unknown) => { setPageError(errorText(reason)); setLoading(false) })
  }
  useEffect(() => { let active = true; void client.institutions().then((next) => { if (active) { setInstitutions(next); setLoading(false) } }, (reason: unknown) => { if (active) { setPageError(errorText(reason)); setLoading(false) } }); return () => { active = false } }, [client])
  const visible = useMemo(() => institutions.filter((institution) => {
    const needle = filter.trim().toLowerCase()
    return (!needle || [institution.name, institution.code, institution.type].some((value) => value.toLowerCase().includes(needle))) && (status === 'ALL' || institution.status === status)
  }), [institutions, filter, status])
  if (!currentUser || currentUser.context.kind !== 'PLATFORM') return null
  async function onboard(event: React.FormEvent) {
    event.preventDefault()
    const result = await run('onboard', () => client.onboard({ ...form, code: form.code.trim().toUpperCase() }))
    if (result.ok) { setInstitutions((current) => [...current, result.value].sort((a, b) => a.name.localeCompare(b.name))); setForm(blank); notify('Institution onboarded successfully.', 'success') }
    else if (!result.duplicate) notify(apiErrorMessage(result.error, 'Institution could not be onboarded.'), 'error')
  }
  async function toggle(institution: PlatformInstitutionSummary) {
    const key = `status-${institution.id}`
    const result = await run(key, () => client.setStatus(institution.id, institution.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'))
    if (result.ok) { setInstitutions((current) => current.map((entry) => entry.id === result.value.id ? result.value : entry)); notify(`Institution ${result.value.status === 'ACTIVE' ? 'activated' : 'suspended'}.`, 'success') }
    else if (!result.duplicate) notify(apiErrorMessage(result.error, 'Institution status could not be updated.'), 'error')
  }
  async function openWorkspace(institutionId: string) {
    const result = await run(`open-${institutionId}`, () => switchInstitution(institutionId))
    if (result.ok) {
      navigate('/', true)
    } else if (!result.duplicate) notify(apiErrorMessage(result.error, 'Institution workspace could not be opened.'), 'error')
  }
  return <WorkspaceShell currentUser={currentUser} active="platform" onLogout={logout} onSwitchInstitution={switchInstitution} onReturnToPlatform={returnToPlatform} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">Platform administration</p><h1>Institutions</h1><p>Create, activate, and enter an institution without assuming an institution administrator identity.</p></div></div>
    {pageError ? <div className="reports-error" role="alert"><b>Platform operation unavailable</b><p>{pageError}</p><button className="secondary-button" type="button" onClick={load}>Try again</button></div> : null}
    <section className="overview-card"><header><div><p className="eyebrow">Platform directory</p><h2>Institution management</h2></div><div><label>Search <input aria-label="Search institutions" value={filter} onChange={(event) => setFilter(event.target.value)} /></label><label>Status <select aria-label="Filter institution status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label></div></header>
      {loading ? <div className="reports-empty"><b>Loading institutions…</b><p>Reading platform-authorized institution metadata.</p></div> : visible.length === 0 ? <div className="reports-empty"><b>No matching institutions</b><p>Change the filters or onboard the first institution.</p></div> : <div className="reports-table-wrap"><table><thead><tr><th>Institution</th><th>Code</th><th>Type</th><th>Status</th><th>Academic year</th><th>Onboarding</th><th>Action</th></tr></thead><tbody>{visible.map((institution) => <tr key={institution.id}><td><b>{institution.name}</b></td><td>{institution.code}</td><td>{institution.type}</td><td><span className={'status-badge ' + (institution.status === 'ACTIVE' ? 'active' : 'inactive')}>{institution.status}</span></td><td>{institution.academicYear ?? 'Not configured'}</td><td>{institution.onboardingState}</td><td><AsyncButton className="secondary-button" disabled={isPending || institution.status !== 'ACTIVE'} loading={pendingAction === `open-${institution.id}`} loadingText="Opening…" type="button" onClick={() => void openWorkspace(institution.id)}>Open workspace</AsyncButton> <AsyncButton className="secondary-button" disabled={isPending} loading={pendingAction === `status-${institution.id}`} loadingText={institution.status === 'ACTIVE' ? 'Suspending…' : 'Activating…'} type="button" onClick={() => void toggle(institution)}>{institution.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</AsyncButton></td></tr>)}</tbody></table></div>}
    </section>
    <section className="overview-card"><header><div><p className="eyebrow">Onboard institution</p><h2>Create a new institution</h2></div></header><form onSubmit={(event) => void onboard(event)} className="form-grid"><label>Institution name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Institution code<input required pattern="[A-Za-z0-9_-]{2,32}" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label>Institution type<input required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} /></label><label>Primary administrator name<input required value={form.primaryAdministratorName} onChange={(event) => setForm({ ...form, primaryAdministratorName: event.target.value })} /></label><label>Primary administrator email<input required type="email" value={form.primaryAdministratorEmail} onChange={(event) => setForm({ ...form, primaryAdministratorEmail: event.target.value })} /></label><label>Initial academic year<input required value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Form['status'] })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label><AsyncButton className="primary-button" disabled={isPending} loading={pendingAction === 'onboard'} loadingText="Onboarding…" type="submit">Onboard institution</AsyncButton></form></section>
  </WorkspaceShell>
}
