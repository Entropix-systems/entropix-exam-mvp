import type { CurrentUserResponse } from '@entropix/contracts'
import type { DashboardStep } from '../audit/audit-client'
import { canAccessWorkspacePath, landingDestination } from '../auth/route-policy'

const STEP_DESTINATIONS: Readonly<Record<DashboardStep['code'], readonly string[]>> = {
  ACADEMIC_SETUP: ['/exams', '/masters', '/reports', '/'],
  TIMETABLE: ['/schedule', '/exams', '/reports', '/'],
  ATTENDANCE: ['/attendance', '/reports', '/'],
  MARKS: ['/marks', '/reports', '/'],
  RESULT_RUN: ['/results', '/reports', '/'],
  PUBLICATION: ['/results', '/reports', '/'],
}

const ROUTE_LABELS: Readonly<Record<string, string>> = {
  '/': 'Review exam overview',
  '/exams': 'Open exams and registration',
  '/masters': 'Open academic masters',
  '/schedule': 'Open timetable and halls',
  '/attendance': 'Open attendance and incidents',
  '/marks': 'Open marks and review',
  '/results': 'Open result checklist',
  '/reports': 'Open available reports',
  '/student': 'Open student portal',
  '/platform': 'Open platform workspace',
}

export interface AttentionView {
  title: string
  detail: string
  status: 'READY' | DashboardStep['status']
  route: string
  actionLabel: string
}

function firstAuthorizedRoute(currentUser: CurrentUserResponse, candidates: readonly string[]): string {
  return candidates.find((path) => canAccessWorkspacePath(currentUser, path)) ?? landingDestination(currentUser)
}

export function attentionViewFor(steps: readonly DashboardStep[], currentUser: CurrentUserResponse): AttentionView {
  const pending = steps.find((step) => step.status !== 'COMPLETE')
  if (!pending) {
    const route = firstAuthorizedRoute(currentUser, ['/results', '/reports', '/'])
    return {
      title: 'All readiness checks complete',
      detail: 'No blockers remain in the ordered exam readiness checklist.',
      status: 'READY',
      route,
      actionLabel: ROUTE_LABELS[route] ?? 'Open workspace',
    }
  }
  const route = firstAuthorizedRoute(currentUser, STEP_DESTINATIONS[pending.code])
  return {
    title: pending.label,
    detail: pending.detail,
    status: pending.status,
    route,
    actionLabel: ROUTE_LABELS[route] ?? 'Open workspace',
  }
}
