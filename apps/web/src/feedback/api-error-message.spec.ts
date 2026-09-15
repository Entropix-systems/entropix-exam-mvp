import { describe, expect, it } from 'vitest'
import { AuthApiError } from '../auth/auth-client'
import { apiErrorMessage, isFieldValidationError } from './api-error-message'

describe('apiErrorMessage', () => {
  it('normalizes network, permission, conflict, and server failures', () => {
    expect(apiErrorMessage(new TypeError('fetch failed'), 'Fallback')).toContain('Unable to reach ExamOS')
    expect(apiErrorMessage(new AuthApiError(403, 'FORBIDDEN', 'Forbidden'), 'Fallback')).toContain("don't have permission")
    expect(apiErrorMessage(new AuthApiError(409, 'CONFLICT', 'Conflict'), 'Fallback')).toContain('updated by another user')
    expect(apiErrorMessage(new AuthApiError(500, 'INTERNAL', 'PrismaClientKnownRequestError'), 'Unable to save changes.')).toBe('Unable to save changes.')
  })

  it('keeps actionable validation errors available for inline presentation', () => {
    const error = new AuthApiError(422, 'VALIDATION', 'Choose at least one role.')
    expect(isFieldValidationError(error)).toBe(true)
    expect(apiErrorMessage(error, 'Fallback')).toBe('Choose at least one role.')
  })
})
