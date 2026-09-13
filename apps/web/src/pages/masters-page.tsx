import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicInputByResource,
  AcademicMasterRecord,
  AcademicResourcePath,
  AcademicStructureSnapshot,
} from '@entropix/contracts'
import { AcademicsApiClient } from '../academics/academics-client'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { canManageIdentity } from '../identity/identity-access'
import { AccessDeniedPage } from './access-denied-page'
import { WorkspaceShell } from './workspace-shell'

const MASTER_TYPES: readonly {
  path: AcademicResourcePath
  label: string
  singular: string
}[] = [
  { path: 'campuses', label: 'Campuses', singular: 'campus' },
  { path: 'departments', label: 'Departments', singular: 'department' },
  { path: 'programs', label: 'Programs', singular: 'program' },
  { path: 'academic-years', label: 'Academic years', singular: 'academic year' },
  { path: 'terms', label: 'Terms', singular: 'term' },
  { path: 'cohorts', label: 'Cohorts', singular: 'cohort' },
  { path: 'subjects', label: 'Subjects', singular: 'subject' },
] as const

type MasterFormState = {
  code: string
  name: string
  campusId: string
  departmentId: string
  programId: string
  academicYearId: string
  termId: string
  startsOn: string
  endsOn: string
  sequence: string
  credits: string
}

const BLANK_FORM: MasterFormState = {
  code: '',
  name: '',
  campusId: '',
  departmentId: '',
  programId: '',
  academicYearId: '',
  termId: '',
  startsOn: '',
  endsOn: '',
  sequence: '1',
  credits: '3',
}

function requestError(reason: unknown, fallback: string): string {
  return reason instanceof AuthApiError ? reason.message : fallback
}

function recordsFor(
  structure: AcademicStructureSnapshot,
  resource: AcademicResourcePath,
): AcademicMasterRecord[] {
  switch (resource) {
    case 'campuses': return structure.campuses
    case 'departments': return structure.departments
    case 'programs': return structure.programs
    case 'academic-years': return structure.academicYears
    case 'terms': return structure.terms
    case 'cohorts': return structure.cohorts
    case 'subjects': return structure.subjects
  }
}

function recordDetail(
  record: AcademicMasterRecord,
  resource: AcademicResourcePath,
  structure: AcademicStructureSnapshot,
): string {
  switch (resource) {
    case 'campuses':
      return 'Institution campus'
    case 'departments': {
      const campusId = 'campusId' in record ? record.campusId : ''
      return `Campus: ${structure.campuses.find((item) => item.id === campusId)?.name ?? 'Unknown'}`
    }
    case 'programs': {
      const departmentId = 'departmentId' in record ? record.departmentId : ''
      return `Department: ${structure.departments.find((item) => item.id === departmentId)?.name ?? 'Unknown'}`
    }
    case 'academic-years':
      return 'startsOn' in record ? `${record.startsOn} to ${record.endsOn}` : ''
    case 'terms': {
      if (!('academicYearId' in record)) return ''
      const program = structure.programs.find((item) => item.id === record.programId)?.name
      const year = structure.academicYears.find((item) => item.id === record.academicYearId)?.name
      return `${program ?? 'Unknown program'} · ${year ?? 'Unknown year'} · Sequence ${record.sequence}`
    }
    case 'cohorts': {
      const termId = 'termId' in record ? record.termId : ''
      return `Term: ${structure.terms.find((item) => item.id === termId)?.name ?? 'Unknown'}`
    }
    case 'subjects': {
      if (!('credits' in record)) return ''
      const program = structure.programs.find((item) => item.id === record.programId)?.name
      return `${program ?? 'Unknown program'} · ${record.credits} credits`
    }
  }
}

