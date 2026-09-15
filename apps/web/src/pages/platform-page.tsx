import { useEffect, useMemo, useState } from 'react'
import type { OnboardInstitutionRequest, PlatformInstitutionSummary } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { navigate } from '../auth/navigation'
import { PlatformApiClient } from '../platform/platform-client'
import { WorkspaceShell } from './workspace-shell'

type Form = Omit<OnboardInstitutionRequest, 'requestId'>
const blank: Form = { name: '', code: '', type: 'College', primaryAdministratorName: '', primaryAdministratorEmail: '', academicYear: '2026-27', status: 'ACTIVE' }
const errorText = (error: unknown) => error instanceof AuthApiError ? error.message : 'Institution administration could not be completed.'

export function PlatformPage({ client }: { client: PlatformApiClient }) {
  const { currentUser, logout, switchInstitution, returnToPlatform, switchRole } = useAuth()
  const [institutions, setInstitutions] = useState<readonly PlatformInstitutionSummary[]>([])
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true); setError(null)
    void client.institutions().then((next) => { setInstitutions(next); setLoading(false) }, (reason: unknown) => { setError(errorText(reason)); setLoading(false) })
  }
  useEffect(() => { let active = true; void client.institutions().then((next) => { if (active) { setInstitutions(next); setLoading(false) } }, (reason: unknown) => { if (active) { setError(errorText(reason)); setLoading(false) } }); return () => { active = false } }, [client])
  const visible = useMemo(() => institutions.filter((institution) => {
    const needle = filter.trim().toLowerCase()
    return (!needle || [institution.name, institution.code, institution.type].some((value) => value.toLowerCase().includes(needle))) && (status === 'ALL' || institution.status === status)
  }), [institutions, filter, status])
  if (!currentUser || currentUser.context.kind !== 'PLATFORM') return null
  async function onboard(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null)
    try { const created = await client.onboard({ ...form, code: form.code.trim().toUpperCase() }); setInstitutions((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name))); setForm(blank) }
    catch (reason) { setError(errorText(reason)) } finally { setSubmitting(false) }
  }
  async function toggle(institution: PlatformInstitutionSummary) {
    try { const next = await client.setStatus(institution.id, institution.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'); setInstitutions((current) => current.map((entry) => entry.id === next.id ? next : entry)) }
    catch (reason) { setError(errorText(reason)) }
  }
  async function openWorkspace(institutionId: string) {
    try {
      setError(null)
      await switchInstitution(institutionId)
      navigate('/', true)
    } catch (reason) {
      setError(errorText(reason))
    }
  }
  return <WorkspaceShell currentUser={currentUser} active="platform" onLogout={logout} onSwitchInstitution={switchInstitution} onReturnToPlatform={returnToPlatform} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">Platform administration</p><h1>Institutions</h1><p>Create, activate, and enter an institution without assuming an institution administrator identity.</p></div></div>
    {error ? <div className="reports-error" role="alert"><b>Platform operation unavailable</b><p>{error}</p><button className="secondary-button" type="button" onClick={load}>Try again</button></div> : null}
    <section className="overview-card"><header><div><p className="eyebrow">Platform directory</p><h2>Institution management</h2></div><div><label>Search <input aria-label="Search institutions" value={filter} onChange={(event) => setFilter(event.target.value)} /></label><label>Status <select aria-label="Filter institution status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label></div></header>
      {loading ? <div className="reports-empty"><b>Loading institutions…</b><p>Reading platform-authorized institution metadata.</p></div> : visible.length === 0 ? <div className="reports-empty"><b>No matching institutions</b><p>Change the filters or onboard the first institution.</p></div> : <div className="reports-table-wrap"><table><thead><tr><th>Institution</th><th>Code</th><th>Type</th><th>Status</th><th>Academic year</th><th>Onboarding</th><th>Action</th></tr></thead><tbody>{visible.map((institution) => <tr key={institution.id}><td><b>{institution.name}</b></td><td>{institution.code}</td><td>{institution.type}</td><td><span className={'status-badge ' + (institution.status === 'ACTIVE' ? 'active' : 'inactive')}>{institution.status}</span></td><td>{institution.academicYear ?? 'Not configured'}</td><td>{institution.onboardingState}</td><td><button className="secondary-button" disabled={institution.status !== 'ACTIVE'} type="button" onClick={() => void openWorkspace(institution.id)}>Open workspace</button> <button className="secondary-button" type="button" onClick={() => void toggle(institution)}>{institution.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button></td></tr>)}</tbody></table></div>}
    </section>
    <section className="overview-card"><header><div><p className="eyebrow">Onboard institution</p><h2>Create a new institution</h2></div></header><form onSubmit={(event) => void onboard(event)} className="form-grid"><label>Institution name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Institution code<input required pattern="[A-Za-z0-9_-]{2,32}" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label>Institution type<input required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} /></label><label>Primary administrator name<input required value={form.primaryAdministratorName} onChange={(event) => setForm({ ...form, primaryAdministratorName: event.target.value })} /></label><label>Primary administrator email<input required type="email" value={form.primaryAdministratorEmail} onChange={(event) => setForm({ ...form, primaryAdministratorEmail: event.target.value })} /></label><label>Initial academic year<input required value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Form['status'] })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label><button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Onboarding…' : 'Onboard institution'}</button></form></section>
  </WorkspaceShell>
}
