import { useCallback, useEffect, useState } from 'react'
import type { EvaluationSnapshot, EvaluationSubjectRecord, MarkComponent } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { EvaluationApiClient } from '../evaluation/evaluation-client'
import { WorkspaceShell } from './workspace-shell'

type Drafts = Record<string, Record<string, Partial<Record<MarkComponent, string>>>>

const message = (reason: unknown) => reason instanceof AuthApiError ? reason.message : 'The evaluation action could not be completed.'

function valuesFor(subject: EvaluationSubjectRecord, drafts: Drafts, registrationSubjectId: string) {
  const persisted = subject.roster.find((row) => row.registrationSubjectId === registrationSubjectId)?.marks ?? []
  return drafts[subject.examSubjectId]?.[registrationSubjectId]
    ?? Object.fromEntries(persisted.map((mark) => [mark.component, mark.value]))
}

function rowOutcome(subject: EvaluationSubjectRecord, row: EvaluationSubjectRecord['roster'][number], drafts: Drafts) {
  if (row.held) return 'WITHHELD'
  if (row.attendanceState === 'ABSENT') return 'ABSENT'
  const values = valuesFor(subject, drafts, row.registrationSubjectId)
  return subject.components.every((component) => values[component.component] !== undefined && values[component.component] !== '') ? 'READY' : 'INCOMPLETE'
}

