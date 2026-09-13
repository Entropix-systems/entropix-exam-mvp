import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AcademicStructureSnapshot, ExamCreateInput, ExamRecord, RegistrationRecord, ResultRuleInput } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { AcademicsApiClient } from '../academics/academics-client'
import { ExamsApiClient } from '../exams/exams-client'
import { WorkspaceShell } from './workspace-shell'

const defaultRule: ResultRuleInput = {
  components: [
    { component: 'INTERNAL', maximum: 40, weight: 40, minimumPassPercentage: 40 },
    { component: 'EXTERNAL', maximum: 60, weight: 60, minimumPassPercentage: 40 },
  ],
  totalPassPercentage: 40,
  gradeBands: [
    { grade: 'F', minInclusive: 0, maxExclusive: 40, points: 0 },
    { grade: 'C', minInclusive: 40, maxExclusive: 60, points: 6 },
    { grade: 'B', minInclusive: 60, maxExclusive: 80, points: 8 },
    { grade: 'A', minInclusive: 80, maxInclusive: 100, points: 10 },
  ],
}
const message = (reason: unknown, fallback: string) => reason instanceof AuthApiError ? reason.message : fallback
const dateTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

export function ExamsPage({ client, academicClient }: { client: ExamsApiClient; academicClient: AcademicsApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [exams, setExams] = useState<readonly ExamRecord[]>([])
  const [academics, setAcademics] = useState<AcademicStructureSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [draftSelections, setDraftSelections] = useState<Record<string, string[]>>({})
  const [form, setForm] = useState({ code: 'SEM3-2026', name: 'Semester 3 Examination', termId: '', mode: 'APPLICATION' as 'APPLICATION' | 'AUTO_ENROL', opens: '2026-09-01T00:00', closes: '2026-12-31T23:59', subjectIds: [] as string[] })
  const controller = currentUser?.context.kind === 'TENANT' && (currentUser.context.activeRole === 'EXAM_CONTROLLER' || currentUser.context.activeRole === 'INSTITUTION_ADMIN')
  const student = currentUser?.context.kind === 'TENANT' && currentUser.context.activeRole === 'STUDENT'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const examState = await client.list()
      setExams(examState.exams); setError(null)
    } catch (reason) { setError(message(reason, 'Exams could not be loaded.')) }
    finally { setLoading(false) }
  }, [client])
  useEffect(() => {
    let active = true
    void Promise.all([client.list(), academicClient.list()]).then(
      ([examState, academicState]) => {
        if (!active) return
        setExams(examState.exams); setAcademics(academicState); setError(null); setLoading(false)
        if (academicState.terms[0]) setForm((value) => value.termId ? value : ({ ...value, termId: academicState.terms[0]!.id, subjectIds: academicState.subjects.filter((subject) => subject.programId === academicState.terms[0]!.programId).map((subject) => subject.id) }))
      },
      (reason: unknown) => { if (active) { setError(message(reason, 'Exams could not be loaded.')); setLoading(false) } },
    )
    return () => { active = false }
  }, [academicClient, client])

  const availableSubjects = useMemo(() => {
    const term = academics?.terms.find((entry) => entry.id === form.termId)
    return academics?.subjects.filter((entry) => entry.programId === term?.programId) ?? []
  }, [academics, form.termId])

  async function action(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null)
    try { await operation(); setNotice(success); await load() }
    catch (reason) { setNotice(message(reason, 'The action could not be completed.')) }
    finally { setBusy(false) }
  }
  async function createExam() {
    const input: ExamCreateInput = { termId: form.termId, code: form.code, name: form.name, registrationMode: form.mode, registrationOpensAt: new Date(form.opens).toISOString(), registrationClosesAt: new Date(form.closes).toISOString(), subjectIds: form.subjectIds, rule: defaultRule }
    await action(() => client.create(input), 'Exam created with grading rule v1.')
    setShowCreate(false)
  }
  function selectionFor(exam: ExamRecord, registration: RegistrationRecord | undefined) {
    return draftSelections[exam.id] ?? registration?.subjects.map((entry) => entry.examSubjectId) ?? exam.subjects.map((entry) => entry.id)
  }
  function toggleExamSubject(exam: ExamRecord, id: string, registration: RegistrationRecord | undefined) {
    const selected = selectionFor(exam, registration)
    setDraftSelections((value) => ({ ...value, [exam.id]: selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id] }))
  }
  if (!currentUser) return null
  return (
    <WorkspaceShell
      currentUser={currentUser}
      active="exams"
      onLogout={logout}
      onSwitchInstitution={switchInstitution}
      onSwitchRole={switchRole}
    >
      <div className="page-heading"><div><p className="eyebrow">Exam administration</p><h1>Exams &amp; registration</h1><p>Persisted application and school auto-enrol workflows.</p></div>{controller ? <button className="primary-button" type="button" onClick={() => setShowCreate(true)}>Create exam</button> : null}</div>
      {notice ? <p className="form-message page-message">{notice}</p> : null}
      {error ? <div className="academic-error" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => void load()}>Retry</button></div> : null}
      {loading ? <p className="academic-loading">Loading exams…</p> : exams.length === 0 ? <section className="exam-empty"><h2>No exams yet</h2><p>Create the first exam to begin registration.</p></section> : (
        <div className="exam-stack">{exams.map((exam) => {
          const registration = exam.registrations[0]
          const pending = exam.registrations.filter((entry) => entry.state === 'SUBMITTED')
          return <section className="exam-card" key={exam.id}>
            <header><div><p className="eyebrow">{exam.code}</p><h2>{exam.name}</h2><p>{exam.registrationMode === 'AUTO_ENROL' ? 'School auto-enrol' : 'Student application'} · closes {dateTime(exam.registrationClosesAt)}</p></div><span className={`status-badge ${exam.state === 'REGISTRATION_OPEN' ? 'active' : ''}`}>{exam.state.replaceAll('_', ' ')}</span></header>
            <div className="exam-stats"><div><b>{exam.subjects.length}</b><span>Subjects</span></div><div><b>v{exam.ruleVersion.version}</b><span>{exam.ruleVersion.frozenAt ? 'Rule frozen' : 'Draft rule'}</span></div><div><b>{exam.registrations.filter((entry) => entry.state === 'APPROVED').length}</b><span>Approved</span></div><div><b>{pending.length}</b><span>Awaiting review</span></div></div>
            <div className="exam-subjects"><h3>Subject configuration</h3>{exam.subjects.map((subject) => <span key={subject.id}><b>{subject.code}</b> {subject.name} · {subject.credits} credits</span>)}</div>
            {controller ? <div className="exam-actions">
              {exam.state === 'DRAFT' ? <button disabled={busy} className="primary-button" onClick={() => void action(() => client.open(exam.id), 'Registration opened and rule version frozen.')}>Open registration</button> : null}
              {exam.state === 'REGISTRATION_OPEN' ? <button disabled={busy} className="secondary-button" onClick={() => void action(() => client.close(exam.id), 'Registration closed.')}>Close registration</button> : null}
              {exam.state === 'REGISTRATION_OPEN' && exam.registrationMode === 'AUTO_ENROL' ? <button disabled={busy} className="primary-button" onClick={() => void action(() => client.autoEnrol(exam.id), 'Eligible Cedar students auto-enrolled.')}>Auto-enrol eligible students</button> : null}
            </div> : null}
            {student && exam.registrationMode === 'APPLICATION' ? <div className="student-application"><h3>My application</h3><div className="exam-checks">{exam.subjects.map((subject) => <label key={subject.id}><input type="checkbox" disabled={registration?.state === 'SUBMITTED' || registration?.state === 'APPROVED'} checked={selectionFor(exam, registration).includes(subject.id)} onChange={() => toggleExamSubject(exam, subject.id, registration)} /> {subject.code} · {subject.name}</label>)}</div><div className="exam-actions"><span className={`status-badge ${registration?.state === 'APPROVED' ? 'active' : ''}`}>{registration?.state ?? 'NOT STARTED'}</span>{(!registration || registration.state === 'DRAFT' || registration.state === 'REJECTED') ? <button disabled={busy || exam.state !== 'REGISTRATION_OPEN'} className="secondary-button" onClick={() => void action(() => client.saveDraft(exam.id, { examSubjectIds: selectionFor(exam, registration) }), 'Application draft saved.')}>Save draft</button> : null}{registration && (registration.state === 'DRAFT' || registration.state === 'REJECTED') ? <button disabled={busy} className="primary-button" onClick={() => void action(() => client.submit(registration.id), 'Application submitted for review.')}>Submit application</button> : null}</div>{registration?.decisionReason ? <p className="decision-note">Decision: {registration.decisionReason}</p> : null}</div> : null}
            {controller && exam.registrationMode === 'APPLICATION' && exam.registrations.length ? <div className="registration-list"><h3>Application review</h3><div className="membership-table-wrap"><table className="membership-table"><thead><tr><th>Student</th><th>Subjects</th><th>Eligibility</th><th>Decision</th></tr></thead><tbody>{exam.registrations.map((entry) => <tr key={entry.id}><td><strong>{entry.student.name}</strong><small>{entry.student.rollNo}</small></td><td>{entry.subjects.map((subject) => subject.code).join(', ')}</td><td><span className={`status-badge ${entry.eligibilitySnapshot?.eligible ? 'active' : ''}`}>{entry.eligibilitySnapshot?.eligible ? 'ELIGIBLE' : entry.controllerEligible ? 'CHECK ON SUBMIT' : 'INELIGIBLE'}</span></td><td><span className={`status-badge ${entry.state === 'APPROVED' ? 'active' : ''}`}>{entry.state}</span>{entry.state === 'SUBMITTED' ? <div className="inline-actions"><button disabled={busy} className="danger-button" onClick={() => { const reason = window.prompt('Rejection reason'); if (reason) void action(() => client.reject(entry.id, reason), 'Application rejected.') }}>Reject</button><button disabled={busy} className="primary-button" onClick={() => void action(() => client.approve(entry.id), 'Application approved; roster IDs are now stable.')}>Approve</button></div> : null}</td></tr>)}</tbody></table></div></div> : null}
          </section>
        })}</div>
      )}
      {showCreate ? <div className="modal-backdrop" role="presentation"><section className="exam-dialog" role="dialog" aria-modal="true" aria-labelledby="create-exam-title"><header><div><p className="eyebrow">Persisted exam setup</p><h2 id="create-exam-title">Create exam</h2></div><button className="icon-button" aria-label="Close" onClick={() => setShowCreate(false)}>×</button></header><div className="exam-form"><label>Exam code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label><label>Exam name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Term<select value={form.termId} onChange={(event) => { const term = academics?.terms.find((entry) => entry.id === event.target.value); setForm({ ...form, termId: event.target.value, subjectIds: academics?.subjects.filter((subject) => subject.programId === term?.programId).map((subject) => subject.id) ?? [] }) }}>{academics?.terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label><label>Registration mode<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as typeof form.mode })}><option value="APPLICATION">Student application</option><option value="AUTO_ENROL">School auto-enrol</option></select></label><label>Opens<input type="datetime-local" value={form.opens} onChange={(event) => setForm({ ...form, opens: event.target.value })} /></label><label>Closes<input type="datetime-local" value={form.closes} onChange={(event) => setForm({ ...form, closes: event.target.value })} /></label><fieldset><legend>Exam subjects</legend>{availableSubjects.map((subject) => <label key={subject.id}><input type="checkbox" checked={form.subjectIds.includes(subject.id)} onChange={() => setForm({ ...form, subjectIds: form.subjectIds.includes(subject.id) ? form.subjectIds.filter((id) => id !== subject.id) : [...form.subjectIds, subject.id] })} /> {subject.code} · {subject.name}</label>)}</fieldset><p className="decision-note">Result rule: 40 internal / 60 external, 40% total and component minimum. It becomes immutable when registration opens.</p></div><footer><button className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-button" disabled={busy || !form.termId || form.subjectIds.length === 0} onClick={() => void createExam()}>Create exam</button></footer></section></div> : null}
    </WorkspaceShell>
  )
}
