import type {
  CurrentStudentResultRecord,
  PublicationRecord,
  ResultRunRecord,
  ResultsSnapshot,
  ResultWithdrawalInput,
} from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class ResultsApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  snapshot(): Promise<ResultsSnapshot> { return this.requester.request('/results') }
  compute(examId: string): Promise<ResultRunRecord> {
    return this.requester.request('/results/exams/' + encodeURIComponent(examId) + '/compute', { method: 'POST' })
  }
  readRun(resultRunId: string): Promise<ResultRunRecord> {
    return this.requester.request('/results/runs/' + encodeURIComponent(resultRunId))
  }
  publish(resultRunId: string): Promise<PublicationRecord> {
    return this.requester.request('/results/runs/' + encodeURIComponent(resultRunId) + '/publish', { method: 'POST' })
  }
  withdraw(examId: string, input: ResultWithdrawalInput): Promise<PublicationRecord> {
    return this.requester.request('/results/exams/' + encodeURIComponent(examId) + '/withdraw', { method: 'POST', body: JSON.stringify(input) })
  }
  currentStudent(): Promise<CurrentStudentResultRecord | null> { return this.requester.request('/results/student/current') }
}
