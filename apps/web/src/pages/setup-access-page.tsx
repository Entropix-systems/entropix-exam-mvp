import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ScopedRoleGrant, TenantRole } from '@entropix/contracts'
import { AuthApiError } from '../auth/auth-client'
import { useAuth } from '../auth/auth-context'
import {
  TENANT_ROLE_OPTIONS,
  canManageIdentity,
  roleLabel,
  validateGrants,
} from '../identity/identity-access'
import type {
  DepartmentSummary,
  MembershipDirectory,
  MembershipSummary,
} from '../identity/identity-client'
import { IdentityApiClient } from '../identity/identity-client'
import { AccessDeniedPage } from './access-denied-page'
import { WorkspaceShell } from './workspace-shell'

function requestError(reason: unknown, fallback: string): string {
  return reason instanceof AuthApiError ? reason.message : fallback
}

function canActivate(status: string): boolean {
  return !['ACTIVE', 'INVITED', 'PENDING', 'PENDING_INVITATION'].includes(
    status.toUpperCase(),
  )
}

function GrantEditor({
  grants,
  departments,
  onChange,
}: {
  grants: readonly ScopedRoleGrant[]
  departments: readonly DepartmentSummary[]
  onChange(grants: ScopedRoleGrant[]): void
}) {
  function update(
    index: number,
    patch: Partial<{ role: TenantRole; departmentId: string | null }>,
  ) {
    const next = grants.map((grant, grantIndex) => {
      if (grantIndex !== index) return grant
      const role = patch.role ?? grant.role
      const departmentId =
        role === 'DEPARTMENT_ADMIN' || role === 'FACULTY'
          ? patch.departmentId === undefined
            ? grant.departmentId
            : patch.departmentId
          : null
      return { role, departmentId }
    })
    onChange(next)
  }

  return (
    <div className="grant-editor">
      {grants.map((grant, index) => (
        <div className="grant-row" key={`${index}-${grant.role}`}>
          <label>
            Role
            <select
              aria-label={`Role ${index + 1}`}
              value={grant.role}
              onChange={(event) =>
                update(index, { role: event.target.value as TenantRole })
              }
            >
              {TENANT_ROLE_OPTIONS.map((option) => (
                <option
                  value={option.value}
                  key={option.value}
                  disabled={
                    option.value === 'DEPARTMENT_ADMIN' &&
                    departments.length === 0
                  }
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Department scope
            <select
              aria-label={`Department scope ${index + 1}`}
              value={grant.departmentId ?? ''}
              disabled={
                grant.role !== 'DEPARTMENT_ADMIN' && grant.role !== 'FACULTY'
              }
              required={grant.role === 'DEPARTMENT_ADMIN'}
              onChange={(event) =>
                update(index, { departmentId: event.target.value || null })
              }
            >
              <option value="">
                {grant.role === 'DEPARTMENT_ADMIN'
                  ? 'Select department'
                  : 'All / no department scope'}
              </option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={`Remove role ${index + 1}`}
            onClick={() => onChange(grants.filter((_, grantIndex) => grantIndex !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary-button add-role-button"
        onClick={() => onChange([...grants, { role: 'INVIGILATOR', departmentId: null }])}
      >
        Add another role
      </button>
    </div>
  )
}

export function MembershipTable({
  directory,
  onEdit,
  onToggleActive,
  busyMembershipId,
}: {
  directory: MembershipDirectory
  onEdit(membership: MembershipSummary): void
  onToggleActive(membership: MembershipSummary): void
  busyMembershipId: string | null
}) {
  const departmentNames = new Map(
    directory.departments.map((department) => [department.id, department.name]),
  )
  return (
    <div className="membership-table-wrap">
      <table className="membership-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Role grants</th>
            <th><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {directory.memberships.map((membership) => (
            <tr key={membership.id}>
              <td>
                <strong>{membership.user.name || 'Name not provided'}</strong>
                <small>{membership.user.email}</small>
              </td>
              <td>
                <span className={`status-badge ${membership.status.toLowerCase()}`}>
                  {membership.status.replaceAll('_', ' ')}
                </span>
              </td>
              <td>
                <div className="role-grants">
                  {membership.grants.map((grant, index) => (
                    <span className="role-grant" key={`${grant.role}-${grant.departmentId ?? index}`}>
                      {roleLabel(grant.role)}
                      {grant.departmentId ? (
                        <small>
                          {grant.departmentName ??
                            departmentNames.get(grant.departmentId) ??
                            'Department-scoped access'}
                        </small>
                      ) : null}
                    </span>
                  ))}
                </div>
              </td>
              <td>
                <div className="table-actions">
                  <button type="button" className="link-button" onClick={() => onEdit(membership)}>
                    Edit roles
                  </button>
                  {membership.status.toUpperCase() === 'ACTIVE' || canActivate(membership.status) ? (
                    <button
                      type="button"
                      className={membership.status.toUpperCase() === 'ACTIVE' ? 'danger-link' : 'link-button'}
                      disabled={busyMembershipId === membership.id}
                      onClick={() => onToggleActive(membership)}
                    >
                      {busyMembershipId === membership.id
                        ? 'Updating…'
                        : membership.status.toUpperCase() === 'ACTIVE'
                          ? 'Deactivate'
                          : 'Activate'}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {directory.memberships.length === 0 ? (
        <p className="empty-state">No memberships are available in this institution.</p>
      ) : null}
    </div>
  )
}

function AccessDialog({
  title,
  name,
  email,
  grants,
  departments,
  busy,
  error,
  onEmailChange,
  onNameChange,
  onGrantsChange,
  onClose,
  onSubmit,
}: {
  title: string
  name?: string
  email?: string
  grants: readonly ScopedRoleGrant[]
  departments: readonly DepartmentSummary[]
  busy: boolean
  error: string | null
  onEmailChange?(email: string): void
  onNameChange?(name: string): void
  onGrantsChange(grants: ScopedRoleGrant[]): void
  onClose(): void
  onSubmit(event: FormEvent<HTMLFormElement>): void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="access-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header>
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="dialog-body">
            {onNameChange ? (
              <label className="field-label">
                Name
                <input
                  value={name}
                  autoComplete="name"
                  required
                  onChange={(event) => onNameChange(event.target.value)}
                />
              </label>
            ) : null}
            {onEmailChange ? (
              <label className="field-label">
                Email
                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  required
                  onChange={(event) => onEmailChange(event.target.value)}
                />
              </label>
            ) : email ? <p className="dialog-user">{email}</p> : null}
            <GrantEditor grants={grants} departments={departments} onChange={onGrantsChange} />
            {departments.length === 0 ? (
              <p className="field-help dialog-help">
                Department Admin becomes available when M01 Academics provides real department records.
              </p>
            ) : null}
            {error ? <p className="form-message error" role="alert">{error}</p> : null}
          </div>
          <footer>
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function SetupAccessPage({
  client,
}: {
  client: IdentityApiClient
}) {
  const { currentUser, logout, switchInstitution, switchRole } = useAuth()
  const [directory, setDirectory] = useState<MembershipDirectory | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [draftGrants, setDraftGrants] = useState<ScopedRoleGrant[]>([
    { role: 'INVIGILATOR', departmentId: null },
  ])
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null])
  const [pageSize, setPageSize] = useState(25)
  const [editing, setEditing] = useState<MembershipSummary | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null)
  const mayManageIdentity = canManageIdentity(currentUser)

  const currentCursor = cursorHistory[cursorHistory.length - 1] ?? null
  const load = useCallback(async (
    cursor = currentCursor,
    requestedPageSize = pageSize,
  ) => {
    setLoading(true)
    try {
      const nextDirectory = await client.listMemberships({
        cursor,
        pageSize: requestedPageSize,
      })
      setPageError(null)
      setDirectory(nextDirectory)
    } catch (reason) {
      setPageError(requestError(reason, 'Memberships could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [client, currentCursor, pageSize])

  useEffect(() => {
    if (!mayManageIdentity) return
    let active = true
    void client.listMemberships({ cursor: currentCursor, pageSize }).then(
      (nextDirectory) => {
        if (!active) return
        setDirectory(nextDirectory)
        setPageError(null)
        setLoading(false)
      },
      (reason: unknown) => {
        if (!active) return
        setPageError(requestError(reason, 'Memberships could not be loaded.'))
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [client, currentCursor, mayManageIdentity, pageSize])

  if (!currentUser) return null
  if (!mayManageIdentity) return <AccessDeniedPage />

  function closeDialog() {
    setInviteOpen(false)
    setEditing(null)
    setDialogError(null)
  }

  function openInvite() {
    setInviteName('')
    setInviteEmail('')
    setDraftGrants([{ role: 'INVIGILATOR', departmentId: null }])
    setDialogError(null)
    setInviteOpen(true)
  }

  function openEdit(membership: MembershipSummary) {
    setDraftGrants(membership.grants.map(({ role, departmentId }) => ({ role, departmentId })))
    setDialogError(null)
    setEditing(membership)
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const grantError = validateGrants(draftGrants)
    if (grantError) return setDialogError(grantError)
    setSaving(true)
    setDialogError(null)
    try {
      await client.createInvitation({ name: inviteName.trim(), email: inviteEmail.trim(), grants: draftGrants })
      closeDialog()
      setSuccess(`Invitation sent to ${inviteEmail.trim()}.`)
      await load()
    } catch (reason) {
      setDialogError(requestError(reason, 'Invitation could not be sent.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const grantError = validateGrants(draftGrants)
    if (grantError) return setDialogError(grantError)
    setSaving(true)
    setDialogError(null)
    try {
      await client.replaceRoleGrants(editing.id, {
        expectedVersion: editing.version,
        grants: draftGrants,
      })
      closeDialog()
      setSuccess(`Role grants updated for ${editing.user.email}.`)
      await load()
    } catch (reason) {
      setDialogError(requestError(reason, 'Role grants could not be updated.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(membership: MembershipSummary) {
    const isActive = membership.status.toUpperCase() === 'ACTIVE'
    if (
      isActive &&
      !window.confirm(`Deactivate access for ${membership.user.email}?`)
    )
      return
    setBusyMembershipId(membership.id)
    setPageError(null)
    setSuccess(null)
    try {
      if (isActive) await client.deactivate(membership.id, membership.version)
      else await client.activate(membership.id, membership.version)
      setSuccess(
        `${membership.user.email} ${isActive ? 'deactivated' : 'activated'}.`,
      )
      await load()
    } catch (reason) {
      setPageError(requestError(reason, 'Membership status could not be updated.'))
    } finally {
      setBusyMembershipId(null)
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      active="setup-access"
      onLogout={logout}
      onSwitchInstitution={switchInstitution}
      onSwitchRole={switchRole}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">Institution administration</p>
          <h1>Setup &amp; access</h1>
          <p>Manage people and fixed tenant roles for {directory?.institutionName ?? 'this institution'}.</p>
        </div>
        <button type="button" className="primary-button" onClick={openInvite}>Invite user</button>
      </div>
      {success ? <p className="form-message success page-message" role="status">{success}</p> : null}
      {pageError ? <p className="form-message error page-message" role="alert">{pageError}</p> : null}
      <section className="directory-card" aria-labelledby="membership-title">
        <header>
          <div>
            <h2 id="membership-title">Institution memberships</h2>
            <p>Current access status, role grants, and department scope.</p>
          </div>
          <button type="button" className="link-button" disabled={loading} onClick={() => void load()}>
            Refresh
          </button>
        </header>
        {loading ? <p className="loading-state" role="status">Loading memberships…</p> : null}
        {!loading && directory ? (
          <MembershipTable
            directory={directory}
            onEdit={openEdit}
            onToggleActive={(membership) => void toggleActive(membership)}
            busyMembershipId={busyMembershipId}
          />
        ) : null}
        {!loading && directory ? (
          <div className="pagination-controls" aria-label="Membership pagination">
            <span>Page {cursorHistory.length}</span>
            <label>
              Rows
              <select
                aria-label="Membership page size"
                value={pageSize}
                onChange={(event) => {
                  setLoading(true)
                  setPageSize(Number(event.target.value))
                  setCursorHistory([null])
                }}
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={cursorHistory.length === 1}
              onClick={() => {
                setLoading(true)
                setCursorHistory((history) => history.slice(0, -1))
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!directory.nextCursor}
              onClick={() => {
                if (directory.nextCursor) {
                  setLoading(true)
                  setCursorHistory((history) => [...history, directory.nextCursor])
                }
              }}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      {inviteOpen ? (
        <AccessDialog
          title="Invite user"
          name={inviteName}
          email={inviteEmail}
          grants={draftGrants}
          departments={directory?.departments ?? []}
          busy={saving}
          error={dialogError}
          onEmailChange={setInviteEmail}
          onNameChange={setInviteName}
          onGrantsChange={setDraftGrants}
          onClose={closeDialog}
          onSubmit={(event) => void submitInvite(event)}
        />
      ) : null}
      {editing ? (
        <AccessDialog
          title="Edit roles"
          name={editing.user.name ?? undefined}
          email={editing.user.email}
          grants={draftGrants}
          departments={directory?.departments ?? []}
          busy={saving}
          error={dialogError}
          onGrantsChange={setDraftGrants}
          onClose={closeDialog}
          onSubmit={(event) => void submitRoles(event)}
        />
      ) : null}
    </WorkspaceShell>
  )
}
