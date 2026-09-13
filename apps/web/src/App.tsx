import { useEffect, useState } from 'react'
import { AuthApiClient } from './auth/auth-client'
import { AuthProvider } from './auth/auth-provider'
import { ProtectedRoute } from './auth/protected-route'
import { IdentityApiClient } from './identity/identity-client'
import { AcademicsApiClient } from './academics/academics-client'
import { PeopleApiClient } from './people/people-client'
import { ExamsApiClient } from './exams/exams-client'
import { SchedulingApiClient } from './scheduling/scheduling-client'
import { AccessDeniedPage } from './pages/access-denied-page'
import { ForgotPasswordPage } from './pages/forgot-password-page'
import { HomePage } from './pages/home-page'
import { InvitationPage } from './pages/invitation-page'
import { LoginPage } from './pages/login-page'
import { ResetPasswordPage } from './pages/reset-password-page'
import { SetupAccessPage } from './pages/setup-access-page'
import { StudentsPage } from './pages/students-page'
import { ExamsPage } from './pages/exams-page'
import { SchedulingPage } from './pages/scheduling-page'
import './App.css'

const authClient = new AuthApiClient(
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
)
const identityClient = new IdentityApiClient(authClient)
const academicsClient = new AcademicsApiClient(authClient)
const peopleClient = new PeopleApiClient(authClient)
const examsClient = new ExamsApiClient(authClient)
const schedulingClient = new SchedulingApiClient(authClient)

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
        <SetupAccessPage client={identityClient} academicClient={academicsClient} />
      </ProtectedRoute>
    )
  if (pathname === '/students')
    return (
      <ProtectedRoute>
        <StudentsPage client={peopleClient} />
      </ProtectedRoute>
    )
  if (pathname === '/exams')
    return (
      <ProtectedRoute>
        <ExamsPage client={examsClient} academicClient={academicsClient} />
      </ProtectedRoute>
    )
  if (pathname === '/schedule')
    return (
      <ProtectedRoute>
        <SchedulingPage client={schedulingClient} academicClient={academicsClient} />
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
