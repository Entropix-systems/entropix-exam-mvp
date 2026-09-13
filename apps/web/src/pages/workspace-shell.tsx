import type { PropsWithChildren } from 'react'
import type { CurrentUserResponse } from '@entropix/contracts'
import { navigate } from '../auth/navigation'
import { canManageIdentity } from '../identity/identity-access'

export function WorkspaceShell({
  currentUser,
  active,
  onLogout,
  children,
}: PropsWithChildren<{
  currentUser: CurrentUserResponse
  active: 'overview' | 'setup-access' | 'students' | 'exams' | 'schedule' | 'attendance'
  onLogout(): Promise<void>
}>) {
  const tenantContext = currentUser.context.kind === 'TENANT'
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          Examination ERP
          <small>ENTROPIX SYSTEMS</small>
        </div>
        <div className="tenant-box">
          <small>INSTITUTION WORKSPACE</small>
          <strong>{tenantContext ? 'Current institution' : 'Platform context'}</strong>
        </div>
        <p className="nav-label">EXAMINATION WORKSPACE</p>
        <nav aria-label="Primary navigation">
          <button
            type="button"
            className={active === 'overview' ? 'active' : ''}
            onClick={() => navigate('/')}
          >
            <span aria-hidden="true">◫</span> Overview
          </button>
          {canManageIdentity(currentUser) ? (
            <button
              type="button"
              className={active === 'setup-access' ? 'active' : ''}
              onClick={() => navigate('/setup-access')}
            >
              <span aria-hidden="true">⚙</span> Setup &amp; access
            </button>
          ) : null}
          {currentUser.context.kind === 'TENANT' && currentUser.context.grants.some(
            (grant) => ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(grant.role),
          ) ? (
            <button type="button" className={active === 'schedule' ? 'active' : ''} onClick={() => navigate('/schedule')}>
              <span aria-hidden="true">▦</span> Timetable &amp; halls
            </button>
          ) : null}
          {currentUser.context.kind === 'TENANT' && currentUser.context.grants.some(
            (grant) => ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'INVIGILATOR'].includes(grant.role),
          ) ? (
            <button type="button" className={active === 'attendance' ? 'active' : ''} onClick={() => navigate('/attendance')}>
              <span aria-hidden="true">✓</span> Duties &amp; attendance
            </button>
          ) : null}
          {currentUser.context.kind === 'TENANT' && currentUser.context.grants.some(
            (grant) => ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY', 'STUDENT', 'AUDITOR'].includes(grant.role),
          ) ? (
            <button
              type="button"
              className={active === 'students' ? 'active' : ''}
              onClick={() => navigate('/students')}
            >
              <span aria-hidden="true">▤</span> Students
            </button>
          ) : null}
          {currentUser.context.kind === 'TENANT' && currentUser.context.grants.some(
            (grant) => ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY', 'STUDENT', 'AUDITOR'].includes(grant.role),
          ) ? (
            <button type="button" className={active === 'exams' ? 'active' : ''} onClick={() => navigate('/exams')}>
              <span aria-hidden="true">▣</span> Exams &amp; registration
            </button>
          ) : null}
        </nav>
        <p className="sidebar-foot">Academic year 2026–27<br />MVP · Written examinations</p>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <span>Workspace / {active === 'overview' ? 'Overview' : active === 'students' ? 'Students' : active === 'exams' ? 'Exams & registration' : active === 'schedule' ? 'Timetable & halls' : active === 'attendance' ? 'Duties & attendance' : 'Setup & access'}</span>
          <div className="topbar-actions">
            <span className="context-kind">{currentUser.context.kind}</span>
            <button type="button" className="secondary-button" onClick={() => void onLogout()}>
              Sign out
            </button>
          </div>
        </header>
        <div className="demo-notice">Live application · Server-authorized access</div>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  )
}
