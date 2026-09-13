import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from './auth-context'
import { protectedDestination } from './route-policy'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { status } = useAuth()
  useEffect(() => {
    const destination = protectedDestination(status)
    if (destination) {
      window.history.replaceState(null, '', destination)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [status])
  if (status === 'RESTORING') return <p role="status">Restoring session…</p>
  if (status !== 'AUTHENTICATED') return null
  return children
}
