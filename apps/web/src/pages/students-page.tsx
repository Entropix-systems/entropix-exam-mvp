import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  StudentDirectoryRecord,
  StudentImportPreview,
  StudentImportRequest,
} from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { PeopleApiClient } from '../people/people-client'
import { WorkspaceShell } from './workspace-shell'

function message(reason: unknown, fallback: string): string {
  return reason instanceof AuthApiError ? reason.message : fallback
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
  const [importBusy, setImportBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
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
    setImportBusy(true)
    setNotice(null)
    try {
      const input = { fileName: file.name, sourceText: await file.text() }
      setImportInput(input)
      setPreview(await client.previewStudents(input))
    } catch (reason) {
      setNotice(message(reason, 'Import preview could not be created.'))
      setPreview(null)
    } finally {
      setImportBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function commit() {
    if (!importInput || !preview || preview.errors.length > 0) return
    setImportBusy(true)
    try {
      const result = await client.commitStudents(importInput)
      setNotice(result.replayed
        ? `This file was already committed. No duplicate students were created.`
        : `${result.createdCount} students and ${result.enrolmentCount} enrolments imported.`)
      setPreview(null)
      setImportInput(null)
      if (currentCursor) setCursorHistory([null])
      else await load()
    } catch (reason) {
      setNotice(message(reason, 'Import could not be committed.'))
    } finally {
      setImportBusy(false)
    }
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
            <button
              type="button"
              className="primary-button"
              disabled={importBusy}
              onClick={() => fileInput.current?.click()}
            >
              {importBusy ? 'Validating…' : 'Import students'}
            </button>
          </>
        ) : null}
      </div>
      {notice ? <p className="form-message page-message success">{notice}</p> : null}
      {error ? (
        <div className="academic-error" role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void load()}>Retry</button>
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
            <header><div><p className="eyebrow">Atomic CSV validation</p><h2 id="import-title">Import students · Preview</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setPreview(null)}>×</button></header>
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
              <div><button type="button" className="secondary-button" onClick={() => setPreview(null)}>Cancel</button><button type="button" className="primary-button" disabled={preview.errors.length > 0 || importBusy} onClick={() => void commit()}>{importBusy ? 'Importing…' : 'Confirm import'}</button></div>
            </footer>
          </section>
        </div>
      ) : null}
    </WorkspaceShell>
  )
}
