import type { AuthStatus } from './auth-context'

export function protectedDestination(status: AuthStatus): string | null {
  if (status === 'UNAUTHENTICATED') return '/login'
  if (status === 'ACCESS_DENIED') return '/access-denied'
  return null
}
