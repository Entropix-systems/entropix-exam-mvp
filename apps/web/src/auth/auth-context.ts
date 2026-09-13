import { createContext, useContext } from 'react'
import type {
  CurrentUserResponse,
  LoginRequest,
  TenantRole,
} from '@entropix/contracts'

export type AuthStatus =
  | 'RESTORING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'ACCESS_DENIED'

export interface AuthContextValue {
  status: AuthStatus
  currentUser: CurrentUserResponse | null
  login(input: LoginRequest): Promise<void>
  switchInstitution(institutionId: string): Promise<void>
  switchRole(role: TenantRole): Promise<void>
  logout(): Promise<void>
  restore(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
