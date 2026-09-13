import type {
  CurrentUserResponse,
  ScopedRoleGrant,
  TenantRole,
} from '@entropix/contracts'

const ROLE_LABELS: Readonly<Record<TenantRole, string>> = {
  INSTITUTION_ADMIN: 'Institution Admin',
  EXAM_CONTROLLER: 'Exam Controller',
  DEPARTMENT_ADMIN: 'Department Admin',
  FACULTY: 'Faculty / Examiner',
  INVIGILATOR: 'Invigilator / Observer',
  STUDENT: 'Student',
  AUDITOR: 'Auditor',
}

export const TENANT_ROLE_OPTIONS: readonly {
  value: Exclude<TenantRole, 'STUDENT'>
  label: string
}[] = Object.entries(ROLE_LABELS)
  .filter(([role]) => role !== 'STUDENT')
  .map(([value, label]) => ({
    value: value as Exclude<TenantRole, 'STUDENT'>,
    label,
  }))

export function canManageIdentity(user: CurrentUserResponse | null): boolean {
  return (
    user?.context.kind === 'TENANT' &&
    user.context.activeRole === 'INSTITUTION_ADMIN'
  )
}

export function roleLabel(role: TenantRole): string {
  return ROLE_LABELS[role]
}

export function validateGrants(
  grants: readonly ScopedRoleGrant[],
): string | null {
  if (grants.length === 0) return 'Select at least one role.'
  if (
    grants.some(
      (grant) =>
        grant.role === 'DEPARTMENT_ADMIN' && !grant.departmentId,
    )
  )
    return 'Department Admin requires a department.'
  const unique = new Set(
    grants.map((grant) => `${grant.role}:${grant.departmentId ?? ''}`),
  )
  if (unique.size !== grants.length) return 'Remove duplicate role grants.'
  return null
}
