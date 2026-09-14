import { useEffect, useState } from 'react'
import type {
  CurrentStudentDocumentMetadata,
  OwnPublishedResultRecord,
  OwnRegistrationRecord,
  OwnTimetableRecord,
  StudentPortalSnapshot,
} from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { StudentPortalApiClient } from '../student-portal/student-portal-client'
import { WorkspaceShell } from './workspace-shell'

type Preview = {
  document: CurrentStudentDocumentMetadata
  registration: OwnRegistrationRecord
  timetable?: OwnTimetableRecord
  result?: Exclude<OwnPublishedResultRecord, { outcome: 'WITHHELD' }>
}

const number = (value: string | null, suffix = '') =>
  value === null ? '—' : Number(value).toFixed(2) + suffix

function date(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(value))
}

function time(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(value))
}

function DocumentPreview({
  preview,
  snapshot,
  onClose,
}: {
  preview: Preview
  snapshot: StudentPortalSnapshot
  onClose(): void
}) {
  const admit = preview.document.kind === 'ADMIT_CARD'
  return <div className="portal-document-overlay" role="dialog" aria-modal="true" aria-label={`${preview.document.title} preview`}>
    <div className="portal-document-dialog">
      <section className="portal-paper portal-print-document">
        <p className="portal-paper-institution">{snapshot.student.institutionName}</p>
        <h2>{admit ? 'Admit Card' : 'Grade Card'}</h2>
        <p className="portal-paper-subtitle">{preview.registration.examName} · {preview.registration.academicYear}</p>
        <dl className="portal-paper-meta">
          <div><dt>Student</dt><dd>{snapshot.student.name}</dd></div>
          <div><dt>Roll number</dt><dd>{snapshot.student.rollNo}</dd></div>
          <div><dt>Programme / cohort</dt><dd>{snapshot.student.cohortName}</dd></div>
          <div><dt>Issue ID</dt><dd>{preview.document.issueId}</dd></div>
        </dl>
        {admit && preview.timetable ? <>
          <table className="portal-document-table"><thead><tr><th>Subject</th><th>Date &amp; local time</th><th>Hall / seat</th></tr></thead><tbody>
            {preview.timetable.papers.map((paper) => <tr key={paper.examPaperId}><td><b>{paper.subjectCode}</b><span>{paper.subjectName}</span></td><td>{date(paper.startsAt, preview.timetable!.timezone)}<span>{time(paper.startsAt, preview.timetable!.timezone)}–{time(paper.endsAt, preview.timetable!.timezone)}</span></td><td>{paper.hallCode} · {paper.hallName}<span>Seat {String(paper.seatNumber).padStart(2, '0')}</span></td></tr>)}
          </tbody></table>
          <p className="portal-paper-instruction">Bring your institution identity card and arrive 30 minutes before each paper.</p>
          <p className="portal-paper-version">Current timetable revision {preview.timetable.scheduleRevision}</p>
        </> : null}
        {!admit && preview.result ? <>
          <table className="portal-document-table"><thead><tr><th>Subject</th><th>Credits</th><th>Percentage</th><th>Outcome / grade</th></tr></thead><tbody>
            {preview.result.items.map((item) => <tr key={item.id}><td><b>{item.subjectCode}</b><span>{item.subjectName}</span></td><td>{item.credits}</td><td>{number(item.percentage, '%')}</td><td>{item.outcome}{item.grade ? ` · ${item.grade}` : ''}</td></tr>)}
          </tbody></table>
          <div className="portal-paper-summary"><span>Overall <b>{number(preview.result.percentage, '%')}</b></span><span>GPA <b>{number(preview.result.gpa)}</b></span><span>Outcome <b>{preview.result.outcome}</b></span></div>
          <p className="portal-paper-version">Publication version {preview.result.publicationVersion} · Rule v{preview.result.ruleVersion} · immutable result snapshot</p>
        </> : null}
      </section>
      <div className="portal-document-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={() => window.print()}>Print</button></div>
    </div>
  </div>
}

function Status({ value }: { value: string }) {
  const active = ['APPROVED', 'PASS', 'PUBLISHED', 'SERVER VERIFIED'].includes(value)
  const inactive = ['FAIL', 'WITHHELD'].includes(value)
  return <span className={`status-badge ${active ? 'active' : inactive ? 'inactive' : ''}`}>{value}</span>
}

