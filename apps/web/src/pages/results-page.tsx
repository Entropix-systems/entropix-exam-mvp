import { useCallback, useEffect, useState } from 'react'
import type { CurrentStudentResultRecord, ResultRunRecord, ResultsSnapshot } from '@entropix/contracts'
import { useAuth } from '../auth/auth-context'
import { ResultsApiClient } from '../results/results-client'
import { WorkspaceShell } from './workspace-shell'
import { AsyncButton } from '../components/async-button'
import { apiErrorMessage } from '../feedback/api-error-message'
import { useNotification } from '../feedback/notification-context'
import { useAsyncAction } from '../feedback/use-async-action'

const errorMessage = (reason: unknown) => apiErrorMessage(reason, 'Results could not be loaded.')
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
  if (current.outcome === 'WITHHELD') return <section className="evaluation-card withheld-result"><header><div><p className="eyebrow">{current.examCode}</p><h2>{current.examName}</h2><p>Published version {current.publication.version} · Rule v{current.ruleVersion}</p></div><span className="status-badge inactive">WITHHELD</span></header><div className="result-blockers"><b>Result withheld</b><p>{current.holdMessage}</p></div><p className="evaluation-note">No marks, subject components, percentage, GPA, or grade card are available while this hold is active.</p></section>
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
      <div className="result-stats"><div><b>{current.outcome}</b><span>Outcome</span></div><div><b>{value(current.result.percentage, '%')}</b><span>Overall</span></div><div><b>{value(current.result.gpa)}</b><span>GPA</span></div><div><b>{current.result.items.length}</b><span>Subjects</span></div></div>
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
  const [pageError, setPageError] = useState<string | null>(null)
  const { notify } = useNotification()
  const { pendingAction, isPending, runMutationWithRefresh } = useAsyncAction()

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
      if (active) { setPageError(errorMessage(reason)); setLoading(false) }
    })
    return () => { active = false }
  }, [client, studentRole])

  async function action(key: string, operation: () => Promise<unknown>, success: string, refreshFailure = 'Changes were saved, but the latest result state could not be reloaded. Retry refresh.') {
    const result = await runMutationWithRefresh(key, operation, load)
    if (result.status === 'success') notify(success, 'success')
    else if (result.status === 'refresh-failed') { setPageError(refreshFailure); notify(refreshFailure, 'warning') }
    else if (result.status === 'mutation-failed') notify(apiErrorMessage(result.error, 'The result action could not be completed.'), 'error')
  }

  if (!currentUser) return null
  const exam = snapshot?.exams.find((entry) => entry.examId === selectedId) ?? snapshot?.exams[0]
  const run = exam?.candidateRun ?? null
  const hardBlockers = exam?.blockers.filter((blocker) => blocker.code !== 'PUBLICATION_ACTIVE') ?? []

  function publish() {
    if (!run || !window.confirm(`Publish result version for ${run.studentCount} students?`)) return
    void action(`publish-${run.id}`, () => client.publish(run.id), 'Results published. Only this current snapshot is visible to students.', 'Results were published, but the latest result state could not be reloaded. Retry refresh.')
  }

  function withdraw() {
    if (!exam) return
    const reason = window.prompt('Reason for withdrawing this publication')?.trim()
    if (reason) void action(`withdraw-${exam.examId}`, () => client.withdraw(exam.examId, { reason }), 'Publication withdrawn. Student visibility has been removed.', 'Results were withdrawn, but the latest result state could not be reloaded. Retry refresh.')
  }

  return <WorkspaceShell currentUser={currentUser} active="results" onLogout={logout} onSwitchInstitution={switchInstitution} onSwitchRole={switchRole}>
    <div className="page-heading"><div><p className="eyebrow">{studentRole ? 'Student workspace' : 'Controller approval'}</p><h1>{studentRole ? 'My result' : 'Result publication'}</h1><p>{studentRole ? 'Only your institution’s current published snapshot is shown.' : 'Review the immutable candidate run before releasing it to students.'}</p></div>{!studentRole && exam ? exam.currentPublication ? <AsyncButton className="danger-button" disabled={isPending} loading={pendingAction === `withdraw-${exam.examId}`} loadingText="Withdrawing…" onClick={withdraw}>Withdraw publication</AsyncButton> : <AsyncButton className="primary-button" disabled={isPending || hardBlockers.length > 0} loading={pendingAction === `compute-${exam.examId}`} loadingText="Computing…" onClick={() => void action(`compute-${exam.examId}`, () => client.compute(exam.examId), 'Current candidate result run computed.')}>Compute result run</AsyncButton> : null}</div>
    {pageError ? <div className="academic-error" role="alert"><p>{pageError}</p><button type="button" className="secondary-button" onClick={() => { setPageError(null); setLoading(true); void load().then(() => setLoading(false), (reason: unknown) => { setPageError(errorMessage(reason)); setLoading(false) }) }}>Retry refresh</button></div> : null}
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
          <footer className="evaluation-actions"><span>Computed {new Date(run.computedAt).toLocaleString()} · immutable snapshot</span>{!exam.currentPublication ? <AsyncButton className="primary-button" disabled={isPending || run.inputRevision !== exam.inputRevision || hardBlockers.length > 0} loading={pendingAction === `publish-${run.id}`} loadingText="Publishing…" onClick={publish}>Publish results</AsyncButton> : null}</footer>
        </section> : null}
      </div>
    </> : null}
  </WorkspaceShell>
}
