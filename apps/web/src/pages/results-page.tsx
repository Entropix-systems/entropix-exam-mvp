import { useCallback, useEffect, useState } from 'react'
import type { CurrentStudentResultRecord, ResultRunRecord, ResultsSnapshot } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { ResultsApiClient } from '../results/results-client'
import { WorkspaceShell } from './workspace-shell'

const errorMessage = (reason: unknown) => reason instanceof AuthApiError ? reason.message : 'The result action could not be completed.'
const value = (input: string | null, suffix = '') => input === null ? '—' : Number(input).toFixed(2) + suffix

function ResultTable({ run, studentOnly = false }: { run: ResultRunRecord; studentOnly?: boolean }) {
  return <div className="evaluation-table-wrap"><table className="evaluation-table"><thead><tr><th>Student</th><th>Outcome</th><th>Overall</th><th>GPA</th><th>Subject review</th></tr></thead><tbody>{run.students.map((student) => <tr key={student.id}>
    <td><b>{student.studentName}</b><small>{student.rollNo}</small></td>
    <td><span className={'status-badge ' + (student.outcome === 'PASS' ? 'active' : student.outcome === 'FAIL' || student.outcome === 'WITHHELD' ? 'inactive' : '')}>{student.outcome}</span></td>
    <td>{value(student.percentage, '%')}</td><td>{value(student.gpa)}</td>
    <td>{student.items.map((item) => <span className="result-subject" key={item.id}>{item.subjectCode}: {item.outcome}{item.percentage === null ? '' : ' · ' + value(item.percentage, '%')}</span>)}{studentOnly && student.reason ? <small>{student.reason}</small> : null}</td>
  </tr>)}</tbody></table></div>
}

function StudentResults({ current }: { current: CurrentStudentResultRecord | null }) {
  if (!current) return <section className="evaluation-empty"><h2>Results are not available yet</h2><p>Your institution will publish the approved result snapshot here. Draft and withdrawn results remain private.</p><span className="status-badge">NOT PUBLISHED</span></section>
  const run: ResultRunRecord = {
    id: current.publication.resultRunId,
    examId: current.examId,
    examCode: current.examCode,
    examName: current.examName,
    inputRevision: 0,
    ruleVersion: current.ruleVersion,
    checksum: '',
    studentCount: 1,
    itemCount: current.result.items.length,
    passCount: Number(current.result.outcome === 'PASS'),
    failCount: Number(current.result.outcome === 'FAIL'),
    absentCount: Number(current.result.outcome === 'ABSENT'),
    withheldCount: Number(current.result.outcome === 'WITHHELD'),
    computedAt: current.publication.publishedAt,
    students: [current.result],
  }
  return <div className="evaluation-stack">
    <section className="evaluation-card"><header><div><p className="eyebrow">{current.examCode}</p><h2>{current.examName}</h2><p>Published version {current.publication.version} · Rule v{current.ruleVersion}</p></div><span className="status-badge active">PUBLISHED</span></header>
      <div className="result-stats"><div><b>{current.result.outcome}</b><span>Outcome</span></div><div><b>{value(current.result.percentage, '%')}</b><span>Overall</span></div><div><b>{value(current.result.gpa)}</b><span>GPA</span></div><div><b>{current.result.items.length}</b><span>Subjects</span></div></div>
      <ResultTable run={run} studentOnly />
      <p className="evaluation-note">This is the current published snapshot. WITHHELD outcomes expose no marks, percentage, grade, or GPA.</p>
    </section>
  </div>
}

