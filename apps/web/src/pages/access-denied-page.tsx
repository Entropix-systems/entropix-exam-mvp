import { navigate } from '../auth/navigation'
import { AuthLayout } from './auth-layout'

export function AccessDeniedPage() {
  return <AuthLayout title="Access unavailable" intro="Your current account or institution membership cannot access this area."><button type="button" className="primary-button" onClick={() => navigate('/login', true)}>Return to sign in</button></AuthLayout>
}