function formForNew(
  resource: AcademicResourcePath,
  structure: AcademicStructureSnapshot,
): MasterFormState {
  const next = {
    ...BLANK_FORM,
    campusId: structure.campuses[0]?.id ?? '',
    departmentId: structure.departments[0]?.id ?? '',
    programId: structure.programs[0]?.id ?? '',
    academicYearId: structure.academicYears[0]?.id ?? '',
    termId: structure.terms[0]?.id ?? '',
  }
  if (resource === 'terms' && structure.academicYears[0]) {
    next.startsOn = structure.academicYears[0].startsOn
    next.endsOn = structure.academicYears[0].endsOn
  }
  return next
}

function formForRecord(record: AcademicMasterRecord): MasterFormState {
  return {
    ...BLANK_FORM,
    code: record.code,
    name: record.name,
    campusId: 'campusId' in record ? record.campusId : '',
    departmentId: 'departmentId' in record ? record.departmentId : '',
    programId: 'programId' in record ? record.programId : '',
    academicYearId: 'academicYearId' in record ? record.academicYearId : '',
    termId: 'termId' in record ? record.termId : '',
    startsOn: 'startsOn' in record ? record.startsOn : '',
    endsOn: 'endsOn' in record ? record.endsOn : '',
    sequence: 'sequence' in record ? String(record.sequence) : '1',
    credits: 'credits' in record ? String(record.credits) : '3',
  }
}

