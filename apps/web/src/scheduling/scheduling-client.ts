import type { AllocationInput, AllocationPreview, ExamPaperRecord, ExamScheduleRecord, HallCreateInput, HallRecord, PaperScheduleInput, SchedulingSnapshot } from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class SchedulingApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  list(): Promise<SchedulingSnapshot> { return this.requester.request('/scheduling') }
  createHall(input: HallCreateInput): Promise<HallRecord> { return this.requester.request('/scheduling/halls', { method: 'POST', body: JSON.stringify(input) }) }
  initialize(examId: string): Promise<ExamScheduleRecord> { return this.requester.request(`/scheduling/exams/${encodeURIComponent(examId)}/initialize`, { method: 'POST' }) }
  updatePaper(id: string, input: PaperScheduleInput): Promise<ExamPaperRecord> { return this.requester.request(`/scheduling/papers/${encodeURIComponent(id)}/schedule`, { method: 'PUT', body: JSON.stringify(input) }) }
  preview(id: string, input: AllocationInput): Promise<AllocationPreview> { return this.requester.request(`/scheduling/papers/${encodeURIComponent(id)}/allocations/preview`, { method: 'POST', body: JSON.stringify(input) }) }
  commit(id: string, input: AllocationInput): Promise<ExamPaperRecord> { return this.requester.request(`/scheduling/papers/${encodeURIComponent(id)}/allocations/commit`, { method: 'POST', body: JSON.stringify(input) }) }
  publish(examId: string, expectedVersion: number): Promise<ExamScheduleRecord> { return this.requester.request(`/scheduling/exams/${encodeURIComponent(examId)}/publish`, { method: 'POST', body: JSON.stringify({ expectedVersion }) }) }
}
