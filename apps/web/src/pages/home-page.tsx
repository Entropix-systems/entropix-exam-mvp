import { useEffect, useState } from 'react'
import { AuditApiClient, type DashboardExam, type DashboardSnapshot } from '../audit/audit-client'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { navigate } from '../auth/navigation'
import { WorkspaceShell } from './workspace-shell'

function message(reason: unknown): string {
  return reason instanceof AuthApiError ? `${reason.message}${reason.requestId ? ` · Request ${reason.requestId}` : ''}` : 'Overview data could not be loaded.'
}

function formatDate(value: string | null, timezone: string): string {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function ExamOverview({ exam, timezone, canManageResults }: { exam: DashboardExam; timezone: string; canManageResults: boolean }) {
  const ready = exam.steps.every((step) => step.status !== 'PENDING')
  return <>
    <div className="overview-stats">
      <div><span>Registered students</span><b>{exam.registeredStudents}</b><small>Approved registrations</small></div>
      <div><span>Scheduled papers</span><b>{exam.scheduledPapers}/{exam.totalPapers}</b><small>{exam.allocatedSeats}/{exam.requiredSubjectSeats} subject seats allocated</small></div>
      <div><span>Approved subjects</span><b>{exam.approvedSubjects}/{exam.totalPapers}</b><small>Independent review required</small></div>
      <div><span>Student holds</span><b>{exam.studentHolds}</b><small>{exam.openIncidents} open incident(s)</small></div>
    </div>
    <div className="overview-grid">
      <section className="overview-card">
        <header><div><p className="eyebrow">Readiness checklist</p><h2>Exam readiness</h2></div><span className={'status-badge ' + (ready ? 'active' : 'inactive')}>{ready ? 'READY' : 'ACTION NEEDED'}</span></header>
        <div className="readiness-list">{exam.steps.map((step, index) => <div className={'readiness-row ' + step.status.toLowerCase()} key={step.code}><span className="readiness-number">{step.status === 'COMPLETE' ? '✓' : index + 1}</span><div><b>{step.label}</b><small>{step.detail}</small></div><span className={'status-badge ' + (step.status === 'COMPLETE' ? 'active' : step.status === 'PENDING' ? 'inactive' : '')}>{step.status}</span></div>)}</div>
      </section>
      <section className="overview-card">
        <header><div><p className="eyebrow">Needs your attention</p><h2>{exam.examCode}</h2></div></header>
        {exam.attention.length > 0 ? <ul className="attention-list">{exam.attention.map((item) => <li key={item}>{item}</li>)}</ul> : <div className="reports-empty"><b>No blockers</b><p>This exam has a current run and publication.</p></div>}
        {canManageResults ? <button type="button" className="primary-button" onClick={() => navigate('/results')}>Open result checklist</button> : null}
      </section>
    </div>
    <section className="overview-card">
      <header><div><p className="eyebrow">Published plan</p><h2>Scheduled examinations</h2></div></header>
      {exam.schedule.length === 0 ? <div className="reports-empty"><b>No papers scheduled</b><p>Configure and publish the timetable to populate this list.</p></div> : <div className="reports-table-wrap"><table><thead><tr><th>Paper</th><th>Date and time</th><th>Hall</th><th>Status</th></tr></thead><tbody>{exam.schedule.map((paper) => <tr key={paper.paperId}><td><b>{paper.subjectCode}</b><small>{paper.subjectName}</small></td><td>{formatDate(paper.startsAt, timezone)}</td><td>{paper.halls}</td><td><span className={'status-badge ' + (paper.startsAt && paper.halls !== 'Not allocated' ? 'active' : '')}>{paper.startsAt && paper.halls !== 'Not allocated' ? 'SCHEDULED' : 'PENDING'}</span></td></tr>)}</tbody></table></div>}
    </section>
  </>
}

export function HomePage({ client }: { client: AuditApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true); setError(null)
    void client.dashboard().then((next) => {
      setSnapshot(next)
      setSelectedId((current) => next.exams.some((exam) => exam.examId === current) ? current : next.exams[0]?.examId ?? '')
      setLoading(false)
    }, (reason: unknown) => { setError(message(reason)); setLoading(false) })
  }

  useEffect(() => {
    let active = true
    void client.dashboard().then((next) => {
      if (!active) return
      setSnapshot(next)
      setSelectedId(next.exams[0]?.examId ?? '')
      setLoading(false)
    }, (reason: unknown) => {
      if (!active) return
      setError(message(reason)); setLoading(false)
    })
    return () => { active = false }
  }, [client])
  if (!currentUser) return null
  const tenant = currentUser.context.kind === 'TENANT' ? currentUser.context : null
  const exam = snapshot?.exams.find((entry) => entry.examId === selectedId) ?? snapshot?.exams[0]
  const canManageResults = Boolean(tenant && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(tenant.activeRole))

  return <WorkspaceShell currentUser={currentUser} active="overview" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">Examination control</p><h1>{snapshot?.institutionName ?? currentUser.institutions.find((institution) => institution.id === tenant?.tenantId)?.name ?? 'Institution overview'}</h1><p>{exam ? `${exam.academicYear} · ${exam.termName} · ${exam.examName}` : 'Authoritative readiness across the examination journey.'}</p></div>{exam && snapshot && snapshot.exams.length > 1 ? <label className="overview-exam-select">Exam<select value={exam.examId} onChange={(event) => setSelectedId(event.target.value)}>{snapshot.exams.map((entry) => <option value={entry.examId} key={entry.examId}>{entry.examCode} · {entry.examName}</option>)}</select></label> : null}</div>
    {loading ? <div className="reports-empty"><b>Loading overview…</b><p>Reading current registration, schedule, conduct, marks, and publication state.</p></div> : error ? <div className="reports-error" role="alert"><b>Overview unavailable</b><p>{error}</p><button type="button" className="secondary-button" onClick={load}>Try again</button></div> : !exam || !snapshot ? <div className="reports-empty"><b>No examinations yet</b><p>Create an exam to begin the readiness journey.</p></div> : <ExamOverview exam={exam} timezone={snapshot.timezone} canManageResults={canManageResults} />}
  </WorkspaceShell>
}
