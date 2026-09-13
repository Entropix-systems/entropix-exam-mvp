import { useEffect, useState } from 'react'
import { AuthApiClient } from './auth/auth-client'
import { AuthProvider } from './auth/auth-provider'
import { ProtectedRoute } from './auth/protected-route'
import { IdentityApiClient } from './identity/identity-client'
import { AccessDeniedPage } from './pages/access-denied-page'
import { ForgotPasswordPage } from './pages/forgot-password-page'
import { HomePage } from './pages/home-page'
import { InvitationPage } from './pages/invitation-page'
import { LoginPage } from './pages/login-page'
import { ResetPasswordPage } from './pages/reset-password-page'
import { SetupAccessPage } from './pages/setup-access-page'
import './App.css'

const authClient = new AuthApiClient(
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
)
const identityClient = new IdentityApiClient(authClient)

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return pathname
}
function Routes() {
  const pathname = usePathname()
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/forgot-password')
    return <ForgotPasswordPage client={authClient} />
  if (pathname === '/reset-password')
    return <ResetPasswordPage client={authClient} />
  if (pathname === '/accept-invitation')
    return <InvitationPage client={authClient} />
  if (pathname === '/access-denied') return <AccessDeniedPage />
  if (pathname === '/setup-access')
    return (
      <ProtectedRoute>
        <SetupAccessPage client={identityClient} />
      </ProtectedRoute>
    )
  return (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider client={authClient}>
      <Routes />
    </AuthProvider>
  )
}