export function MastersPage({ client }: { client: AcademicsApiClient }) {
  const { currentUser, logout } = useAuth()
  const [structure, setStructure] = useState<AcademicStructureSnapshot | null>(null)
  const [resource, setResource] = useState<AcademicResourcePath>('campuses')
  const [editing, setEditing] = useState<AcademicMasterRecord | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<MasterFormState>(BLANK_FORM)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mayManage = canManageIdentity(currentUser)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStructure(await client.list())
      setError(null)
    } catch (reason) {
      setError(requestError(reason, 'Academic masters could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (!mayManage) return
    let active = true
    void client.list().then(
      (next) => {
        if (!active) return
        setStructure(next)
        setError(null)
        setLoading(false)
      },
      (reason: unknown) => {
        if (!active) return
        setError(requestError(reason, 'Academic masters could not be loaded.'))
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [client, mayManage])

  if (!currentUser) return null
  if (!mayManage) return <AccessDeniedPage />

  const selectedType = MASTER_TYPES.find((item) => item.path === resource)!
  const records = structure ? recordsFor(structure, resource) : []

  function openCreate() {
    if (!structure) return
    setEditing(null)
    setForm(formForNew(resource, structure))
    setDialogError(null)
    setDialogOpen(true)
  }

  function openEdit(record: AcademicMasterRecord) {
    setEditing(record)
    setForm(formForRecord(record))
    setDialogError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
    setDialogError(null)
  }

  async function persist() {
    const base = { code: form.code, name: form.name }
    const save = (input: AcademicInputByResource[AcademicResourcePath]) => editing
      ? client.update(resource, editing.id, input)
      : client.create(resource, input)

    switch (resource) {
      case 'campuses': return save(base)
      case 'departments': return save({ ...base, campusId: form.campusId })
      case 'programs': return save({ ...base, departmentId: form.departmentId })
      case 'academic-years': return save({ ...base, startsOn: form.startsOn, endsOn: form.endsOn })
      case 'terms': return save({
        ...base,
        programId: form.programId,
        academicYearId: form.academicYearId,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        sequence: Number(form.sequence),
      })
      case 'cohorts': return save({ ...base, termId: form.termId })
      case 'subjects': return save({ ...base, programId: form.programId, credits: Number(form.credits) })
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setDialogError(null)
    try {
      await persist()
      closeDialog()
      setNotice(`${selectedType.singular[0]!.toUpperCase()}${selectedType.singular.slice(1)} ${editing ? 'updated' : 'created'}.`)
      await load()
    } catch (reason) {
      setDialogError(requestError(reason, `The ${selectedType.singular} could not be saved.`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <WorkspaceShell currentUser={currentUser} active="masters" onLogout={logout}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Institution administration</p>
          <h1>Academic masters</h1>
          <p>Configure the academic structure used by students, exams, and results.</p>
        </div>
        <button type="button" className="primary-button" disabled={!structure} onClick={openCreate}>
          Add {selectedType.singular}
        </button>
      </div>
      {notice ? <p className="form-message success page-message" role="status">{notice}</p> : null}
      {error ? (
        <div className="academic-error" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void load()}>Retry</button>
        </div>
      ) : null}
      <div className="master-layout">
        <nav className="master-types" aria-label="Academic master types">
          {MASTER_TYPES.map((item) => {
            const count = structure ? recordsFor(structure, item.path).length : 0
            return (
              <button
                type="button"
                className={resource === item.path ? 'active' : ''}
                key={item.path}
                onClick={() => { setResource(item.path); setNotice(null) }}
              >
                <span>{item.label}</span><b>{count}</b>
              </button>
            )
          })}
        </nav>
        <section className="master-card" aria-labelledby="master-list-title">
          <header>
            <div>
              <h2 id="master-list-title">{selectedType.label}</h2>
              <p>{structure?.tenant.name ?? 'Current institution'} · persisted records</p>
            </div>
            <button type="button" className="link-button" disabled={loading} onClick={() => void load()}>Refresh</button>
          </header>
          {loading ? <p className="loading-state" role="status">Loading masters…</p> : null}
          {!loading && structure ? (
            <div className="membership-table-wrap">
              <table className="membership-table master-table">
                <thead><tr><th>Code</th><th>Name</th><th>Configuration</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td><span className="academic-code">{record.code}</span></td>
                      <td><strong>{record.name}</strong></td>
                      <td>{recordDetail(record, resource, structure)}</td>
                      <td><button type="button" className="link-button" onClick={() => openEdit(record)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length === 0 ? <p className="empty-state">No {selectedType.label.toLowerCase()} configured.</p> : null}
            </div>
          ) : null}
        </section>
      </div>
      {dialogOpen && structure ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeDialog}>
          <form className="master-dialog" role="dialog" aria-modal="true" aria-labelledby="master-dialog-title" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><p className="eyebrow">Academic master</p><h2 id="master-dialog-title">{editing ? 'Edit' : 'Add'} {selectedType.singular}</h2></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={closeDialog}>×</button>
            </header>
            <div className="master-form">
              <label>Code<input required maxLength={32} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label>
              <label>Name<input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              {resource === 'departments' ? <label>Campus<select required value={form.campusId} onChange={(event) => setForm({ ...form, campusId: event.target.value })}><option value="">Select campus</option>{structure.campuses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
              {resource === 'programs' ? <label>Department<select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Select department</option>{structure.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
              {resource === 'terms' || resource === 'subjects' ? <label>Program<select required value={form.programId} onChange={(event) => setForm({ ...form, programId: event.target.value })}><option value="">Select program</option>{structure.programs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
              {resource === 'terms' ? <label>Academic year<select required value={form.academicYearId} onChange={(event) => { const year = structure.academicYears.find((item) => item.id === event.target.value); setForm({ ...form, academicYearId: event.target.value, startsOn: year?.startsOn ?? form.startsOn, endsOn: year?.endsOn ?? form.endsOn }) }}><option value="">Select academic year</option>{structure.academicYears.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
              {resource === 'cohorts' ? <label>Term<select required value={form.termId} onChange={(event) => setForm({ ...form, termId: event.target.value })}><option value="">Select term</option>{structure.terms.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
              {resource === 'academic-years' || resource === 'terms' ? <><label>Start date<input required type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></label><label>End date<input required type="date" value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></label></> : null}
              {resource === 'terms' ? <label>Sequence<input required min="1" max="100" type="number" value={form.sequence} onChange={(event) => setForm({ ...form, sequence: event.target.value })} /></label> : null}
              {resource === 'subjects' ? <label>Credits<input required min="1" max="50" type="number" value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} /></label> : null}
              {dialogError ? <p className="form-message error master-form-error" role="alert">{dialogError}</p> : null}
            </div>
            <footer><button type="button" className="secondary-button" onClick={closeDialog}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></footer>
          </form>
        </div>
      ) : null}
    </WorkspaceShell>
  )
}
