import { useCallback, useEffect, useState } from 'react'
import type { AcademicStructureSnapshot } from '@entropix/contracts'
import { AcademicsApiClient } from '../academics/academics-client'
import { AuthApiError } from '../auth/auth-client'

function errorMessage(reason: unknown): string {
  return reason instanceof AuthApiError
    ? reason.message
    : 'Academic structure could not be loaded.'
}

function codeList(records: readonly { id: string; code: string; name: string }[]) {
  return (
    <ul className="academic-record-list">
      {records.map((record) => (
        <li key={record.id}>
          <span className="academic-code">{record.code}</span>
          <strong>{record.name}</strong>
        </li>
      ))}
    </ul>
  )
}

export function AcademicStructureContent({
  structure,
}: {
  structure: AcademicStructureSnapshot
}) {
  const academicYear = structure.academicYears[0]
  const campus = structure.campuses[0]
  const program = structure.programs[0]
  const term = structure.terms[0]
  const cohort = structure.cohorts[0]
  return (
    <div className="academic-grid">
      <section className="academic-summary-card" aria-labelledby="academic-structure-title">
        <header>
          <div>
            <p className="eyebrow">Persisted tenant data</p>
            <h2 id="academic-structure-title">Academic structure</h2>
          </div>
          <span className="status-badge active">READY</span>
        </header>
        <dl className="academic-facts">
          <div><dt>Institution</dt><dd>{structure.tenant.name}</dd></div>
          <div><dt>Timezone</dt><dd>{structure.tenant.timezone}</dd></div>
          <div><dt>Academic year</dt><dd>{academicYear?.name ?? 'Not configured'}</dd></div>
          <div><dt>Campus</dt><dd>{campus?.name ?? 'Not configured'}</dd></div>
          <div><dt>Program</dt><dd>{program?.name ?? 'Not configured'}</dd></div>
          <div>
            <dt>Term and cohort</dt>
            <dd>{term && cohort ? `${term.name} · ${cohort.name}` : 'Not configured'}</dd>
          </div>
        </dl>
        {academicYear ? (
          <p className="academic-calendar">
            Calendar: {academicYear.startsOn} to {academicYear.endsOn}
          </p>
        ) : null}
      </section>
      <section className="academic-list-card" aria-labelledby="departments-title">
        <header>
          <div>
            <h2 id="departments-title">Departments</h2>
            <p>{structure.departments.length} tenant-scoped records</p>
          </div>
        </header>
        {structure.departments.length > 0
          ? codeList(structure.departments)
          : <p className="empty-state">No departments configured.</p>}
      </section>
      <section className="academic-list-card" aria-labelledby="subjects-title">
        <header>
          <div>
            <h2 id="subjects-title">Subjects</h2>
            <p>{structure.subjects.length} records for the active program</p>
          </div>
        </header>
        {structure.subjects.length > 0
          ? codeList(structure.subjects)
          : <p className="empty-state">No subjects configured.</p>}
      </section>
    </div>
  )
}

export function AcademicStructure({ client }: { client: AcademicsApiClient }) {
  const [structure, setStructure] = useState<AcademicStructureSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStructure(await client.list())
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
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
        setError(errorMessage(reason))
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [client])

  if (loading) return <p className="academic-loading" role="status">Loading academic structure…</p>
  if (error) {
    return (
      <div className="academic-error" role="alert">
        <p>{error}</p>
        <button type="button" className="secondary-button" onClick={() => void load()}>Retry</button>
      </div>
    )
  }
  return structure ? <AcademicStructureContent structure={structure} /> : null
}
