import type { CursorPage, UUID } from './common.js';
import type {
  AuthenticatedContext,
  ScopedRoleGrant,
  TenantRole,
} from './context.js';
import type { VersionedCommand } from './commands.js';

export const AUTH_TOKEN_PURPOSES = {
  INVITATION: 'INVITATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  REFRESH: 'REFRESH',
} as const;
export type AuthTokenPurpose =
  (typeof AUTH_TOKEN_PURPOSES)[keyof typeof AUTH_TOKEN_PURPOSES];

/** Protocol operations use one-time/session semantics, not cached responses. */
export const AUTH_PROTOCOL_OPERATIONS = [
  'login',
  'refresh',
  'logout',
  'context-switch',
  'forgot-password',
  'reset-password',
  'invitation-acceptance',
] as const;

export interface LoginRequest {
  email: string;
  password: string;
}
export interface ForgotPasswordRequest {
  email: string;
}
export interface ResetPasswordRequest {
  token: string;
  password: string;
}
/** Existing users authenticate; this field never replaces existing credentials. */
export interface AcceptInvitationRequest {
  token: string;
  password?: string;
}
export interface AccessTokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}
export interface CurrentUserResponse {
  context: AuthenticatedContext;
  sessionId: UUID;
  email: string;
  institutions: readonly InstitutionAccessSummary[];
}
export interface InstitutionAccessSummary {
  id: UUID;
  name: string;
  slug: string;
}
export interface SwitchAuthContextRequest {
  institutionId?: UUID;
  role?: TenantRole;
  returnToPlatform?: true;
}
export interface PlatformInstitutionSummary extends InstitutionAccessSummary {
  code: string;
  type: string;
  status: string;
  academicYear: string | null;
  onboardingState: string;
}
export interface OnboardInstitutionRequest {
  name: string;
  code: string;
  type: string;
  primaryAdministratorName: string;
  primaryAdministratorEmail: string;
  academicYear: string;
  status: 'ACTIVE' | 'SUSPENDED';
  requestId: string;
}
export interface MembershipDirectoryItem {
  id: UUID;
  email: string;
  name: string | null;
  status: string;
  version: number;
  grants: readonly ScopedRoleGrant[];
}
export interface MembershipDirectoryResponse {
  institutionName: string;
  departments: readonly { id: UUID; name: string }[];
  memberships: CursorPage<MembershipDirectoryItem>;
  pageSize: number;
}
export interface CreateInvitationRequest {
  email: string;
  grants: readonly ScopedRoleGrant[];
}
export interface ReplaceRoleGrantsRequest extends VersionedCommand {
  grants: readonly ScopedRoleGrant[];
}

/** Signed identity hints only. Current authority must be resolved from persistence. */
export type AccessTokenIdentity = {
  userId: UUID;
  sessionId: UUID;
} & (
  { kind: 'TENANT'; tenantId: UUID; membershipId: UUID }
  | { kind: 'PLATFORM'; tenantId?: UUID }
);

export const IAM_PERMISSIONS = {
  CURRENT_USER_READ: 'iam.current-user.read',
  OWN_SESSIONS_MANAGE: 'iam.own-sessions.manage',
  MEMBERSHIPS_READ: 'iam.memberships.read',
  MEMBERSHIPS_MANAGE: 'iam.memberships.manage',
  INVITATIONS_MANAGE: 'iam.invitations.manage',
  ROLE_GRANTS_MANAGE: 'iam.role-grants.manage',
  TENANT_SESSIONS_REVOKE: 'iam.tenant-sessions.revoke',
  PLATFORM_USERS_MANAGE: 'iam.platform-users.manage',
} as const;
export type IamPermission =
  (typeof IAM_PERMISSIONS)[keyof typeof IAM_PERMISSIONS];

/** The server loads these IDs from the target resource, not a client assertion. */
export type PermissionScope =
  | { kind: 'SELF'; userId: UUID }
  | { kind: 'TENANT'; tenantId: UUID; departmentId: UUID | null }
  | { kind: 'PLATFORM' };
