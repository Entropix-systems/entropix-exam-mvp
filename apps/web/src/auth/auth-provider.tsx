import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type {
  CurrentUserResponse,
  LoginRequest,
  TenantRole,
} from '@entropix/contracts'
import { AuthApiClient, AuthApiError } from './auth-client'
import { AuthContext } from './auth-context'
import type { AuthStatus } from './auth-context'

export function AuthProvider({
  client,
  children,
}: PropsWithChildren<{ client: AuthApiClient }>) {
  const [status, setStatus] = useState<AuthStatus>('RESTORING')
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null)

  const failSession = useCallback(
    (error: unknown) => {
      client.clearSession()
      setCurrentUser(null)
      setStatus(
        error instanceof AuthApiError && error.status === 403
          ? 'ACCESS_DENIED'
          : 'UNAUTHENTICATED',
      )
    },
    [client],
  )

  const restore = useCallback(async () => {
    setStatus('RESTORING')
    try {
      setCurrentUser(await client.restoreSession())
      setStatus('AUTHENTICATED')
    } catch (error) {
      failSession(error)
    }
  }, [client, failSession])

  useEffect(
    () => client.onSessionFailure(() => failSession(undefined)),
    [client, failSession],
  )

  useEffect(() => {
    let active = true
    void client.restoreSession().then(
      (user) => {
        if (!active) return
        setCurrentUser(user)
        setStatus('AUTHENTICATED')
      },
      (error: unknown) => {
        if (active) failSession(error)
      },
    )
    return () => {
      active = false
    }
  }, [client, failSession])

  const login = useCallback(
    async (input: LoginRequest) => {
      const user = await client.login(input)
      setCurrentUser(user)
      setStatus('AUTHENTICATED')
      return user
    },
    [client],
  )

  const switchInstitution = useCallback(
    async (institutionId: string) => {
      const user = await client.switchContext({ institutionId })
      setCurrentUser(user)
      setStatus('AUTHENTICATED')
      return user
    },
    [client],
  )

  const returnToPlatform = useCallback(async () => {
    const user = await client.returnToPlatform()
    setCurrentUser(user)
    setStatus('AUTHENTICATED')
    return user
  }, [client])

  const switchRole = useCallback(
    async (role: TenantRole) => {
      if (!currentUser || currentUser.context.kind !== 'TENANT') {
        throw new AuthApiError(403, 'CONTEXT_UNAVAILABLE', 'Access context could not be changed.')
      }
      const user = await client.switchContext({
        institutionId: currentUser.context.tenantId,
        role,
      })
      setCurrentUser(user)
      setStatus('AUTHENTICATED')
      return user
    },
    [client, currentUser],
  )

  const logout = useCallback(async () => {
    try {
      await client.logout()
    } finally {
      setCurrentUser(null)
      setStatus('UNAUTHENTICATED')
    }
  }, [client])

  const value = useMemo(
    () => ({
      status,
      currentUser,
      login,
      switchInstitution,
      returnToPlatform,
      switchRole,
      logout,
      restore,
    }),
    [
      status,
      currentUser,
      login,
      switchInstitution,
      returnToPlatform,
      switchRole,
      logout,
      restore,
    ],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
