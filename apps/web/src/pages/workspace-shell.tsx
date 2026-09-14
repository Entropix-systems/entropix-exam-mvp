import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { CurrentUserResponse, TenantRole } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { navigate } from '../auth/navigation'
import { canManageIdentity, roleLabel } from '../identity/identity-access'

export function WorkspaceShell({
  currentUser,
  active,
  onLogout,
  onSwitchInstitution,
  onSwitchRole,
  children,
}: PropsWithChildren<{
  currentUser: CurrentUserResponse
  active: 'overview' | 'setup-access' | 'masters' | 'students' | 'exams' | 'schedule' | 'attendance' | 'marks' | 'results' | 'student' | 'reports'
  onLogout(): Promise<void>
  onSwitchInstitution(institutionId: string): Promise<void>
  onSwitchRole(role: TenantRole): Promise<void>
}>) {
  const tenant = currentUser.context.kind === 'TENANT' ? currentUser.context : null
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const activeInstitution = tenant
    ? currentUser.institutions.find(
        (institution) => institution.id === tenant.tenantId,
      )
    : null
  const availableRoles = tenant
    ? [...new Set(tenant.grants.map((grant) => grant.role))]
    : []

  async function change(operation: () => Promise<void>) {
    setSwitching(true)
    setSwitchError(null)
    try {
      await operation()
    } catch (reason) {
      setSwitchError(
        reason instanceof AuthApiError
          ? reason.message
          : 'Access context could not be changed.',
      )
    } finally {
      setSwitching(false)
    }
  }
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          Examination ERP
          <small>ENTROPIX SYSTEMS</small>
        </div>
        <div className="tenant-box">
          <small>INSTITUTION WORKSPACE</small>
          {currentUser.institutions.length > 1 ? (
            <select
              aria-label="Active institution"
              value={activeInstitution?.id ?? ''}
              disabled={switching}
              onChange={(event) =>
                void change(() => onSwitchInstitution(event.target.value))
              }
            >
              {!activeInstitution ? <option value="">Select institution</option> : null}
              {currentUser.institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          ) : (
            <strong>
              {currentUser.institutions[0]?.name ?? 'Platform context'}
            </strong>
          )}
        </div>
        <p className="nav-label">EXAMINATION WORKSPACE</p>
        <nav aria-label="Primary navigation">
          {tenant?.activeRole === 'STUDENT' ? (
            <button type="button" className={active === 'student' ? 'active' : ''} onClick={() => navigate('/student')}>
              <span aria-hidden="true">◫</span> Student portal
            </button>
          ) : (
            <button type="button" className={active === 'overview' ? 'active' : ''} onClick={() => navigate('/')}>
              <span aria-hidden="true">◫</span> Overview
            </button>
          )}
          {canManageIdentity(currentUser) ? (
            <button
              type="button"
              className={active === 'setup-access' ? 'active' : ''}
              onClick={() => navigate('/setup-access')}
            >
              <span aria-hidden="true">⚙</span> Setup &amp; access
            </button>
          ) : null}
          {canManageIdentity(currentUser) ? (
            <button
              type="button"
              className={active === 'masters' ? 'active' : ''}
              onClick={() => navigate('/masters')}
            >
              <span aria-hidden="true">▦</span> Academic masters
            </button>
          ) : null}
          {tenant && [
            'INSTITUTION_ADMIN',
            'EXAM_CONTROLLER',
            'DEPARTMENT_ADMIN',
            'FACULTY',
            'STUDENT',
            'AUDITOR',
          ].includes(tenant.activeRole) ? (
            <button
              type="button"
              className={active === 'students' ? 'active' : ''}
              onClick={() => navigate('/students')}
            >
              <span aria-hidden="true">▤</span> Students
            </button>
          ) : null}
          {tenant && [
            'INSTITUTION_ADMIN',
            'EXAM_CONTROLLER',
            'DEPARTMENT_ADMIN',
            'FACULTY',
            'STUDENT',
            'AUDITOR',
          ].includes(tenant.activeRole) ? (
            <button type="button" className={active === 'exams' ? 'active' : ''} onClick={() => navigate('/exams')}>
              <span aria-hidden="true">▣</span> Exams &amp; registration
            </button>
          ) : null}
          {tenant && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(tenant.activeRole) ? (
            <button type="button" className={active === 'schedule' ? 'active' : ''} onClick={() => navigate('/schedule')}>
              <span aria-hidden="true">▦</span> Timetable &amp; halls
            </button>
          ) : null}
          {tenant && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'INVIGILATOR'].includes(tenant.activeRole) ? (
            <button type="button" className={active === 'attendance' ? 'active' : ''} onClick={() => navigate('/attendance')}>
              <span aria-hidden="true">✓</span> Duties &amp; attendance
            </button>
          ) : null}
          {tenant && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY'].includes(tenant.activeRole) ? (
            <button type="button" className={active === 'marks' ? 'active' : ''} onClick={() => navigate('/marks')}>
              <span aria-hidden="true">≡</span> Marks &amp; review
            </button>
          ) : null}
          {tenant && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER'].includes(tenant.activeRole) ? (
            <button type="button" className={active === 'results' ? 'active' : ''} onClick={() => navigate('/results')}>
              <span aria-hidden="true">◎</span> Result publication
            </button>
          ) : null}
          {tenant && ['INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'INVIGILATOR', 'AUDITOR'].includes(tenant.activeRole) ? (
            <button type="button" className={active === 'reports' ? 'active' : ''} onClick={() => navigate('/reports')}>
              <span aria-hidden="true">↗</span> Reports &amp; audit
            </button>
          ) : null}
        </nav>
        <p className="sidebar-foot">Academic year 2026–27<br />MVP · Written examinations</p>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <span>Workspace / {active === 'overview' ? 'Overview' : active === 'student' ? 'Student portal' : active === 'masters' ? 'Academic masters' : active === 'students' ? 'Students' : active === 'exams' ? 'Exams & registration' : active === 'schedule' ? 'Timetable & halls' : active === 'attendance' ? 'Duties & attendance' : active === 'marks' ? 'Marks & review' : active === 'results' ? 'Result publication' : active === 'reports' ? 'Reports & audit' : 'Setup & access'}</span>
          <div className="topbar-actions">
            <span className="user-email">{currentUser.email}</span>
            {tenant && availableRoles.length > 1 ? (
              <select
                aria-label="Active role"
                value={tenant.activeRole}
                disabled={switching}
                onChange={(event) =>
                  void change(() => onSwitchRole(event.target.value as TenantRole))
                }
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            ) : (
              <span className="context-kind">
                {tenant
                  ? roleLabel(tenant.activeRole)
                  : 'Platform Admin'}
              </span>
            )}
            <button type="button" className="secondary-button" onClick={() => void onLogout()}>
              Sign out
            </button>
          </div>
        </header>
        {switchError ? <p className="context-switch-error" role="alert">{switchError}</p> : null}
        <div className="demo-notice">Live application · Server-authorized access</div>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  )
}