export function StudentPortalPage({ client }: { client: StudentPortalApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [snapshot, setSnapshot] = useState<StudentPortalSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    let active = true
    void client.snapshot().then((next) => {
      if (!active) return
      setSnapshot(next)
      setLoading(false)
    }, (reason: unknown) => {
      if (!active) return
      setError(reason instanceof AuthApiError ? reason.message : 'The student portal could not be loaded.')
      setLoading(false)
    })
    return () => { active = false }
  }, [client])

  if (!currentUser) return null
  const registration = snapshot?.registrations[0] ?? null
  const timetable = registration ? snapshot?.timetables.find((entry) => entry.examId === registration.examId) ?? null : null
  const admitDocument = registration ? snapshot?.documents.find((entry) => entry.kind === 'ADMIT_CARD' && entry.examId === registration.examId) ?? null : null
  const result = snapshot?.result ?? null
  const gradeDocument = result ? snapshot?.documents.find((entry) => entry.kind === 'GRADE_CARD' && entry.examId === result.examId) ?? null : null

  function showAdmit() {
    if (snapshot && registration && timetable && admitDocument) {
      setPreview({ document: admitDocument, registration, timetable })
    }
  }

  function showGrade() {
    if (!snapshot || !result || result.outcome === 'WITHHELD' || !gradeDocument) return
    const resultRegistration = snapshot.registrations.find((entry) => entry.examId === result.examId)
    if (resultRegistration) setPreview({ document: gradeDocument, registration: resultRegistration, result })
  }

  return <WorkspaceShell currentUser={currentUser} active="student" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    {loading ? <p className="evaluation-empty">Loading student workspace…</p> : error ? <section className="evaluation-empty"><h2>Student portal unavailable</h2><p>{error}</p></section> : snapshot ? <>
      <div className="page-heading portal-heading"><div><p className="eyebrow">Student workspace</p><h1>Hello, {snapshot.student.name.split(' ')[0]}</h1><p>{snapshot.student.rollNo} · {snapshot.student.institutionName} · {snapshot.student.cohortName}</p></div><Status value="SERVER VERIFIED" /></div>
      <div className="portal-grid">
        <section className="portal-card"><header><div><p className="eyebrow">My examination</p><h2>{registration?.examName ?? 'No approved examination'}</h2></div>{registration ? <Status value={registration.state} /> : null}</header>
          {registration ? <div className="portal-card-body"><div className="portal-row"><span>Exam code</span><b>{registration.examCode}</b></div><div className="portal-row"><span>Subjects</span><b>{registration.subjects.map((subject) => subject.code).join(' · ')}</b></div><div className="portal-row"><span>First paper</span><b>{timetable?.papers[0] ? `${date(timetable.papers[0].startsAt, timetable.timezone)} · ${time(timetable.papers[0].startsAt, timetable.timezone)}` : 'Timetable not published'}</b></div><div className="portal-row"><span>Hall and seat</span><b>{timetable?.papers[0] ? `${timetable.papers[0].hallName} · Seat ${String(timetable.papers[0].seatNumber).padStart(2, '0')}` : 'Not allocated'}</b></div>{admitDocument && timetable ? <button type="button" className="primary-button portal-action" onClick={showAdmit}>View admit card</button> : <p className="evaluation-note">The admit card becomes available after the approved schedule and seat allocation are published.</p>}</div> : <div className="portal-card-body"><p>No approved registration is available for this student context.</p></div>}
        </section>

        <section className="portal-card"><header><div><p className="eyebrow">My result</p><h2>{result?.examName ?? 'Results are not available yet'}</h2></div>{result ? <Status value={result.outcome} /> : <Status value="NOT PUBLISHED" />}</header>
          {!result ? <div className="portal-card-body"><p>Your institution will notify you when results are published. Draft and withdrawn results remain private.</p></div> : result.outcome === 'WITHHELD' ? <div className="portal-card-body"><div className="portal-withheld"><b>Result withheld</b><p>{result.holdMessage}</p></div><p className="evaluation-note">No marks, components, percentage, GPA, or grade card are shown while this hold is active.</p></div> : <div className="portal-card-body"><div className="portal-result-stats"><div><b>{number(result.percentage, '%')}</b><span>Overall</span></div><div><b>{number(result.gpa)}</b><span>GPA</span></div></div><p className="evaluation-note">Published version {result.publicationVersion} · Rule v{result.ruleVersion}</p>{gradeDocument ? <button type="button" className="primary-button portal-action" onClick={showGrade}>View grade card</button> : null}</div>}
        </section>
      </div>

      <section className="portal-card portal-timetable"><header><div><p className="eyebrow">Current published schedule</p><h2>My timetable</h2></div>{timetable ? <span className="status-badge active">REVISION {timetable.scheduleRevision}</span> : null}</header>
        {timetable ? <div className="evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Subject</th><th>Date</th><th>Local time</th><th>Hall</th><th>Seat</th></tr></thead><tbody>{timetable.papers.map((paper) => <tr key={paper.examPaperId}><td><b>{paper.subjectCode}</b><small>{paper.subjectName}</small></td><td>{date(paper.startsAt, timetable.timezone)}</td><td>{time(paper.startsAt, timetable.timezone)}–{time(paper.endsAt, timetable.timezone)}</td><td>{paper.hallCode} · {paper.hallName}</td><td>{String(paper.seatNumber).padStart(2, '0')}</td></tr>)}</tbody></table></div> : <div className="portal-card-body"><p>Your approved timetable and seat will appear after the current schedule is published.</p></div>}
      </section>
      {preview ? <DocumentPreview preview={preview} snapshot={snapshot} onClose={() => setPreview(null)} /> : null}
    </> : null}
  </WorkspaceShell>
}
