import type { ExamCreateInput, ExamRecord, ExamsSnapshot, RegistrationDraftInput, RegistrationRecord } from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class ExamsApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  list(): Promise<ExamsSnapshot> { return this.requester.request('/exams') }
  create(input: ExamCreateInput): Promise<ExamRecord> { return this.requester.request('/exams', { method: 'POST', body: JSON.stringify(input) }) }
  open(id: string): Promise<ExamRecord> { return this.command(`/exams/${encodeURIComponent(id)}/open-registration`) }
  close(id: string): Promise<ExamRecord> { return this.command(`/exams/${encodeURIComponent(id)}/close-registration`) }
  autoEnrol(id: string): Promise<{ createdCount: number }> { return this.command(`/exams/${encodeURIComponent(id)}/auto-enrol`) }
  saveDraft(examId: string, input: RegistrationDraftInput): Promise<RegistrationRecord> { return this.requester.request(`/exams/${encodeURIComponent(examId)}/my-registration`, { method: 'PUT', body: JSON.stringify(input) }) }
  submit(id: string): Promise<RegistrationRecord> { return this.command(`/exams/registrations/${encodeURIComponent(id)}/submit`) }
  approve(id: string, reason?: string): Promise<RegistrationRecord> { return this.command(`/exams/registrations/${encodeURIComponent(id)}/approve`, { reason }) }
  reject(id: string, reason: string): Promise<RegistrationRecord> { return this.command(`/exams/registrations/${encodeURIComponent(id)}/reject`, { reason }) }
  cancel(id: string, reason?: string): Promise<RegistrationRecord> { return this.command(`/exams/registrations/${encodeURIComponent(id)}/cancel`, { reason }) }
  eligibility(id: string, eligible: boolean, reason?: string): Promise<RegistrationRecord> { return this.command(`/exams/registrations/${encodeURIComponent(id)}/eligibility`, { eligible, reason }) }
  private command<T>(path: string, body?: unknown): Promise<T> {
    return this.requester.request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  }
}
