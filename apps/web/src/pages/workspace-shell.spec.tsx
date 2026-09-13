import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { WorkspaceShell } from './workspace-shell'

function context(role: 'INSTITUTION_ADMIN' | 'STUDENT'): CurrentUserResponse {
  return {
    sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    context: {
      kind: 'TENANT',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      grants: [{ role, departmentId: null }],
    },
  }
}

describe('role-aware workspace navigation', () => {
  it('shows Setup & access only to Institution Admin context', () => {
    const admin = renderToStaticMarkup(
      <WorkspaceShell currentUser={context('INSTITUTION_ADMIN')} active="overview" onLogout={vi.fn()}>
        Authenticated shell
      </WorkspaceShell>,
    )
    const student = renderToStaticMarkup(
      <WorkspaceShell currentUser={context('STUDENT')} active="overview" onLogout={vi.fn()}>
        Authenticated shell
      </WorkspaceShell>,
    )

    expect(admin).toContain('Authenticated shell')
    expect(admin).toContain('Academic masters')
    expect(admin).toContain('Setup &amp; access')
    expect(student).not.toContain('Academic masters')
    expect(student).not.toContain('Setup &amp; access')
  })
})