export function EvaluationPage({ client }: { client: EvaluationApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [snapshot, setSnapshot] = useState<EvaluationSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [facultyId, setFacultyId] = useState('')
  const [drafts, setDrafts] = useState<Drafts>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const next = await client.list()
    setSnapshot(next)
    setSelectedId((current) => next.subjects.some((subject) => subject.examSubjectId === current) ? current : next.subjects[0]?.examSubjectId ?? '')
    setDrafts({})
  }, [client])

  useEffect(() => {
    let active = true
    void client.list().then((next) => {
      if (!active) return
      setSnapshot(next)
      setSelectedId(next.subjects[0]?.examSubjectId ?? '')
      setLoading(false)
    }, (reason: unknown) => {
      if (active) { setNotice(message(reason)); setLoading(false) }
    })
    return () => { active = false }
  }, [client])

  async function action(operation: () => Promise<unknown>, success: string) {
    setBusy(true)
    setNotice(null)
    try { await operation(); await load(); setNotice(success) }
    catch (reason) { setNotice(message(reason)) }
    finally { setBusy(false) }
  }

  if (!currentUser) return null
  const controller = currentUser.context.kind === 'TENANT' && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(currentUser.context.activeRole)
  const subject = snapshot?.subjects.find((entry) => entry.examSubjectId === selectedId) ?? snapshot?.subjects[0]
  const assignableFaculty = subject ? snapshot?.faculty.filter((faculty) => faculty.departmentId === subject.departmentId) ?? [] : []
  const selectedFacultyId = assignableFaculty.some((faculty) => faculty.id === facultyId)
    ? facultyId
    : subject?.assignment?.facultyId ?? assignableFaculty[0]?.id ?? ''

  function setMark(registrationSubjectId: string, component: MarkComponent, value: string) {
    if (!subject) return
    const current = valuesFor(subject, drafts, registrationSubjectId)
    setDrafts((all) => ({
      ...all,
      [subject.examSubjectId]: {
        ...all[subject.examSubjectId],
        [registrationSubjectId]: { ...current, [component]: value },
      },
    }))
  }

  function save(current: EvaluationSubjectRecord) {
    return client.save(current.examSubjectId, {
      expectedVersion: current.batch.version,
      rows: current.roster.map((row) => {
        const values = valuesFor(current, drafts, row.registrationSubjectId)
        return {
          registrationSubjectId: row.registrationSubjectId,
          marks: current.components.map((component) => ({
            component: component.component,
            value: row.attendanceState === 'ABSENT' && ['FINAL', 'EXTERNAL'].includes(component.component)
              ? null
              : values[component.component]?.trim() || null,
          })),
        }
      }),
    })
  }

  function review(current: EvaluationSubjectRecord, approved: boolean) {
    const reason = window.prompt(approved ? 'Approval reason' : 'Reason for returning marks')?.trim()
    if (!reason) return
    void action(
      () => approved
        ? client.approve(current.examSubjectId, { expectedVersion: current.batch.version, reason })
        : client.returnBatch(current.examSubjectId, { expectedVersion: current.batch.version, reason }),
      approved ? 'Marks independently approved.' : 'Marks returned to the assigned examiner.',
    )
  }

  function reopen(current: EvaluationSubjectRecord) {
    const reason = window.prompt('Reason for reopening approved marks')?.trim()
    if (reason) void action(() => client.reopen(current.examSubjectId, { expectedVersion: current.batch.version, reason }), 'Approved marks reopened; candidate result inputs were invalidated.')
  }

  return <WorkspaceShell currentUser={currentUser} active="marks" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">Evaluation workspace</p><h1>Marks &amp; review</h1><p>Examiner-scoped component entry with independent approval.</p></div></div>
    {notice ? <p className="form-message page-message">{notice}</p> : null}
    {loading ? <p className="evaluation-empty">Loading evaluation workspace…</p> : !snapshot || snapshot.subjects.length === 0 ? <section className="evaluation-empty"><h2>No assigned evaluation work</h2><p>Faculty see their assigned subjects. Controllers and department administrators see subjects in their scope.</p></section> : <>
      <section className="evaluation-toolbar">
        <label>Exam subject<select value={subject?.examSubjectId ?? ''} onChange={(event) => { setSelectedId(event.target.value); setFacultyId('') }}>{snapshot.subjects.map((entry) => <option value={entry.examSubjectId} key={entry.examSubjectId}>{entry.examCode} · {entry.subjectCode} · {entry.subjectName}</option>)}</select></label>
        <span className={'status-badge ' + (subject?.batch.state === 'APPROVED' ? 'active' : subject?.batch.state === 'RETURNED' ? 'inactive' : '')}>{subject?.batch.state}</span>
      </section>
      {subject ? <div className="evaluation-stack">
        <section className="evaluation-card">
          <header><div><p className="eyebrow">{subject.examName}</p><h2>{subject.subjectCode} · {subject.subjectName}</h2><p>{subject.roster.length} approved registrations · Rule v{subject.ruleVersion} · input revision {subject.inputRevision}</p></div><span className={'status-badge ' + (subject.conductReady ? 'active' : 'inactive')}>{subject.conductReady ? 'CONDUCT READY' : 'ATTENDANCE PENDING'}</span></header>
          <div className="evaluation-assignment"><div><h3>Assigned examiner</h3><p>{subject.assignment?.facultyName ?? 'No examiner assigned'}</p></div>{subject.canAssign ? <div><label>Faculty<select value={selectedFacultyId} onChange={(event) => setFacultyId(event.target.value)}>{assignableFaculty.map((faculty) => <option value={faculty.id} key={faculty.id}>{faculty.name} · {faculty.code}</option>)}</select></label><button className="secondary-button" disabled={busy || !selectedFacultyId} onClick={() => void action(() => client.assign(subject.examSubjectId, { facultyId: selectedFacultyId, expectedVersion: subject.assignment?.version ?? 0 }), 'Examiner assignment saved.')}>Save assignment</button></div> : null}</div>
        </section>

        <section className="evaluation-card">
          <header><div><h2>Component marks</h2><p>{subject.components.map((component) => component.component + ' / ' + component.maximum).join(' · ')}</p></div></header>
          <div className="evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Student</th><th>Attendance</th>{subject.components.map((component) => <th key={component.component}>{component.component} / {component.maximum}</th>)}<th>Outcome</th></tr></thead><tbody>{subject.roster.map((row) => {
            const values = valuesFor(subject, drafts, row.registrationSubjectId)
            return <tr key={row.registrationSubjectId}><td><b>{row.studentName}</b><small>{row.rollNo}</small></td><td><span className={'status-badge ' + (row.attendanceState === 'PRESENT' || row.attendanceState === 'LATE' ? 'active' : row.attendanceState === 'ABSENT' ? 'inactive' : '')}>{row.attendanceState}</span></td>{subject.components.map((component) => {
              const absentBlank = row.attendanceState === 'ABSENT' && ['FINAL', 'EXTERNAL'].includes(component.component)
              return <td key={component.component}><input aria-label={component.component + ' marks for ' + row.studentName} type="number" min="0" max={component.maximum} step="0.01" value={absentBlank ? '' : values[component.component] ?? ''} disabled={busy || !subject.canEdit || absentBlank} onChange={(event) => setMark(row.registrationSubjectId, component.component, event.target.value)} /></td>
            })}<td><span className={'status-badge ' + (rowOutcome(subject, row, drafts) === 'READY' ? 'active' : rowOutcome(subject, row, drafts) === 'INCOMPLETE' || rowOutcome(subject, row, drafts) === 'WITHHELD' ? 'inactive' : '')}>{rowOutcome(subject, row, drafts)}</span></td></tr>
          })}</tbody></table></div>
          <div className="evaluation-note">{subject.batch.reviewReason ? <span>Latest review: {subject.batch.reviewReason}</span> : <span>ABSENT requires a blank external or final mark. WITHHELD rows may retain draft marks.</span>}</div>
          <footer className="evaluation-actions">
            <span>{subject.assignment ? 'Examiner: ' + subject.assignment.facultyName : 'Assign an examiner before entry.'}</span>
            {subject.canEdit ? <><button className="secondary-button" disabled={busy} onClick={() => void action(() => save(subject), 'Marks draft saved.')}>Save draft</button><button className="primary-button" disabled={busy || !subject.conductReady || subject.batch.version === 0} onClick={() => void action(() => client.submit(subject.examSubjectId, { expectedVersion: subject.batch.version }), 'Marks submitted for independent review.')}>Submit for review</button></> : null}
            {subject.canReview ? <><button className="secondary-button" disabled={busy} onClick={() => review(subject, false)}>Return</button><button className="primary-button" disabled={busy || !subject.conductReady} onClick={() => review(subject, true)}>Approve batch</button></> : null}
            {controller && subject.batch.state === 'APPROVED' ? <button className="secondary-button" disabled={busy} onClick={() => reopen(subject)}>Reopen with reason</button> : null}
          </footer>
        </section>
      </div> : null}
    </>}
  </WorkspaceShell>
}
