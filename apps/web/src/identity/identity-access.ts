import type {
  CurrentUserResponse,
  ScopedRoleGrant,
  TenantRole,
} from '@entropix/contracts'

export const TENANT_ROLE_OPTIONS: readonly {
  value: TenantRole
  label: string
}[] = [
  { value: 'INSTITUTION_ADMIN', label: 'Institution Admin' },
  { value: 'EXAM_CONTROLLER', label: 'Exam Controller' },
  { value: 'DEPARTMENT_ADMIN', label: 'Department Admin' },
  { value: 'FACULTY', label: 'Faculty / Examiner' },
  { value: 'INVIGILATOR', label: 'Invigilator / Observer' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'AUDITOR', label: 'Auditor' },
]

export function canManageIdentity(user: CurrentUserResponse | null): boolean {
  return (
    user?.context.kind === 'TENANT' &&
    user.context.grants.some((grant) => grant.role === 'INSTITUTION_ADMIN')
  )
}

export function roleLabel(role: TenantRole): string {
  return TENANT_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
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
