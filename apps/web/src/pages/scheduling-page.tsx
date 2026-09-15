import { useCallback, useEffect, useState } from 'react'
import type { AcademicStructureSnapshot, AllocationPreview, ExamPaperRecord, SchedulingSnapshot } from '@entropix/contracts'
import { AcademicsApiClient } from '../academics/academics-client'
import { useAuth } from '../auth/auth-context'
import { SchedulingApiClient } from '../scheduling/scheduling-client'
import { WorkspaceShell } from './workspace-shell'
import { AsyncButton } from '../components/async-button'
import { apiErrorMessage } from '../feedback/api-error-message'
import { useNotification } from '../feedback/notification-context'
import { useAsyncAction } from '../feedback/use-async-action'

const errorMessage = (reason: unknown) => apiErrorMessage(reason, 'Timetable data could not be loaded.')
const localInput = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''
const displayTime = (value: string | null, timezone: string) => value ? new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled'

export function SchedulingPage({ client, academicClient }: { client: SchedulingApiClient; academicClient: AcademicsApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [snapshot, setSnapshot] = useState<SchedulingSnapshot | null>(null)
  const [academics, setAcademics] = useState<AcademicStructureSnapshot | null>(null)
  const [selectedExamId, setSelectedExamId] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { startsAt: string; endsAt: string }>>({})
  const [selectedHalls, setSelectedHalls] = useState<Record<string, string[]>>({})
  const [previews, setPreviews] = useState<Record<string, AllocationPreview>>({})
  const [hallForm, setHallForm] = useState({ campusId: '', code: 'HALL-A', name: 'Hall A', capacity: 30 })
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { notify } = useNotification()
  const { pendingAction, isPending, runMutationWithRefresh } = useAsyncAction()

  const load = useCallback(async () => {
    const next = await client.list()
    setSnapshot(next)
    setSelectedExamId((current) => next.exams.some((exam) => exam.examId === current) ? current : next.exams[0]?.examId ?? '')
  }, [client])
  useEffect(() => {
    let active = true
    void Promise.all([client.list(), academicClient.list()]).then(([schedule, academic]) => {
      if (!active) return
      setSnapshot(schedule); setAcademics(academic); setSelectedExamId(schedule.exams[0]?.examId ?? '')
      setHallForm((value) => ({ ...value, campusId: value.campusId || academic.campuses[0]?.id || '' })); setLoading(false)
    }, (reason: unknown) => { if (active) { setPageError(errorMessage(reason)); setLoading(false) } })
    return () => { active = false }
  }, [academicClient, client])
  const exam = snapshot?.exams.find((entry) => entry.examId === selectedExamId) ?? snapshot?.exams[0]

  async function action(key: string, operation: () => Promise<unknown>, success: string, refreshFailure = 'Changes were saved, but the latest timetable state could not be reloaded. Retry refresh.') {
    const result = await runMutationWithRefresh(key, operation, load)
    if (result.status === 'success') notify(success, 'success')
    else if (result.status === 'refresh-failed') { setPageError(refreshFailure); notify(refreshFailure, 'warning') }
    else if (result.status === 'mutation-failed') notify(apiErrorMessage(result.error, 'The timetable action could not be completed.'), 'error')
  }
  function draft(paper: ExamPaperRecord) { return drafts[paper.id] ?? { startsAt: localInput(paper.startsAt), endsAt: localInput(paper.endsAt) } }
  function hallsFor(paper: ExamPaperRecord) { return selectedHalls[paper.id] ?? paper.sittings.map((sitting) => sitting.hallId) }
  function toggleHall(paper: ExamPaperRecord, hallId: string) {
    const current = hallsFor(paper)
    setSelectedHalls((value) => ({ ...value, [paper.id]: current.includes(hallId) ? current.filter((id) => id !== hallId) : [...current, hallId] }))
    setPreviews((value) => { const next = { ...value }; delete next[paper.id]; return next })
  }
  if (!currentUser) return null
  return <WorkspaceShell
    currentUser={currentUser}
    active="schedule"
    onLogout={logout}
    onSwitchInstitution={switchInstitution}
    onSwitchRole={switchRole}
  >
    <div className="page-heading"><div><p className="eyebrow">Exam preparation</p><h1>Timetable &amp; halls</h1><p>Persisted paper times, deterministic seats, and publication readiness.</p></div>{exam ? <AsyncButton className="primary-button" disabled={isPending || !exam.readiness.ready || exam.state === 'SCHEDULE_PUBLISHED'} loading={pendingAction === `publish-${exam.examId}`} loadingText="Publishing…" onClick={() => void action(`publish-${exam.examId}`, () => client.publish(exam.examId, exam.version), 'Schedule published with a new revision.', 'Schedule was published, but the latest timetable state could not be reloaded. Retry refresh.')}>{exam.state === 'SCHEDULE_PUBLISHED' ? `Published · revision ${exam.scheduleRevision}` : 'Publish schedule'}</AsyncButton> : null}</div>
    {pageError ? <div className="academic-error" role="alert"><p>{pageError}</p><button type="button" className="secondary-button" onClick={() => { setPageError(null); setLoading(true); void load().then(() => setLoading(false), (reason: unknown) => { setPageError(errorMessage(reason)); setLoading(false) }) }}>Retry</button></div> : null}
    {loading ? <p>Loading timetable…</p> : !snapshot ? null : <>
      <section className="schedule-toolbar">
        <label>Exam<select value={exam?.examId ?? ''} onChange={(event) => setSelectedExamId(event.target.value)}>{snapshot.exams.map((entry) => <option value={entry.examId} key={entry.examId}>{entry.code} · {entry.name}</option>)}</select></label>
        <form onSubmit={(event) => { event.preventDefault(); void action('add-hall', () => client.createHall(hallForm), 'Hall saved and available for allocation.') }}>
          <label>Campus<select value={hallForm.campusId} onChange={(event) => setHallForm({ ...hallForm, campusId: event.target.value })}>{academics?.campuses.map((campus) => <option value={campus.id} key={campus.id}>{campus.name}</option>)}</select></label>
          <label>Hall code<input required maxLength={32} value={hallForm.code} onChange={(event) => setHallForm({ ...hallForm, code: event.target.value })} /></label>
          <label>Name<input required maxLength={160} value={hallForm.name} onChange={(event) => setHallForm({ ...hallForm, name: event.target.value })} /></label>
          <label>Capacity<input required type="number" min="1" value={hallForm.capacity} onChange={(event) => setHallForm({ ...hallForm, capacity: Number(event.target.value) })} /></label>
          <AsyncButton className="secondary-button" disabled={isPending || !hallForm.campusId} loading={pendingAction === 'add-hall'} loadingText="Adding…">Add hall</AsyncButton>
        </form>
      </section>
      {!exam ? <section className="exam-empty"><h2>No exam is ready for scheduling</h2><p>Close registration to move an exam into preparation.</p></section> : <>
        <section className="schedule-readiness"><div><b>{exam.readiness.scheduledPapers} / {exam.readiness.totalPapers}</b><span>Papers scheduled</span></div><div><b>{exam.readiness.allocatedCount} / {exam.readiness.approvedRosterCount}</b><span>Approved roster seats</span></div><div><b>{exam.readiness.unallocatedCount}</b><span>Unallocated</span></div><div><b>{exam.timezone}</b><span>Display timezone</span></div></section>
        {exam.papers.length === 0 ? <section className="exam-empty"><h2>Initialize the paper timetable</h2><p>This creates one written paper for every exam subject.</p><AsyncButton className="primary-button" disabled={isPending} loading={pendingAction === `initialize-${exam.examId}`} loadingText="Initializing…" onClick={() => void action(`initialize-${exam.examId}`, () => client.initialize(exam.examId), 'Paper timetable initialized.')}>Initialize timetable</AsyncButton></section> : <div className="schedule-stack">{exam.papers.map((paper) => {
          const values = draft(paper); const selected = hallsFor(paper); const preview = previews[paper.id]
          return <section className="schedule-paper" key={paper.id}>
            <header><div><p className="eyebrow">{paper.code}</p><h2>{paper.name}</h2><p>{displayTime(paper.startsAt, exam.timezone)}{paper.endsAt ? ` – ${new Intl.DateTimeFormat('en-IN', { timeZone: exam.timezone, timeStyle: 'short' }).format(new Date(paper.endsAt))}` : ''}</p></div><span className={`status-badge ${paper.allocatedCount === paper.approvedRosterCount && paper.startsAt ? 'active' : ''}`}>{paper.allocatedCount === paper.approvedRosterCount && paper.startsAt ? 'READY' : 'DRAFT'}</span></header>
            <div className="schedule-editor"><label>Starts<input type="datetime-local" value={values.startsAt} onChange={(event) => setDrafts({ ...drafts, [paper.id]: { ...values, startsAt: event.target.value } })} /></label><label>Ends<input type="datetime-local" value={values.endsAt} onChange={(event) => setDrafts({ ...drafts, [paper.id]: { ...values, endsAt: event.target.value } })} /></label><AsyncButton className="secondary-button" disabled={isPending || !values.startsAt || !values.endsAt} loading={pendingAction === `save-time-${paper.id}`} loadingText="Saving…" onClick={() => void action(`save-time-${paper.id}`, () => client.updatePaper(paper.id, { startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString(), expectedVersion: paper.version }), `${paper.code} schedule saved.`)}>Save time</AsyncButton></div>
            <div className="hall-choice"><h3>Hall allocation</h3><p>{paper.approvedRosterCount} approved students need a seat. Selected room order controls deterministic allocation.</p><div>{snapshot.halls.map((hall) => <label key={hall.id}><input type="checkbox" checked={selected.includes(hall.id)} onChange={() => toggleHall(paper, hall.id)} /> <b>{hall.code}</b> · {hall.name} · {hall.capacity} seats</label>)}</div><div className="exam-actions"><AsyncButton className="secondary-button" disabled={isPending || !paper.startsAt || selected.length === 0} loading={pendingAction === `preview-${paper.id}`} loadingText="Validating…" onClick={() => void action(`preview-${paper.id}`, async () => { const result = await client.preview(paper.id, { hallIds: selected, expectedVersion: paper.version }); setPreviews((value) => ({ ...value, [paper.id]: result })) }, 'Allocation preview validated; no seats were reserved.')}>Preview allocation</AsyncButton><AsyncButton className="primary-button" disabled={isPending || !preview || preview.unallocatedCount > 0} loading={pendingAction === `commit-${paper.id}`} loadingText="Committing…" onClick={() => void action(`commit-${paper.id}`, () => client.commit(paper.id, { hallIds: selected, expectedVersion: paper.version }), `${paper.code} seats committed atomically.`)}>Commit seats</AsyncButton></div></div>
            {preview ? <div className={`allocation-summary ${preview.unallocatedCount ? 'blocked' : ''}`}><b>{preview.assignments.length} / {preview.rosterCount} seats planned</b><span>{preview.totalCapacity} capacity · {preview.unallocatedCount} unallocated</span></div> : null}
            {paper.sittings.map((sitting) => <div className="seat-plan" key={sitting.id}><h3>{sitting.hallCode} · {sitting.hallName} <small>{sitting.seats.length} / {sitting.capacity}</small></h3><div className="seat-grid">{Array.from({ length: sitting.capacity }, (_, index) => { const seat = sitting.seats[index]; return <span className={seat ? '' : 'empty'} key={index}>{seat ? `${seat.seatNumber} · ${seat.rollNo}` : '—'}</span> })}</div></div>)}
            {paper.unallocatedStudents.length ? <div className="unallocated-list"><h3>Unallocated students</h3>{paper.unallocatedStudents.map((student) => <span key={student.registrationSubjectId}>{student.rollNo} · {student.studentName}</span>)}</div> : null}
          </section>
        })}</div>}
      </>}
    </>}
  </WorkspaceShell>
}
