import { AuthApiError } from './auth-client'

export function invitationErrorMessage(reason: unknown): string {
  if (!(reason instanceof AuthApiError)) return 'This invitation could not be accepted.'
  if (reason.code === 'INVITATION_EXPIRED' || reason.status === 410)
    return 'This invitation has expired.'
  if (
    ['INVITATION_ALREADY_USED', 'INVITATION_USED'].includes(reason.code) ||
    reason.status === 409
  )
    return 'This invitation has already been used.'
  if (
    reason.code === 'INVALID_INVITATION' ||
    [400, 404, 422].includes(reason.status)
  )
    return 'This invitation link is not valid.'
  return reason.message
}