export function ResultsPage({ client }: { client: ResultsApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const studentRole = currentUser?.context.kind === 'TENANT' && currentUser.context.activeRole === 'STUDENT'
  const [snapshot, setSnapshot] = useState<ResultsSnapshot | null>(null)
  const [studentResult, setStudentResult] = useState<CurrentStudentResultRecord | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (studentRole) setStudentResult(await client.currentStudent())
    else {
      const next = await client.snapshot()
      setSnapshot(next)
      setSelectedId((current) => next.exams.some((exam) => exam.examId === current) ? current : next.exams[0]?.examId ?? '')
    }
  }, [client, studentRole])

  useEffect(() => {
    let active = true
    void (studentRole ? client.currentStudent() : client.snapshot()).then((next) => {
      if (!active) return
      if (studentRole) setStudentResult(next as CurrentStudentResultRecord | null)
      else {
        const results = next as ResultsSnapshot
        setSnapshot(results)
        setSelectedId(results.exams[0]?.examId ?? '')
      }
      setLoading(false)
    }, (reason: unknown) => {
      if (active) { setNotice(errorMessage(reason)); setLoading(false) }
    })
    return () => { active = false }
  }, [client, studentRole])

  async function action(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null)
    try { await operation(); await load(); setNotice(success) }
    catch (reason) { setNotice(errorMessage(reason)) }
    finally { setBusy(false) }
  }

  if (!currentUser) return null
  const exam = snapshot?.exams.find((entry) => entry.examId === selectedId) ?? snapshot?.exams[0]
  const run = exam?.candidateRun ?? null
  const hardBlockers = exam?.blockers.filter((blocker) => blocker.code !== 'PUBLICATION_ACTIVE') ?? []

  function publish() {
    if (!run || !window.confirm(`Publish result version for ${run.studentCount} students?`)) return
    void action(() => client.publish(run.id), 'Results published. Only this current snapshot is visible to students.')
  }

  function withdraw() {
    if (!exam) return
    const reason = window.prompt('Reason for withdrawing this publication')?.trim()
    if (reason) void action(() => client.withdraw(exam.examId, { reason }), 'Publication withdrawn. Student visibility has been removed.')
  }

  return <WorkspaceShell currentUser={currentUser} active="results" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">{studentRole ? 'Student workspace' : 'Controller approval'}</p><h1>{studentRole ? 'My result' : 'Result publication'}</h1><p>{studentRole ? 'Only your institution’s current published snapshot is shown.' : 'Review the immutable candidate run before releasing it to students.'}</p></div>{!studentRole && exam ? exam.currentPublication ? <button className="danger-button" disabled={busy} onClick={withdraw}>Withdraw publication</button> : <button className="primary-button" disabled={busy || hardBlockers.length > 0} onClick={() => void action(() => client.compute(exam.examId), 'Current candidate result run computed.')}>Compute result run</button> : null}</div>
    {notice ? <p className="form-message page-message">{notice}</p> : null}
    {loading ? <p className="evaluation-empty">Loading result workspace…</p> : studentRole ? <StudentResults current={studentResult} /> : !snapshot || snapshot.exams.length === 0 ? <section className="evaluation-empty"><h2>No result-ready exams</h2><p>Scheduled or evaluation exams will appear here.</p></section> : exam ? <>
      <section className="evaluation-toolbar"><label>Exam<select value={exam.examId} onChange={(event) => setSelectedId(event.target.value)}>{snapshot.exams.map((entry) => <option key={entry.examId} value={entry.examId}>{entry.examCode} · {entry.examName}</option>)}</select></label><span className={'status-badge ' + (exam.currentPublication ? 'active' : '')}>{exam.currentPublication ? 'PUBLISHED v' + exam.currentPublication.version : run ? 'CANDIDATE' : 'NOT COMPUTED'}</span></section>
      <div className="evaluation-stack">
        <section className="evaluation-card"><header><div><p className="eyebrow">Readiness checklist</p><h2>{exam.examName}</h2><p>Rule v{exam.ruleVersion} · input revision {exam.inputRevision}</p></div><span className={'status-badge ' + (hardBlockers.length === 0 ? 'active' : 'inactive')}>{hardBlockers.length === 0 ? 'READY' : 'BLOCKED'}</span></header>
          <div className="result-stats"><div><b>{exam.studentCount}</b><span>Students</span></div><div><b>{exam.approvedSubjectCount}/{exam.subjectCount}</b><span>Approved subjects</span></div><div><b>{run?.itemCount ?? 0}</b><span>Subject outcomes</span></div><div><b>{run?.withheldCount ?? 0}</b><span>Held students</span></div></div>
          {hardBlockers.length > 0 ? <div className="result-blockers"><b>Result run blocked.</b>{hardBlockers.map((blocker) => <p key={blocker.code}>{blocker.message} ({blocker.count})</p>)}</div> : <p className="result-ready">{exam.currentPublication ? `Publication v${exam.currentPublication.version} is visible in the student portal.` : 'All required conduct and marks data is approved. ABSENT and WITHHELD remain explicit nonnumeric outcomes.'}</p>}
        </section>
        {run ? <section className="evaluation-card"><header><div><p className="eyebrow">Candidate result register</p><h2>Sample review</h2><p>{run.studentCount} students · {run.itemCount} subject outcomes · checksum {run.checksum.slice(0, 12)}</p></div><span className="status-badge">REVISION {run.inputRevision}</span></header>
          <div className="result-stats"><div><b>{run.passCount}</b><span>Pass</span></div><div><b>{run.failCount}</b><span>Fail</span></div><div><b>{run.absentCount}</b><span>Absent</span></div><div><b>{run.withheldCount}</b><span>Withheld</span></div></div>
          <ResultTable run={run} />
          <footer className="evaluation-actions"><span>Computed {new Date(run.computedAt).toLocaleString()} · immutable snapshot</span>{!exam.currentPublication ? <button className="primary-button" disabled={busy || run.inputRevision !== exam.inputRevision || hardBlockers.length > 0} onClick={publish}>Publish results</button> : null}</footer>
        </section> : null}
      </div>
    </> : null}
  </WorkspaceShell>
}
