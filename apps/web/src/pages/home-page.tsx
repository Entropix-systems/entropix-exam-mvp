import { useEffect, useState } from 'react'
import type { CurrentUserResponse } from '@entropix/contracts'
import { AuditApiClient, type DashboardExam, type DashboardSnapshot } from '../audit/audit-client'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { navigate } from '../auth/navigation'
import { attentionViewFor } from './home-attention'
import { WorkspaceShell } from './workspace-shell'

function message(reason: unknown): string {
  return reason instanceof AuthApiError ? reason.message : 'Overview data could not be loaded.'
}

function formatDate(value: string | null, timezone: string): string {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function ExamOverview({ exam, timezone, currentUser }: { exam: DashboardExam; timezone: string; currentUser: CurrentUserResponse }) {
  const ready = exam.steps.every((step) => step.status === 'COMPLETE')
  const attention = attentionViewFor(exam.steps, currentUser)
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
        <header><div><p className="eyebrow">Needs your attention · {exam.examCode}</p><h2>{attention.title}</h2></div><span className={'status-badge ' + (attention.status === 'READY' ? 'active' : attention.status === 'PENDING' ? 'inactive' : '')}>{attention.status}</span></header>
        <div className="reports-empty"><b>{attention.status === 'READY' ? 'No blockers' : 'Next readiness item'}</b><p>{attention.detail}</p></div>
        <button type="button" className="primary-button" onClick={() => navigate(attention.route)}>{attention.actionLabel}</button>
      </section>
    </div>
    <section className="overview-card">
      <header><div><p className="eyebrow">Published plan</p><h2>Scheduled examinations</h2></div></header>
      {exam.schedule.length === 0 ? <div className="reports-empty"><b>No papers scheduled</b><p>Configure and publish the timetable to populate this list.</p></div> : <div className="reports-table-wrap"><table><thead><tr><th>Paper</th><th>Date and time</th><th>Hall</th><th>Status</th></tr></thead><tbody>{exam.schedule.map((paper) => <tr key={paper.paperId}><td><b>{paper.subjectCode}</b><small>{paper.subjectName}</small></td><td>{formatDate(paper.startsAt, timezone)}</td><td>{paper.halls}</td><td><span className={'status-badge ' + (paper.startsAt && paper.halls !== 'Not allocated' ? 'active' : '')}>{paper.startsAt && paper.halls !== 'Not allocated' ? 'SCHEDULED' : 'PENDING'}</span></td></tr>)}</tbody></table></div>}
    </section>
  </>
}

export function HomePage({ client }: { client: AuditApiClient }) {
  const { currentUser, logout, switchInstitution, returnToPlatform, switchRole } = useAuth()
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
  const selectedTenantId = tenant?.tenantId ?? (currentUser.context.kind === 'PLATFORM' ? currentUser.context.tenantId : undefined)
  const exam = snapshot?.exams.find((entry) => entry.examId === selectedId) ?? snapshot?.exams[0]

  return <WorkspaceShell currentUser={currentUser} active="overview" onLogout={logout} onSwitchInstitution={switchInstitution} onReturnToPlatform={returnToPlatform} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">{currentUser.context.kind === 'PLATFORM' ? 'Platform Admin · Institution overview' : 'Examination control'}</p><h1>{snapshot?.institutionName ?? currentUser.institutions.find((institution) => institution.id === selectedTenantId)?.name ?? 'Institution overview'}</h1><p>{exam ? `${exam.academicYear} · ${exam.termName} · ${exam.examName}` : 'Authoritative readiness across the examination journey.'}</p></div>{exam && snapshot && snapshot.exams.length > 1 ? <label className="overview-exam-select">Exam<select value={exam.examId} onChange={(event) => setSelectedId(event.target.value)}>{snapshot.exams.map((entry) => <option value={entry.examId} key={entry.examId}>{entry.examCode} · {entry.examName}</option>)}</select></label> : null}</div>
    {loading ? <div className="reports-empty"><b>Loading overview…</b><p>Reading current registration, schedule, conduct, marks, and publication state.</p></div> : error ? <div className="reports-error" role="alert"><b>Overview unavailable</b><p>{error}</p><button type="button" className="secondary-button" onClick={load}>Try again</button></div> : !exam || !snapshot ? <div className="reports-empty"><b>No examinations yet</b><p>Create an exam to begin the readiness journey.</p></div> : <ExamOverview exam={exam} timezone={snapshot.timezone} currentUser={currentUser} />}
  </WorkspaceShell>
}
