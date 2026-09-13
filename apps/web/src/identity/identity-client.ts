import type {
  CreateInvitationRequest,
  MembershipDirectoryResponse,
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
  institutionName: string
  memberships: readonly MembershipSummary[]
  departments: readonly DepartmentSummary[]
  nextCursor: string | null
  pageSize: number
}

interface AuthenticatedRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

function normalizeMembership(
  membership: MembershipDirectoryResponse['memberships']['items'][number],
): MembershipSummary {
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

  async listMemberships(options: {
    cursor?: string | null
    pageSize?: number
  } = {}): Promise<MembershipDirectory> {
    const query = new URLSearchParams()
    if (options.cursor) query.set('cursor', options.cursor)
    if (options.pageSize) query.set('pageSize', String(options.pageSize))
    const payload = await this.requester.request<MembershipDirectoryResponse>(
      `/identity/memberships${query.size ? `?${query.toString()}` : ''}`,
    )
    return {
      institutionName: payload.institutionName,
      memberships: payload.memberships.items.map(normalizeMembership),
      departments: payload.departments,
      nextCursor: payload.memberships.nextCursor,
      pageSize: payload.pageSize,
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
