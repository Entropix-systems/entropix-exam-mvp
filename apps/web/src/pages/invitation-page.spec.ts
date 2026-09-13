import { describe, expect, it } from 'vitest'
import { AuthApiError } from '../auth/auth-client'
import { invitationErrorMessage } from '../auth/invitation-errors'

describe('invitation acceptance errors', () => {
  it('shows concise expired, already-used, and invalid states', () => {
    expect(
      invitationErrorMessage(
        new AuthApiError(422, 'INVITATION_EXPIRED', 'Generic failure'),
      ),
    ).toBe('This invitation has expired.')
    expect(
      invitationErrorMessage(
        new AuthApiError(409, 'INVITATION_ALREADY_USED', 'Generic failure'),
      ),
    ).toBe('This invitation has already been used.')
    expect(
      invitationErrorMessage(
        new AuthApiError(422, 'INVALID_INVITATION', 'Generic failure'),
      ),
    ).toBe('This invitation link is not valid.')
  })
})
