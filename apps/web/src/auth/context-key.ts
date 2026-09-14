import type { CurrentUserResponse } from '@entropix/contracts'

/** A changed key forces institution/role-scoped screens to discard local data. */
export function authContextKey(currentUser: CurrentUserResponse | null): string {
  if (!currentUser) return 'signed-out'
  return currentUser.context.kind === 'TENANT'
    ? `${currentUser.context.tenantId}:${currentUser.context.membershipId}:${currentUser.context.activeRole}`
    : `platform:${currentUser.context.userId}:${currentUser.context.tenantId ?? 'none'}`
}
