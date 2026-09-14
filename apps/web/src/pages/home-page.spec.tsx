import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { AuthContext } from '../auth/auth-context'
import { ExamOverview, HomePage } from './home-page'
import { attentionViewFor } from './home-attention'
import type { AuditApiClient, DashboardExam, DashboardStep } from '../audit/audit-client'

const currentUser: CurrentUserResponse = {
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'admin@northstar.example.test',
  institutions: [{
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Northstar College',
    slug: 'northstar-college',
  }],
  context: {
    kind: 'TENANT',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    activeRole: 'INSTITUTION_ADMIN',
    grants: [{ role: 'INSTITUTION_ADMIN', departmentId: null }],
  },
}

describe('HomePage access context', () => {
  it('uses business labels and does not render user, tenant, membership, or session UUIDs', () => {
    const html = renderToStaticMarkup(
      <AuthContext.Provider value={{
        status: 'AUTHENTICATED',
        currentUser,
        login: vi.fn(),
        switchInstitution: vi.fn(),
        switchRole: vi.fn(),
        logout: vi.fn(),
        restore: vi.fn(),
      }}>
        <HomePage client={{ dashboard: vi.fn() } as unknown as AuditApiClient} />
      </AuthContext.Provider>,
    )

    expect(html).toContain('admin@northstar.example.test')
    expect(html).toContain('Northstar College')
    for (const id of [
      currentUser.sessionId,
      currentUser.context.userId,
      currentUser.context.kind === 'TENANT' ? currentUser.context.membershipId : '',
    ]) expect(html).not.toContain(id)
  })

  const stageCases = [
    ['ACADEMIC_SETUP', '/exams'],
    ['TIMETABLE', '/schedule'],
    ['ATTENDANCE', '/attendance'],
    ['MARKS', '/marks'],
    ['RESULT_RUN', '/results'],
    ['PUBLICATION', '/results'],
  ] as const

  const codes = stageCases.map(([code]) => code)
  function stepsWithFirstPending(code: DashboardStep['code']): DashboardStep[] {
    const pendingIndex = codes.indexOf(code)
    return codes.map((entry, index) => ({
      code: entry,
      label: `Label ${entry}`,
      detail: `Detail ${entry}`,
      status: index < pendingIndex ? 'COMPLETE' : 'PENDING',
    }))
  }

  it.each(stageCases)('selects %s as the first pending readiness action', (code, route) => {
    expect(attentionViewFor(stepsWithFirstPending(code), currentUser)).toEqual({
      title: `Label ${code}`,
      detail: `Detail ${code}`,
      status: 'PENDING',
      route,
      actionLabel: expect.any(String),
    })
  })

  it('shows the explicit all-ready state with the result-checklist action', () => {
    const steps = stepsWithFirstPending('PUBLICATION').map((step) => ({ ...step, status: 'COMPLETE' as const }))
    expect(attentionViewFor(steps, currentUser)).toEqual({
      title: 'All readiness checks complete',
      detail: 'No blockers remain in the ordered exam readiness checklist.',
      status: 'READY',
      route: '/results',
      actionLabel: 'Open result checklist',
    })
  })

  it('uses the nearest authorized action instead of a denied workflow', () => {
    const faculty = structuredClone(currentUser)
    if (faculty.context.kind === 'TENANT') faculty.context = { ...faculty.context, activeRole: 'FACULTY', grants: [{ role: 'FACULTY', departmentId: null }] }
    const auditor = structuredClone(currentUser)
    if (auditor.context.kind === 'TENANT') auditor.context = { ...auditor.context, activeRole: 'AUDITOR', grants: [{ role: 'AUDITOR', departmentId: null }] }

    expect(attentionViewFor(stepsWithFirstPending('TIMETABLE'), faculty).route).toBe('/exams')
    expect(attentionViewFor(stepsWithFirstPending('MARKS'), auditor).route).toBe('/reports')
  })

  it('renders attention from the currently selected exam prop without stale copy', () => {
    const exam = (examCode: string, firstPending: DashboardStep['code']): DashboardExam => ({
      examId: examCode,
      examCode,
      examName: `${examCode} exam`,
      academicYear: '2026–27',
      termName: 'Term 1',
      state: 'EVALUATION',
      inputRevision: 1,
      registeredStudents: 1,
      scheduledPapers: 0,
      totalPapers: 1,
      allocatedSeats: 0,
      requiredSubjectSeats: 1,
      submittedSittings: 0,
      totalSittings: 0,
      incompleteAttendanceRows: 1,
      approvedSubjects: 0,
      studentHolds: 0,
      openIncidents: 0,
      staleResultRun: false,
      currentRunId: null,
      currentPublicationVersion: null,
      steps: stepsWithFirstPending(firstPending),
      attention: [],
      schedule: [],
    })
    const first = renderToStaticMarkup(<ExamOverview exam={exam('CURRENT-A', 'TIMETABLE')} timezone="Asia/Kolkata" currentUser={currentUser} />)
    const second = renderToStaticMarkup(<ExamOverview exam={exam('HISTORICAL-B', 'MARKS')} timezone="Asia/Kolkata" currentUser={currentUser} />)

    expect(first).toContain('CURRENT-A')
    expect(first).toContain('Label TIMETABLE')
    expect(second).toContain('HISTORICAL-B')
    expect(second).toContain('Label MARKS')
    expect(second).not.toContain('CURRENT-A')
  })
})
