import { useCallback, useEffect, useState } from 'react'
import type { AttendanceState, ConductSittingRecord, ConductSnapshot, IncidentKind } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import { ConductApiClient } from '../conduct/conduct-client'
import { WorkspaceShell } from './workspace-shell'

const attendanceStates: AttendanceState[] = ['NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE']
const message = (reason: unknown) => reason instanceof AuthApiError ? reason.message : 'The conduct action could not be completed.'
const displayTime = (value: string, timezone: string) => new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function ConductPage({ client }: { client: ConductApiClient }) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [snapshot, setSnapshot] = useState<ConductSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, Record<string, AttendanceState>>>({})
  const [facultyId, setFacultyId] = useState('')
  const [incidentKind, setIncidentKind] = useState<IncidentKind>('STUDENT')
  const [incidentStudentId, setIncidentStudentId] = useState('')
  const [incidentDescription, setIncidentDescription] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const next = await client.list()
    setSnapshot(next)
    setSelectedId((current) => next.sittings.some((sitting) => sitting.id === current) ? current : next.sittings[0]?.id ?? '')
    setFacultyId((current) => next.faculty.some((entry) => entry.id === current) ? current : next.faculty[0]?.id ?? '')
    setAttendanceDrafts({})
  }, [client])

  useEffect(() => {
    let active = true
    void client.list().then((next) => {
      if (!active) return
      setSnapshot(next); setSelectedId(next.sittings[0]?.id ?? ''); setFacultyId(next.faculty[0]?.id ?? ''); setLoading(false)
    }, (reason: unknown) => { if (active) { setNotice(message(reason)); setLoading(false) } })
    return () => { active = false }
  }, [client])

  async function action(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null)
    try { await operation(); await load(); setNotice(success) }
    catch (reason) { setNotice(message(reason)) }
    finally { setBusy(false) }
  }

  if (!currentUser) return null
  const controller = currentUser.context.kind === 'TENANT' && currentUser.context.grants.some((grant) => ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(grant.role))
  const sitting = snapshot?.sittings.find((entry) => entry.id === selectedId) ?? snapshot?.sittings[0]
  const draftFor = (current: ConductSittingRecord) => attendanceDrafts[current.id] ?? Object.fromEntries(current.attendance.rows.map((row) => [row.seatAssignmentId, row.state]))

  function respondDecline(dutyId: string) {
    const reason = window.prompt('Why are you declining this duty?')?.trim()
    if (reason) void action(() => client.decline(dutyId, { reason }), 'Duty declined. The controller can assign a replacement.')
  }

  function reopen(current: ConductSittingRecord) {
    const reason = window.prompt('Reason for reopening submitted attendance')?.trim()
    if (reason) void action(() => client.reopenAttendance(current.id, { expectedVersion: current.attendance.version, reason }), 'Attendance reopened with an audit reason.')
  }

  function dispose(incidentId: string, expectedVersion: number, disposition: 'CLEARED' | 'RETAIN_WITHHELD' | 'NO_RESULT_IMPACT') {
    const reason = window.prompt('Controller disposition reason')?.trim()
    if (reason) void action(() => client.disposeIncident(incidentId, { disposition, expectedVersion, reason }), disposition === 'RETAIN_WITHHELD' ? 'WITHHELD retained.' : 'Incident disposition saved.')
  }

  const ownDuty = sitting?.duties.find((duty) => !controller && ['PENDING', 'ACCEPTED'].includes(duty.state))
  const replacedDutyIds = new Set(sitting?.duties.flatMap((duty) => duty.replacesDutyId ? [duty.replacesDutyId] : []) ?? [])
  const declinedDuty = sitting?.duties.findLast((duty) => duty.state === 'DECLINED' && !replacedDutyIds.has(duty.id))
  const draft = sitting ? draftFor(sitting) : {}
  const notMarked = sitting?.attendance.rows.filter((row) => (draft[row.seatAssignmentId] ?? row.state) === 'NOT_MARKED').length ?? 0

  return <WorkspaceShell
    currentUser={currentUser}
    active="attendance"
    onLogout={logout}
    onSwitchInstitution={switchInstitution}
    onSwitchRole={switchRole}
  >
    <div className="page-heading"><div><p className="eyebrow">Examination day</p><h1>Duties &amp; attendance</h1><p>Assigned sittings, mobile roster capture, and result-hold disposition.</p></div></div>
    {notice ? <p className="form-message page-message">{notice}</p> : null}
    {loading ? <p className="conduct-empty">Loading assigned sittings…</p> : !snapshot || snapshot.sittings.length === 0 ? <section className="conduct-empty"><h2>No conduct sittings available</h2><p>Controllers see published sittings; invigilators see only their own assignments.</p></section> : <>
      <section className="conduct-toolbar"><label>Sitting<select value={sitting?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>{snapshot.sittings.map((entry) => <option value={entry.id} key={entry.id}>{entry.subjectCode} · {entry.hallCode} · {displayTime(entry.startsAt, entry.timezone)}</option>)}</select></label><span className={`status-badge ${sitting?.dutyReady ? 'active' : 'inactive'}`}>{sitting?.dutyReady ? 'DUTY READY' : 'INVIGILATOR REQUIRED'}</span></section>
      {sitting ? <div className="conduct-stack">
        <section className="conduct-card"><header><div><p className="eyebrow">{sitting.examCode}</p><h2>{sitting.subjectCode} · {sitting.subjectName}</h2><p>{sitting.hallCode} · {sitting.hallName} · {displayTime(sitting.startsAt, sitting.timezone)} – {new Intl.DateTimeFormat('en-IN', { timeZone: sitting.timezone, timeStyle: 'short' }).format(new Date(sitting.endsAt))}</p></div><span className={`status-badge ${sitting.attendance.state === 'SUBMITTED' ? 'active' : ''}`}>{sitting.attendance.state}</span></header>
          <div className="duty-panel"><div><h3>Assigned duty</h3>{sitting.duties.length ? sitting.duties.map((duty) => <p key={duty.id}><b>{duty.facultyName}</b> <span className={`status-badge ${duty.state === 'ACCEPTED' ? 'active' : duty.state === 'DECLINED' ? 'inactive' : ''}`}>{duty.state}</span>{duty.declineReason ? <small>{duty.declineReason}</small> : null}</p>) : <p>No duty assigned.</p>}</div>
            {controller ? <div className="duty-assignment"><label>Faculty<select value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>{snapshot.faculty.map((faculty) => <option value={faculty.id} key={faculty.id}>{faculty.name} · {faculty.departmentName}</option>)}</select></label><button className="primary-button" disabled={busy || !facultyId} onClick={() => void action(() => client.assign(sitting.id, { facultyId, ...(declinedDuty ? { replacesDutyId: declinedDuty.id } : {}) }), declinedDuty ? 'Replacement duty assigned.' : 'Duty assigned.')}>{declinedDuty ? 'Assign replacement' : 'Assign duty'}</button></div> : ownDuty?.state === 'PENDING' ? <div className="duty-actions"><button className="primary-button" disabled={busy} onClick={() => void action(() => client.accept(ownDuty.id), 'Duty accepted. Roster access is now enabled.')}>Accept</button><button className="secondary-button" disabled={busy} onClick={() => respondDecline(ownDuty.id)}>Decline</button></div> : null}
          </div>
        </section>

        <section className="conduct-card"><header><div><h2>Hall roster</h2><p>{sitting.attendance.rows.length} allocated students · {notMarked} not marked</p></div></header>
          {sitting.attendance.rows.length === 0 ? <p className="conduct-locked">Accept the assigned duty to access this roster.</p> : <><div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Seat</th><th>Student</th><th>Attendance</th></tr></thead><tbody>{sitting.attendance.rows.map((row) => <tr key={row.seatAssignmentId}><td>{String(row.seatNumber).padStart(2, '0')}</td><td><b>{row.studentName}</b><small>{row.rollNo}</small></td><td><select aria-label={`Attendance for ${row.studentName}`} disabled={busy || !sitting.canEditAttendance} value={draft[row.seatAssignmentId] ?? row.state} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [sitting.id]: { ...draft, [row.seatAssignmentId]: event.target.value as AttendanceState } }))}>{attendanceStates.map((state) => <option value={state} key={state}>{state.replace('_', ' ')}</option>)}</select></td></tr>)}</tbody></table></div>
            <footer className="conduct-actions"><span>{sitting.attendance.state === 'SUBMITTED' ? `Submitted ${displayTime(sitting.attendance.submittedAt!, sitting.timezone)}` : `${notMarked} rows block submission`}</span>{controller && sitting.attendance.state === 'SUBMITTED' ? <button className="secondary-button" disabled={busy} onClick={() => reopen(sitting)}>Reopen with reason</button> : <><button className="secondary-button" disabled={busy || !sitting.canEditAttendance} onClick={() => void action(() => client.saveAttendance(sitting.id, { expectedVersion: sitting.attendance.version, rows: sitting.attendance.rows.map((row) => ({ seatAssignmentId: row.seatAssignmentId, state: draft[row.seatAssignmentId] ?? row.state })) }), 'Attendance draft saved.')}>Save draft</button><button className="primary-button" disabled={busy || !sitting.canEditAttendance || notMarked > 0 || sitting.attendance.version === 0} onClick={() => void action(() => client.submitAttendance(sitting.id, { expectedVersion: sitting.attendance.version }), 'Attendance submitted and locked.')}>Submit attendance</button></>}</footer>
          </>}
        </section>

        <section className="conduct-card"><header><div><h2>Incidents &amp; result holds</h2><p>Open student-linked incidents immediately hold that student’s result.</p></div></header>
          {(controller || sitting.canEditAttendance) && sitting.attendance.rows.length ? <form className="incident-form" onSubmit={(event) => { event.preventDefault(); const registrationSubjectIds = incidentKind === 'STUDENT' && incidentStudentId ? [incidentStudentId] : []; void action(() => client.createIncident(sitting.id, { kind: incidentKind, description: incidentDescription, registrationSubjectIds }), 'Incident recorded.'); setIncidentDescription('') }}><label>Type<select value={incidentKind} onChange={(event) => setIncidentKind(event.target.value as IncidentKind)}><option value="STUDENT">Student-linked</option><option value="HALL">Hall-wide</option></select></label>{incidentKind === 'STUDENT' ? <label>Student<select required value={incidentStudentId} onChange={(event) => setIncidentStudentId(event.target.value)}><option value="">Select student</option>{sitting.attendance.rows.map((row) => <option value={row.registrationSubjectId} key={row.registrationSubjectId}>{row.rollNo} · {row.studentName}</option>)}</select></label> : null}<label className="incident-description">Description<textarea required minLength={5} value={incidentDescription} onChange={(event) => setIncidentDescription(event.target.value)} placeholder="Describe the observed issue" /></label><button className="primary-button" disabled={busy || incidentDescription.trim().length < 5}>Report incident</button></form> : null}
          <div className="incident-list">{sitting.incidents.length === 0 ? <p>No incidents recorded.</p> : sitting.incidents.map((incident) => <article key={incident.id}><div><b>{incident.kind === 'HALL' ? 'Hall-wide incident' : incident.affectedStudents.map((entry) => `${entry.rollNo} · ${entry.studentName}`).join(', ')}</b><p>{incident.description}</p><span className={`status-badge ${incident.disposition === 'CLEARED' || incident.disposition === 'NO_RESULT_IMPACT' ? 'active' : incident.disposition === 'RETAIN_WITHHELD' ? 'inactive' : ''}`}>{incident.disposition}</span>{incident.dispositionReason ? <small>{incident.dispositionReason}</small> : null}</div>{controller && incident.disposition === 'OPEN' ? <div className="incident-actions">{incident.affectedStudents.length ? <><button className="secondary-button" onClick={() => dispose(incident.id, incident.version, 'CLEARED')}>Clear hold</button><button className="secondary-button" onClick={() => dispose(incident.id, incident.version, 'RETAIN_WITHHELD')}>Retain WITHHELD</button></> : <button className="secondary-button" onClick={() => dispose(incident.id, incident.version, 'NO_RESULT_IMPACT')}>Close · no result impact</button>}</div> : null}</article>)}</div>
        </section>
      </div> : null}
    </>}
  </WorkspaceShell>
}
