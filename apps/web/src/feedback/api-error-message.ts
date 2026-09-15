import { AuthApiError } from '../auth/auth-client'

export function apiErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof TypeError) {
    return 'Unable to reach ExamOS. Check your connection and try again.'
  }
  if (!(reason instanceof AuthApiError)) return fallback
  if (import.meta.env.DEV && reason.requestId) {
    console.info('ExamOS API request failed', {
      requestId: reason.requestId,
      status: reason.status,
      code: reason.code,
    })
  }
  if (reason.status === 403) return "You don't have permission to perform this action."
  if (reason.status === 409) return 'This record was updated by another user. Refresh and try again.'
  if (reason.status >= 500) return fallback
  return reason.message || fallback
}

export function isFieldValidationError(reason: unknown): boolean {
  return reason instanceof AuthApiError && (reason.status === 400 || reason.status === 422)
}
