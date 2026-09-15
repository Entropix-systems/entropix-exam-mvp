import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  StudentDirectoryRecord,
  StudentImportPreview,
  StudentImportRequest,
} from '@entropix/contracts'
import { useAuth } from '../auth/auth-context'
import { PeopleApiClient } from '../people/people-client'
import { WorkspaceShell } from './workspace-shell'
import { AsyncButton } from '../components/async-button'
import { apiErrorMessage } from '../feedback/api-error-message'
import { useNotification } from '../feedback/notification-context'
import { useAsyncAction } from '../feedback/use-async-action'

function message(reason: unknown, fallback: string): string {
  return apiErrorMessage(reason, fallback)
}

export function StudentsPage({ client }: { client: PeopleApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [students, setStudents] = useState<readonly StudentDirectoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null])
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<StudentDirectoryRecord | null>(null)
  const [importInput, setImportInput] = useState<StudentImportRequest | null>(null)
  const [preview, setPreview] = useState<StudentImportPreview | null>(null)
  const [importPhase, setImportPhase] = useState<'preview' | null>(null)
  const { notify } = useNotification()
  const { pendingAction, isPending, runMutationWithRefresh } = useAsyncAction()
  const fileInput = useRef<HTMLInputElement>(null)

  const canImport = currentUser?.context.kind === 'TENANT' &&
    (currentUser.context.activeRole === 'INSTITUTION_ADMIN' ||
      currentUser.context.activeRole === 'EXAM_CONTROLLER')
  const currentCursor = cursorHistory[cursorHistory.length - 1] ?? null

  const load = useCallback(async (
    cursor = currentCursor,
    requestedPageSize = pageSize,
    requestedSearch = search,
  ) => {
    setLoading(true)
    try {
      const directory = await client.listStudents({
        search: requestedSearch,
        cursor,
        pageSize: requestedPageSize,
      })
      setStudents(directory.students)
      setTotal(directory.total)
      setNextCursor(directory.nextCursor)
      setError(null)
    } catch (reason) {
      setError(message(reason, 'Student directory could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [client, currentCursor, pageSize, search])

  const refreshFirstPage = useCallback(async () => {
    const directory = await client.listStudents({ search, cursor: null, pageSize })
    setStudents(directory.students)
    setTotal(directory.total)
    setNextCursor(directory.nextCursor)
    setCursorHistory([null])
    setError(null)
  }, [client, pageSize, search])

  useEffect(() => {
    let active = true
    void client.listStudents({ search, cursor: currentCursor, pageSize }).then(
      (directory) => {
        if (!active) return
        setStudents(directory.students)
        setTotal(directory.total)
        setNextCursor(directory.nextCursor)
        setError(null)
        setLoading(false)
      },
      (reason: unknown) => {
        if (!active) return
        setError(message(reason, 'Student directory could not be loaded.'))
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [client, currentCursor, pageSize, search])

  async function chooseFile(file: File | undefined) {
    if (!file) return
    setImportPhase('preview')
    try {
      const input = { fileName: file.name, sourceText: await file.text() }
      setImportInput(input)
      setPreview(await client.previewStudents(input))
    } catch (reason) {
      notify(apiErrorMessage(reason, 'Import preview could not be created.'), 'error')
      setPreview(null)
    } finally {
      setImportPhase(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function commit() {
    if (!importInput || !preview || preview.errors.length > 0) return
    const result = await runMutationWithRefresh('commit-import', () => client.commitStudents(importInput), refreshFirstPage)
    if (result.status === 'success' || result.status === 'refresh-failed') {
      setPreview(null)
      setImportInput(null)
      if (result.status === 'refresh-failed') {
        const refreshFailure = 'Student import was committed, but the latest student directory could not be refreshed. Retry refresh.'
        setError(refreshFailure)
        notify(refreshFailure, 'warning')
        return
      }
      notify(result.value.replayed
        ? `This file was already committed. No duplicate students were created.`
        : `${result.value.createdCount} students and ${result.value.enrolmentCount} enrolments imported.`, result.value.replayed ? 'info' : 'success')
    } else if (result.status === 'mutation-failed') notify(apiErrorMessage(result.error, 'Student import failed.'), 'error')
  }

  if (!currentUser) return null
  return (
    <WorkspaceShell
      currentUser={currentUser}
      active="students"
      onLogout={logout}
      onSwitchInstitution={switchInstitution}
      onSwitchRole={switchRole}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academic records</p>
          <h1>Students</h1>
          <p>Tenant-scoped student profiles and subject enrolments.</p>
        </div>
        {canImport ? (
          <>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
            <AsyncButton
              type="button"
              className="primary-button"
              disabled={importPhase !== null || isPending}
              loading={importPhase === 'preview'}
              loadingText="Validating…"
              onClick={() => fileInput.current?.click()}
            >
              Import students
            </AsyncButton>
          </>
        ) : null}
      </div>
      {error ? (
        <div className="academic-error" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void load()}>Retry refresh</button>
        </div>
      ) : null}
      <section className="student-directory-card" aria-labelledby="student-directory-title">
        <header>
          <div>
            <h2 id="student-directory-title">Student directory</h2>
            <p>{total} students · roll numbers unique within this institution</p>
          </div>
          <span className="status-badge active">ACTIVE COHORT</span>
        </header>
        <div className="student-filters">
          <input
            aria-label="Search students"
            placeholder="Search name, email or roll number"
            value={search}
            onChange={(event) => {
              if (event.target.value === search) return
              setLoading(true)
              setSearch(event.target.value)
              setCursorHistory([null])
            }}
          />
          <span>{students.length} shown</span>
        </div>
        {loading ? <p className="loading-state">Loading students…</p> : (
          <div className="membership-table-wrap">
            <table className="membership-table student-table">
              <thead><tr><th>Student</th><th>Cohort</th><th>Subjects</th><th>Status</th></tr></thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} onClick={() => setSelected(student)}>
                    <td><strong>{student.name}</strong><small>{student.rollNo} · {student.email}</small></td>
                    <td>{student.cohort.name}<small>{student.cohort.code}</small></td>
                    <td>{student.subjects.length} enrolled<small>{student.subjects.map((subject) => subject.code).join(' · ')}</small></td>
                    <td><span className={`status-badge ${student.status.toLowerCase()}`}>{student.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 ? <p className="empty-state">No students match this search.</p> : null}
          </div>
        )}
        {!loading ? (
          <div className="pagination-controls" aria-label="Student pagination">
            <span>Page {cursorHistory.length}</span>
            <label>
              Rows
              <select
                aria-label="Student page size"
                value={pageSize}
                onChange={(event) => {
                  const nextPageSize = Number(event.target.value)
                  if (nextPageSize === pageSize) return
                  setLoading(true)
                  setPageSize(nextPageSize)
                  setCursorHistory([null])
                }}
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={cursorHistory.length === 1}
              onClick={() => {
                setLoading(true)
                setCursorHistory((history) => history.slice(0, -1))
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!nextCursor}
              onClick={() => {
                if (nextCursor) {
                  setLoading(true)
                  setCursorHistory((history) => [...history, nextCursor])
                }
              }}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      {selected ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="student-detail" role="dialog" aria-modal="true" aria-labelledby="student-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p className="eyebrow">Student profile</p><h2 id="student-detail-title">{selected.name}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>×</button></header>
            <dl>
              <div><dt>Roll number</dt><dd>{selected.rollNo}</dd></div>
              <div><dt>Email</dt><dd>{selected.email}</dd></div>
              <div><dt>Cohort</dt><dd>{selected.cohort.name}</dd></div>
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
            </dl>
            <h3>Active subject enrolments</h3>
            <ul>{selected.subjects.map((subject) => <li key={subject.id}><b>{subject.code}</b> {subject.name}</li>)}</ul>
          </section>
        </div>
      ) : null}
      {preview ? (
        <div className="modal-backdrop" role="presentation">
          <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <header><div><p className="eyebrow">Atomic CSV validation</p><h2 id="import-title">Import students · Preview</h2></div><button type="button" className="icon-button" aria-label="Close" disabled={importPhase !== null || isPending} onClick={() => setPreview(null)}>×</button></header>
            <div className="import-summary">
              <span><b>{preview.rowCount}</b> source rows</span>
              <span className="valid"><b>{preview.acceptedCount}</b> valid</span>
              <span className={preview.rejectedCount ? 'invalid' : 'valid'}><b>{preview.rejectedCount}</b> rejected</span>
            </div>
            <div className="membership-table-wrap">
              <table className="membership-table"><thead><tr><th>Row</th><th>Roll number</th><th>Student</th><th>Validation</th></tr></thead>
                <tbody>{preview.rows.map((row) => {
                  const errors = preview.errors.filter((error) => error.rowNumber === row.rowNumber)
                  return <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.rollNo || '—'}</td><td>{row.name || '—'}<small>{row.cohortCode} · {row.subjectCodes.join(' | ')}</small></td><td>{row.valid ? <span className="status-badge active">VALID</span> : errors.map((error) => <small className="row-error" key={`${error.field}-${error.code}`}>{error.message}</small>)}</td></tr>
                })}</tbody>
              </table>
            </div>
            <footer>
              <p>{preview.errors.length ? 'Correct every rejected row and upload again. No records have changed.' : preview.alreadyCommitted ? 'This exact file is already committed; confirming is retry-safe.' : 'All rows are valid. Confirm to create students and enrolments atomically.'}</p>
              <div><button type="button" className="secondary-button" disabled={importPhase !== null || isPending} onClick={() => setPreview(null)}>Cancel</button><AsyncButton type="button" className="primary-button" disabled={preview.errors.length > 0 || importPhase !== null || isPending} loading={pendingAction === 'commit-import'} loadingText="Importing…" onClick={() => void commit()}>Confirm import</AsyncButton></div>
            </footer>
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  )
}
