import type { OnboardInstitutionRequest, PlatformInstitutionSummary } from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class PlatformApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  institutions(): Promise<readonly PlatformInstitutionSummary[]> { return this.requester.request('/platform/institutions') }
  onboard(input: Omit<OnboardInstitutionRequest, 'requestId'>): Promise<PlatformInstitutionSummary> {
    return this.requester.request('/platform/institutions', { method: 'POST', body: JSON.stringify(input) })
  }
  setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<PlatformInstitutionSummary> {
    return this.requester.request(`/platform/institutions/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) })
  }
}
