import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthApiClient } from './auth/auth-client'
import { AuthProvider } from './auth/auth-provider'
import { useAuth } from './auth/auth-context'
import { authContextKey } from './auth/context-key'
import { ProtectedRoute } from './auth/protected-route'
import { IdentityApiClient } from './identity/identity-client'
import { AcademicsApiClient } from './academics/academics-client'
import { PeopleApiClient } from './people/people-client'
import { ExamsApiClient } from './exams/exams-client'
import { SchedulingApiClient } from './scheduling/scheduling-client'
import { ConductApiClient } from './conduct/conduct-client'
import { EvaluationApiClient } from './evaluation/evaluation-client'
import { ResultsApiClient } from './results/results-client'
import { StudentPortalApiClient } from './student-portal/student-portal-client'
import { AuditApiClient } from './audit/audit-client'
import { navigate } from './auth/navigation'
import { landingDestination } from './auth/route-policy'
import './App.css'

const AccessDeniedPage = lazy(() => import('./pages/access-denied-page').then((module) => ({ default: module.AccessDeniedPage })))
const ForgotPasswordPage = lazy(() => import('./pages/forgot-password-page').then((module) => ({ default: module.ForgotPasswordPage })))
const HomePage = lazy(() => import('./pages/home-page').then((module) => ({ default: module.HomePage })))
const InvitationPage = lazy(() => import('./pages/invitation-page').then((module) => ({ default: module.InvitationPage })))
const LoginPage = lazy(() => import('./pages/login-page').then((module) => ({ default: module.LoginPage })))
const PlatformPage = lazy(() => import('./pages/platform-page').then((module) => ({ default: module.PlatformPage })))
const MastersPage = lazy(() => import('./pages/masters-page').then((module) => ({ default: module.MastersPage })))
const ResetPasswordPage = lazy(() => import('./pages/reset-password-page').then((module) => ({ default: module.ResetPasswordPage })))
const SetupAccessPage = lazy(() => import('./pages/setup-access-page').then((module) => ({ default: module.SetupAccessPage })))
const StudentsPage = lazy(() => import('./pages/students-page').then((module) => ({ default: module.StudentsPage })))
const ExamsPage = lazy(() => import('./pages/exams-page').then((module) => ({ default: module.ExamsPage })))
const SchedulingPage = lazy(() => import('./pages/scheduling-page').then((module) => ({ default: module.SchedulingPage })))
const ConductPage = lazy(() => import('./pages/conduct-page').then((module) => ({ default: module.ConductPage })))
const EvaluationPage = lazy(() => import('./pages/evaluation-page').then((module) => ({ default: module.EvaluationPage })))
const ResultsPage = lazy(() => import('./pages/results-page').then((module) => ({ default: module.ResultsPage })))
const StudentPortalPage = lazy(() => import('./pages/student-portal-page').then((module) => ({ default: module.StudentPortalPage })))
const ReportsPage = lazy(() => import('./pages/reports-page').then((module) => ({ default: module.ReportsPage })))

const authClient = new AuthApiClient(
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
)
const identityClient = new IdentityApiClient(authClient)
const academicsClient = new AcademicsApiClient(authClient)
const peopleClient = new PeopleApiClient(authClient)
const examsClient = new ExamsApiClient(authClient)
const schedulingClient = new SchedulingApiClient(authClient)
const conductClient = new ConductApiClient(authClient)
const evaluationClient = new EvaluationApiClient(authClient)
const resultsClient = new ResultsApiClient(authClient)
const studentPortalClient = new StudentPortalApiClient(authClient)
const auditClient = new AuditApiClient(authClient)

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return pathname
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, true), [to])
  return null
}

function Routes() {
  const pathname = usePathname()
  const { currentUser } = useAuth()
  const scopeKey = authContextKey(currentUser)
  const studentRole = currentUser?.context.kind === 'TENANT' && currentUser.context.activeRole === 'STUDENT'
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/forgot-password')
    return <ForgotPasswordPage client={authClient} />
  if (pathname === '/reset-password')
    return <ResetPasswordPage client={authClient} />
  if (pathname === '/accept-invitation')
    return <InvitationPage client={authClient} />
  if (pathname === '/access-denied') return <AccessDeniedPage />
  if (pathname === '/platform') {
    if (currentUser?.context.kind === 'TENANT') return <Redirect to={landingDestination(currentUser)} />
    return <ProtectedRoute><PlatformPage /></ProtectedRoute>
  }
  if (pathname === '/setup-access')
    return (
      <ProtectedRoute>
        <SetupAccessPage key={scopeKey} client={identityClient} />
      </ProtectedRoute>
    )
  if (pathname === '/masters')
    return (
      <ProtectedRoute>
        <MastersPage key={scopeKey} client={academicsClient} />
      </ProtectedRoute>
    )
  if (pathname === '/students')
    return (
      <ProtectedRoute>
        <StudentsPage key={scopeKey} client={peopleClient} />
      </ProtectedRoute>
    )
  if (pathname === '/exams')
    return (
      <ProtectedRoute>
        <ExamsPage key={scopeKey} client={examsClient} academicClient={academicsClient} />
      </ProtectedRoute>
    )
  if (pathname === '/schedule')
    return (
      <ProtectedRoute>
        <SchedulingPage key={scopeKey} client={schedulingClient} academicClient={academicsClient} />
      </ProtectedRoute>
    )
  if (pathname === '/attendance')
    return (
      <ProtectedRoute>
        <ConductPage key={scopeKey} client={conductClient} />
      </ProtectedRoute>
    )
  if (pathname === '/marks')
    return (
      <ProtectedRoute>
        <EvaluationPage key={scopeKey} client={evaluationClient} />
      </ProtectedRoute>
    )
  if (pathname === '/results')
    return (
      <ProtectedRoute>
        <ResultsPage key={scopeKey} client={resultsClient} />
      </ProtectedRoute>
    )
  if (pathname === '/student')
    return (
      <ProtectedRoute>
        <StudentPortalPage key={scopeKey} client={studentPortalClient} />
      </ProtectedRoute>
    )
  if (pathname === '/reports')
    return (
      <ProtectedRoute>
        <ReportsPage key={scopeKey} client={auditClient} />
      </ProtectedRoute>
    )
  if (studentRole)
    return (
      <ProtectedRoute>
        <StudentPortalPage key={scopeKey} client={studentPortalClient} />
      </ProtectedRoute>
    )
  if (pathname === '/' && currentUser?.context.kind === 'PLATFORM')
    return <ProtectedRoute><Redirect to="/platform" /></ProtectedRoute>
  return (
    <ProtectedRoute>
      <HomePage key={scopeKey} client={auditClient} />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider client={authClient}>
      <Suspense fallback={<p className="evaluation-empty">Loading workspace…</p>}>
        <Routes />
      </Suspense>
    </AuthProvider>
  )
}
