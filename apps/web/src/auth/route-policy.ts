import type { CurrentUserResponse, TenantRole } from '@entropix/contracts'
import type { AuthStatus } from './auth-context'

const ROLE_ROUTES: Readonly<Record<TenantRole, readonly string[]>> = {
  INSTITUTION_ADMIN: ['/', '/setup-access', '/masters', '/students', '/exams', '/schedule', '/attendance', '/marks', '/results', '/reports'],
  EXAM_CONTROLLER: ['/', '/students', '/exams', '/schedule', '/attendance', '/marks', '/results', '/reports'],
  DEPARTMENT_ADMIN: ['/', '/students', '/exams', '/marks', '/reports'],
  FACULTY: ['/', '/students', '/exams', '/marks'],
  INVIGILATOR: ['/', '/attendance', '/reports'],
  STUDENT: ['/student', '/students', '/exams'],
  AUDITOR: ['/', '/students', '/exams', '/reports'],
}

const ROLE_LANDINGS: Readonly<Record<TenantRole, string>> = {
  INSTITUTION_ADMIN: '/masters',
  EXAM_CONTROLLER: '/results',
  DEPARTMENT_ADMIN: '/marks',
  FACULTY: '/marks',
  INVIGILATOR: '/attendance',
  STUDENT: '/student',
  AUDITOR: '/',
}

export function protectedDestination(status: AuthStatus): string | null {
  if (status === 'UNAUTHENTICATED') return '/login'
  if (status === 'ACCESS_DENIED') return '/access-denied'
  return null
}

export function landingDestination(currentUser: CurrentUserResponse): string {
  return currentUser.context.kind === 'PLATFORM'
    ? '/platform'
    : ROLE_LANDINGS[currentUser.context.activeRole]
}

export function canAccessWorkspacePath(
  currentUser: CurrentUserResponse,
  pathname: string,
): boolean {
  if (currentUser.context.kind === 'PLATFORM')
    return pathname === '/platform' || (pathname === '/' && Boolean(currentUser.context.tenantId))
  return ROLE_ROUTES[currentUser.context.activeRole].includes(pathname)
}

export function destinationAfterContextChange(
  pathname: string,
  currentUser: CurrentUserResponse,
): string {
  if (currentUser.context.kind === 'PLATFORM' && currentUser.context.tenantId)
    return pathname === '/platform' ? '/' : canAccessWorkspacePath(currentUser, pathname) ? pathname : '/'
  return canAccessWorkspacePath(currentUser, pathname)
    ? pathname
    : landingDestination(currentUser)
}
