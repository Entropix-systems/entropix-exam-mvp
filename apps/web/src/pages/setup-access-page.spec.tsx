import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MembershipTable } from './setup-access-page'

describe('Setup & access membership directory', () => {
  it('renders membership identity, status, roles, and department scope', () => {
    const html = renderToStaticMarkup(
      <MembershipTable
        directory={{
          institutionName: 'Northstar College',
          nextCursor: null,
          pageSize: 25,
          departments: [{ id: 'department-1', name: 'Computer Science' }],
          memberships: [
            {
              id: 'membership-1',
              version: 2,
              status: 'ACTIVE',
              user: { name: 'Priya Nair', email: 'priya@example.test' },
              grants: [
                { role: 'FACULTY', departmentId: 'department-1' },
              ],
            },
          ],
        }}
        onEdit={vi.fn()}
        onToggleActive={vi.fn()}
        busyMembershipId={null}
      />,
    )

    expect(html).toContain('Priya Nair')
    expect(html).toContain('priya@example.test')
    expect(html).toContain('ACTIVE')
    expect(html).toContain('Faculty / Examiner')
    expect(html).toContain('Computer Science')
    expect(html).toContain('Deactivate')
  })
})
