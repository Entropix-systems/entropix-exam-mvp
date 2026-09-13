import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { WorkspaceShell } from './workspace-shell'

function context(role: 'INSTITUTION_ADMIN' | 'INVIGILATOR' | 'STUDENT'): CurrentUserResponse {
  return {
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'user@example.test',
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
      activeRole: role,
      grants: [{ role, departmentId: null }],
    },
  }
}

describe('role-aware workspace navigation', () => {
  it('shows Setup & access only to Institution Admin context', () => {
    const admin = renderToStaticMarkup(
      <WorkspaceShell currentUser={context('INSTITUTION_ADMIN')} active="overview" onLogout={vi.fn()} onSwitchInstitution={vi.fn()} onSwitchRole={vi.fn()}>
        Authenticated shell
      </WorkspaceShell>,
    )
    const student = renderToStaticMarkup(
      <WorkspaceShell currentUser={context('STUDENT')} active="overview" onLogout={vi.fn()} onSwitchInstitution={vi.fn()} onSwitchRole={vi.fn()}>
        Authenticated shell
      </WorkspaceShell>,
    )

    expect(admin).toContain('Authenticated shell')
    expect(admin).toContain('Academic masters')
    expect(admin).toContain('Setup &amp; access')
    expect(admin).toContain('Timetable &amp; halls')
    expect(admin).toContain('Duties &amp; attendance')
    expect(student).not.toContain('Academic masters')
    expect(student).not.toContain('Setup &amp; access')
    expect(student).not.toContain('Timetable &amp; halls')
    expect(student).not.toContain('Duties &amp; attendance')
    const invigilator = renderToStaticMarkup(
      <WorkspaceShell currentUser={context('INVIGILATOR')} active="attendance" onLogout={vi.fn()} onSwitchInstitution={vi.fn()} onSwitchRole={vi.fn()}>
        Assigned roster
      </WorkspaceShell>,
    )
    expect(invigilator).toContain('Duties &amp; attendance')
    expect(invigilator).not.toContain('Timetable &amp; halls')
  })

  it('shows the verified institution name and only renders switchers for multiple choices', () => {
    const single = renderToStaticMarkup(
      <WorkspaceShell currentUser={context('INSTITUTION_ADMIN')} active="overview" onLogout={vi.fn()} onSwitchInstitution={vi.fn()} onSwitchRole={vi.fn()}>
        Shell
      </WorkspaceShell>,
    )
    const multipleUser = context('INSTITUTION_ADMIN')
    multipleUser.institutions = [
      ...multipleUser.institutions,
      { id: '33333333-3333-4333-8333-333333333333', name: 'Cedar School', slug: 'cedar-school' },
    ]
    if (multipleUser.context.kind === 'TENANT') {
      multipleUser.context = {
        ...multipleUser.context,
        grants: [
          ...multipleUser.context.grants,
          { role: 'AUDITOR', departmentId: null },
        ],
      }
    }
    const multiple = renderToStaticMarkup(
      <WorkspaceShell currentUser={multipleUser} active="overview" onLogout={vi.fn()} onSwitchInstitution={vi.fn()} onSwitchRole={vi.fn()}>
        Shell
      </WorkspaceShell>,
    )

    expect(single).toContain('Northstar College')
    expect(single).not.toContain('aria-label="Active institution"')
    expect(single).not.toContain('aria-label="Active role"')
    expect(multiple).toContain('aria-label="Active institution"')
    expect(multiple).toContain('Cedar School')
    expect(multiple).toContain('aria-label="Active role"')
    expect(multiple).toContain('Auditor')
  })

  it('uses the selected role rather than another available grant for navigation', () => {
    const auditor = context('INSTITUTION_ADMIN')
    if (auditor.context.kind === 'TENANT') {
      auditor.context = {
        ...auditor.context,
        activeRole: 'AUDITOR',
        grants: [
          ...auditor.context.grants,
          { role: 'AUDITOR', departmentId: null },
        ],
      }
    }
    const html = renderToStaticMarkup(
      <WorkspaceShell currentUser={auditor} active="overview" onLogout={vi.fn()} onSwitchInstitution={vi.fn()} onSwitchRole={vi.fn()}>
        Shell
      </WorkspaceShell>,
    )

    expect(html).toContain('Auditor')
    expect(html).not.toContain('Setup &amp; access')
  })
})
