import type {
  CreateInvitationRequest,
  ReplaceRoleGrantsRequest,
  ScopedRoleGrant,
} from '@entropix/contracts'

export interface DepartmentSummary {
  id: string
  name: string
}

export interface MembershipSummary {
  id: string
  version: number
  status: string
  user: {
    name: string | null
    email: string
  }
  grants: readonly (ScopedRoleGrant & { departmentName?: string | null })[]
}

export interface MembershipDirectory {
  tenantName?: string
  memberships: readonly MembershipSummary[]
  departments: readonly DepartmentSummary[]
}

interface AuthenticatedRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

type MembershipDirectoryPayload =
  | MembershipDirectory
  | readonly MembershipSummary[]

function departmentsFromMemberships(
  memberships: readonly MembershipSummary[],
): DepartmentSummary[] {
  const departments = new Map<string, string>()
  memberships.forEach((membership) =>
    membership.grants.forEach((grant) => {
      if (grant.departmentId)
        departments.set(
          grant.departmentId,
          grant.departmentName ?? grant.departmentId,
        )
    }),
  )
  return [...departments].map(([id, name]) => ({ id, name }))
}

export class IdentityApiClient {
  private readonly requester: AuthenticatedRequester

  constructor(requester: AuthenticatedRequester) {
    this.requester = requester
  }

  async listMemberships(): Promise<MembershipDirectory> {
    const payload = await this.requester.request<MembershipDirectoryPayload>(
      '/identity/memberships',
    )
    if (Array.isArray(payload)) {
      const memberships = payload as readonly MembershipSummary[]
      return {
        memberships,
        departments: departmentsFromMemberships(memberships),
      }
    }
    const directory = payload as MembershipDirectory
    return {
      tenantName: directory.tenantName,
      memberships: directory.memberships ?? [],
      departments:
        directory.departments ??
        departmentsFromMemberships(directory.memberships ?? []),
    }
  }

  createInvitation(input: CreateInvitationRequest): Promise<unknown> {
    return this.requester.request('/identity/invitations', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  replaceRoleGrants(
    membershipId: string,
    input: ReplaceRoleGrantsRequest,
  ): Promise<unknown> {
    return this.requester.request(
      `/identity/memberships/${encodeURIComponent(membershipId)}/role-grants`,
      { method: 'PUT', body: JSON.stringify(input) },
    )
  }

  deactivate(membershipId: string, expectedVersion: number): Promise<unknown> {
    return this.setActiveState(membershipId, 'deactivate', expectedVersion)
  }

  activate(membershipId: string, expectedVersion: number): Promise<unknown> {
    return this.setActiveState(membershipId, 'activate', expectedVersion)
  }

  private setActiveState(
    membershipId: string,
    action: 'activate' | 'deactivate',
    expectedVersion: number,
  ): Promise<unknown> {
    return this.requester.request(
      `/identity/memberships/${encodeURIComponent(membershipId)}/${action}`,
      {
        method: 'POST',
        body: JSON.stringify({ expectedVersion }),
      },
    )
  }
}
