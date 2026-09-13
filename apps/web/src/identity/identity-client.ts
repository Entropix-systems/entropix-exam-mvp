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

interface ApiMembershipSummary {
  id: string
  userId: string
  email: string
  name: string | null
  status: string
  version: number
  grants: readonly ScopedRoleGrant[]
}

interface AuthenticatedRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

type MembershipDirectoryPayload =
  | MembershipDirectory
  | { memberships: readonly ApiMembershipSummary[] }
  | readonly MembershipSummary[]

function normalizeMembership(
  membership: MembershipSummary | ApiMembershipSummary,
): MembershipSummary {
  if ('user' in membership) return membership
  return {
    id: membership.id,
    version: membership.version,
    status: membership.status,
    user: { name: membership.name, email: membership.email },
    grants: membership.grants,
  }
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
      const memberships = (payload as readonly MembershipSummary[]).map(
        normalizeMembership,
      )
      return {
        memberships,
        departments: [],
      }
    }
    const directory = payload as MembershipDirectory | {
      memberships: readonly ApiMembershipSummary[]
    }
    return {
      tenantName: 'tenantName' in directory ? directory.tenantName : undefined,
      memberships: (directory.memberships ?? []).map(normalizeMembership),
      departments: 'departments' in directory ? directory.departments : [],
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
