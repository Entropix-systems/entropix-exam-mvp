import { useCallback, useEffect, useState } from 'react'
import type { EvaluationSnapshot, EvaluationSubjectRecord, MarkComponent } from '@entropix/contracts'
import { useAuth } from '../auth/auth-context'
import { EvaluationApiClient } from '../evaluation/evaluation-client'
import { WorkspaceShell } from './workspace-shell'
import { AsyncButton } from '../components/async-button'
import { apiErrorMessage } from '../feedback/api-error-message'
import { useNotification } from '../feedback/notification-context'
import { useAsyncAction } from '../feedback/use-async-action'

type Drafts = Record<string, Record<string, Partial<Record<MarkComponent, string>>>>

const message = (reason: unknown) => apiErrorMessage(reason, 'Evaluation data could not be loaded.')

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
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { notify } = useNotification()
  const { pendingAction, isPending, runMutationWithRefresh } = useAsyncAction()

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
      if (active) { setPageError(message(reason)); setLoading(false) }
    })
    return () => { active = false }
  }, [client])

  async function action(key: string, operation: () => Promise<unknown>, success: string, refreshFailure = 'Changes were saved, but the latest marks data could not be refreshed. Retry refresh.') {
    const result = await runMutationWithRefresh(key, operation, load)
    if (result.status === 'success') notify(success, 'success')
    else if (result.status === 'refresh-failed') { setPageError(refreshFailure); notify(refreshFailure, 'warning') }
    else if (result.status === 'mutation-failed') notify(apiErrorMessage(result.error, 'The evaluation action could not be completed.'), 'error')
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
      `${approved ? 'approve' : 'return'}-${current.examSubjectId}`,
      () => approved
        ? client.approve(current.examSubjectId, { expectedVersion: current.batch.version, reason })
        : client.returnBatch(current.examSubjectId, { expectedVersion: current.batch.version, reason }),
      approved ? 'Marks independently approved.' : 'Marks returned to the assigned examiner.',
      approved
        ? 'Marks were approved, but the latest marks state could not be reloaded. Retry refresh.'
        : 'Marks were returned, but the latest marks state could not be reloaded. Retry refresh.',
    )
  }

  function reopen(current: EvaluationSubjectRecord) {
    const reason = window.prompt('Reason for reopening approved marks')?.trim()
    if (reason) void action(`reopen-${current.examSubjectId}`, () => client.reopen(current.examSubjectId, { expectedVersion: current.batch.version, reason }), 'Approved marks reopened; candidate result inputs were invalidated.')
  }

  return <WorkspaceShell currentUser={currentUser} active="marks" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">Evaluation workspace</p><h1>Marks &amp; review</h1><p>Examiner-scoped component entry with independent approval.</p></div></div>
    {pageError ? <div className="academic-error" role="alert"><p>{pageError}</p><button type="button" className="secondary-button" onClick={() => { setPageError(null); setLoading(true); void load().then(() => setLoading(false), (reason: unknown) => { setPageError(message(reason)); setLoading(false) }) }}>Retry refresh</button></div> : null}
    {loading ? <p className="evaluation-empty">Loading evaluation workspace…</p> : !snapshot || snapshot.subjects.length === 0 ? <section className="evaluation-empty"><h2>No assigned evaluation work</h2><p>Faculty see their assigned subjects. Controllers and department administrators see subjects in their scope.</p></section> : <>
      <section className="evaluation-toolbar">
        <label>Exam subject<select value={subject?.examSubjectId ?? ''} onChange={(event) => { setSelectedId(event.target.value); setFacultyId('') }}>{snapshot.subjects.map((entry) => <option value={entry.examSubjectId} key={entry.examSubjectId}>{entry.examCode} · {entry.subjectCode} · {entry.subjectName}</option>)}</select></label>
        <span className={'status-badge ' + (subject?.batch.state === 'APPROVED' ? 'active' : subject?.batch.state === 'RETURNED' ? 'inactive' : '')}>{subject?.batch.state}</span>
      </section>
      {subject ? <div className="evaluation-stack">
        <section className="evaluation-card">
          <header><div><p className="eyebrow">{subject.examName}</p><h2>{subject.subjectCode} · {subject.subjectName}</h2><p>{subject.roster.length} approved registrations · Rule v{subject.ruleVersion} · input revision {subject.inputRevision}</p></div><span className={'status-badge ' + (subject.conductReady ? 'active' : 'inactive')}>{subject.conductReady ? 'CONDUCT READY' : 'ATTENDANCE PENDING'}</span></header>
          <div className="evaluation-assignment"><div><h3>Assigned examiner</h3><p>{subject.assignment?.facultyName ?? 'No examiner assigned'}</p></div>{subject.canAssign ? <div><label>Faculty<select value={selectedFacultyId} onChange={(event) => setFacultyId(event.target.value)}>{assignableFaculty.map((faculty) => <option value={faculty.id} key={faculty.id}>{faculty.name} · {faculty.code}</option>)}</select></label><AsyncButton className="secondary-button" disabled={isPending || !selectedFacultyId} loading={pendingAction === `assign-${subject.examSubjectId}`} loadingText="Saving…" onClick={() => void action(`assign-${subject.examSubjectId}`, () => client.assign(subject.examSubjectId, { facultyId: selectedFacultyId, expectedVersion: subject.assignment?.version ?? 0 }), 'Examiner assignment saved.')}>Save assignment</AsyncButton></div> : null}</div>
        </section>

        <section className="evaluation-card">
          <header><div><h2>Component marks</h2><p>{subject.components.map((component) => component.component + ' / ' + component.maximum).join(' · ')}</p></div></header>
          <div className="evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Student</th><th>Attendance</th>{subject.components.map((component) => <th key={component.component}>{component.component} / {component.maximum}</th>)}<th>Outcome</th></tr></thead><tbody>{subject.roster.map((row) => {
            const values = valuesFor(subject, drafts, row.registrationSubjectId)
            return <tr key={row.registrationSubjectId}><td><b>{row.studentName}</b><small>{row.rollNo}</small></td><td><span className={'status-badge ' + (row.attendanceState === 'PRESENT' || row.attendanceState === 'LATE' ? 'active' : row.attendanceState === 'ABSENT' ? 'inactive' : '')}>{row.attendanceState}</span></td>{subject.components.map((component) => {
              const absentBlank = row.attendanceState === 'ABSENT' && ['FINAL', 'EXTERNAL'].includes(component.component)
              return <td key={component.component}><input aria-label={component.component + ' marks for ' + row.studentName} type="number" min="0" max={component.maximum} step="0.01" value={absentBlank ? '' : values[component.component] ?? ''} disabled={isPending || !subject.canEdit || absentBlank} onChange={(event) => setMark(row.registrationSubjectId, component.component, event.target.value)} /></td>
            })}<td><span className={'status-badge ' + (rowOutcome(subject, row, drafts) === 'READY' ? 'active' : rowOutcome(subject, row, drafts) === 'INCOMPLETE' || rowOutcome(subject, row, drafts) === 'WITHHELD' ? 'inactive' : '')}>{rowOutcome(subject, row, drafts)}</span></td></tr>
          })}</tbody></table></div>
          <div className="evaluation-note">{subject.batch.reviewReason ? <span>Latest review: {subject.batch.reviewReason}</span> : <span>ABSENT requires a blank external or final mark. WITHHELD rows may retain draft marks.</span>}</div>
          <footer className="evaluation-actions">
            <span>{subject.assignment ? 'Examiner: ' + subject.assignment.facultyName : 'Assign an examiner before entry.'}</span>
            {subject.canEdit ? <><AsyncButton className="secondary-button" disabled={isPending} loading={pendingAction === `save-${subject.examSubjectId}`} loadingText="Saving…" onClick={() => void action(`save-${subject.examSubjectId}`, () => save(subject), 'Marks draft saved.', 'Marks were saved, but the latest marks data could not be refreshed. Retry refresh.')}>Save draft</AsyncButton><AsyncButton className="primary-button" disabled={isPending || !subject.conductReady || subject.batch.version === 0} loading={pendingAction === `submit-${subject.examSubjectId}`} loadingText="Submitting…" onClick={() => void action(`submit-${subject.examSubjectId}`, () => client.submit(subject.examSubjectId, { expectedVersion: subject.batch.version }), 'Marks submitted for independent review.', 'Marks were submitted, but the latest marks state could not be reloaded. Retry refresh.')}>Submit for review</AsyncButton></> : null}
            {subject.canReview ? <><AsyncButton className="secondary-button" disabled={isPending} loading={pendingAction === `return-${subject.examSubjectId}`} loadingText="Returning…" onClick={() => review(subject, false)}>Return</AsyncButton><AsyncButton className="primary-button" disabled={isPending || !subject.conductReady} loading={pendingAction === `approve-${subject.examSubjectId}`} loadingText="Approving…" onClick={() => review(subject, true)}>Approve batch</AsyncButton></> : null}
            {controller && subject.batch.state === 'APPROVED' ? <AsyncButton className="secondary-button" disabled={isPending} loading={pendingAction === `reopen-${subject.examSubjectId}`} loadingText="Reopening…" onClick={() => reopen(subject)}>Reopen with reason</AsyncButton> : null}
          </footer>
        </section>
      </div> : null}
    </>}
  </WorkspaceShell>
}
