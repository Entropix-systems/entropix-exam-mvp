import { useCallback, useEffect, useState } from 'react'
import type { AcademicStructureSnapshot, AllocationPreview, ExamPaperRecord, SchedulingSnapshot } from '@entropix/contracts'
import { AcademicsApiClient } from '../academics/academics-client'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { SchedulingApiClient } from '../scheduling/scheduling-client'
import { WorkspaceShell } from './workspace-shell'

const errorMessage = (reason: unknown) => reason instanceof AuthApiError ? reason.message : 'The timetable action could not be completed.'
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
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

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
    }, (reason: unknown) => { if (active) { setNotice(errorMessage(reason)); setLoading(false) } })
    return () => { active = false }
  }, [academicClient, client])
  const exam = snapshot?.exams.find((entry) => entry.examId === selectedExamId) ?? snapshot?.exams[0]

  async function action(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null)
    try { await operation(); await load(); setNotice(success) }
    catch (reason) { setNotice(errorMessage(reason)) }
    finally { setBusy(false) }
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
    <div className="page-heading"><div><p className="eyebrow">Exam preparation</p><h1>Timetable &amp; halls</h1><p>Persisted paper times, deterministic seats, and publication readiness.</p></div>{exam ? <button className="primary-button" disabled={busy || !exam.readiness.ready || exam.state === 'SCHEDULE_PUBLISHED'} onClick={() => void action(() => client.publish(exam.examId, exam.version), 'Schedule published with a new revision.')}>{exam.state === 'SCHEDULE_PUBLISHED' ? `Published · revision ${exam.scheduleRevision}` : 'Publish schedule'}</button> : null}</div>
    {notice ? <p className="form-message page-message">{notice}</p> : null}
    {loading ? <p>Loading timetable…</p> : !snapshot ? null : <>
      <section className="schedule-toolbar">
        <label>Exam<select value={exam?.examId ?? ''} onChange={(event) => setSelectedExamId(event.target.value)}>{snapshot.exams.map((entry) => <option value={entry.examId} key={entry.examId}>{entry.code} · {entry.name}</option>)}</select></label>
        <form onSubmit={(event) => { event.preventDefault(); void action(() => client.createHall(hallForm), 'Hall saved and available for allocation.') }}>
          <label>Campus<select value={hallForm.campusId} onChange={(event) => setHallForm({ ...hallForm, campusId: event.target.value })}>{academics?.campuses.map((campus) => <option value={campus.id} key={campus.id}>{campus.name}</option>)}</select></label>
          <label>Hall code<input value={hallForm.code} onChange={(event) => setHallForm({ ...hallForm, code: event.target.value })} /></label>
          <label>Name<input value={hallForm.name} onChange={(event) => setHallForm({ ...hallForm, name: event.target.value })} /></label>
          <label>Capacity<input type="number" min="1" value={hallForm.capacity} onChange={(event) => setHallForm({ ...hallForm, capacity: Number(event.target.value) })} /></label>
          <button className="secondary-button" disabled={busy || !hallForm.campusId}>Add hall</button>
        </form>
      </section>
      {!exam ? <section className="exam-empty"><h2>No exam is ready for scheduling</h2><p>Close registration to move an exam into preparation.</p></section> : <>
        <section className="schedule-readiness"><div><b>{exam.readiness.scheduledPapers} / {exam.readiness.totalPapers}</b><span>Papers scheduled</span></div><div><b>{exam.readiness.allocatedCount} / {exam.readiness.approvedRosterCount}</b><span>Approved roster seats</span></div><div><b>{exam.readiness.unallocatedCount}</b><span>Unallocated</span></div><div><b>{exam.timezone}</b><span>Display timezone</span></div></section>
        {exam.papers.length === 0 ? <section className="exam-empty"><h2>Initialize the paper timetable</h2><p>This creates one written paper for every exam subject.</p><button className="primary-button" disabled={busy} onClick={() => void action(() => client.initialize(exam.examId), 'Paper timetable initialized.')}>Initialize timetable</button></section> : <div className="schedule-stack">{exam.papers.map((paper) => {
          const values = draft(paper); const selected = hallsFor(paper); const preview = previews[paper.id]
          return <section className="schedule-paper" key={paper.id}>
            <header><div><p className="eyebrow">{paper.code}</p><h2>{paper.name}</h2><p>{displayTime(paper.startsAt, exam.timezone)}{paper.endsAt ? ` – ${new Intl.DateTimeFormat('en-IN', { timeZone: exam.timezone, timeStyle: 'short' }).format(new Date(paper.endsAt))}` : ''}</p></div><span className={`status-badge ${paper.allocatedCount === paper.approvedRosterCount && paper.startsAt ? 'active' : ''}`}>{paper.allocatedCount === paper.approvedRosterCount && paper.startsAt ? 'READY' : 'DRAFT'}</span></header>
            <div className="schedule-editor"><label>Starts<input type="datetime-local" value={values.startsAt} onChange={(event) => setDrafts({ ...drafts, [paper.id]: { ...values, startsAt: event.target.value } })} /></label><label>Ends<input type="datetime-local" value={values.endsAt} onChange={(event) => setDrafts({ ...drafts, [paper.id]: { ...values, endsAt: event.target.value } })} /></label><button className="secondary-button" disabled={busy || !values.startsAt || !values.endsAt} onClick={() => void action(() => client.updatePaper(paper.id, { startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString(), expectedVersion: paper.version }), `${paper.code} schedule saved.`)}>Save time</button></div>
            <div className="hall-choice"><h3>Hall allocation</h3><p>{paper.approvedRosterCount} approved students need a seat. Selected room order controls deterministic allocation.</p><div>{snapshot.halls.map((hall) => <label key={hall.id}><input type="checkbox" checked={selected.includes(hall.id)} onChange={() => toggleHall(paper, hall.id)} /> <b>{hall.code}</b> · {hall.name} · {hall.capacity} seats</label>)}</div><div className="exam-actions"><button className="secondary-button" disabled={busy || !paper.startsAt || selected.length === 0} onClick={() => void action(async () => { const result = await client.preview(paper.id, { hallIds: selected, expectedVersion: paper.version }); setPreviews((value) => ({ ...value, [paper.id]: result })) }, 'Allocation preview validated; no seats were reserved.')}>Preview allocation</button><button className="primary-button" disabled={busy || !preview || preview.unallocatedCount > 0} onClick={() => void action(() => client.commit(paper.id, { hallIds: selected, expectedVersion: paper.version }), `${paper.code} seats committed atomically.`)}>Commit seats</button></div></div>
            {preview ? <div className={`allocation-summary ${preview.unallocatedCount ? 'blocked' : ''}`}><b>{preview.assignments.length} / {preview.rosterCount} seats planned</b><span>{preview.totalCapacity} capacity · {preview.unallocatedCount} unallocated</span></div> : null}
            {paper.sittings.map((sitting) => <div className="seat-plan" key={sitting.id}><h3>{sitting.hallCode} · {sitting.hallName} <small>{sitting.seats.length} / {sitting.capacity}</small></h3><div className="seat-grid">{Array.from({ length: sitting.capacity }, (_, index) => { const seat = sitting.seats[index]; return <span className={seat ? '' : 'empty'} key={index}>{seat ? `${seat.seatNumber} · ${seat.rollNo}` : '—'}</span> })}</div></div>)}
            {paper.unallocatedStudents.length ? <div className="unallocated-list"><h3>Unallocated students</h3>{paper.unallocatedStudents.map((student) => <span key={student.registrationSubjectId}>{student.rollNo} · {student.studentName}</span>)}</div> : null}
          </section>
        })}</div>}
      </>}
    </>}
  </WorkspaceShell>
}
