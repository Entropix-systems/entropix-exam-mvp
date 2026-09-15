import type {
  EvaluationAssignmentInput,
  EvaluationSnapshot,
  MarksReviewInput,
  MarksSaveInput,
  MarksTransitionInput,
} from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class EvaluationApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  list(): Promise<EvaluationSnapshot> { return this.requester.request('/evaluation') }
  assign(examSubjectId: string, input: EvaluationAssignmentInput): Promise<unknown> {
    return this.requester.request('/evaluation/subjects/' + encodeURIComponent(examSubjectId) + '/assignment', { method: 'PUT', body: JSON.stringify(input) })
  }
  save(examSubjectId: string, input: MarksSaveInput): Promise<unknown> {
    return this.requester.request('/evaluation/subjects/' + encodeURIComponent(examSubjectId) + '/marks', { method: 'PUT', body: JSON.stringify(input) })
  }
  submit(examSubjectId: string, input: MarksTransitionInput): Promise<unknown> {
    return this.requester.request('/evaluation/subjects/' + encodeURIComponent(examSubjectId) + '/submit', { method: 'POST', body: JSON.stringify(input) })
  }
  returnBatch(examSubjectId: string, input: MarksReviewInput): Promise<unknown> {
    return this.requester.request('/evaluation/subjects/' + encodeURIComponent(examSubjectId) + '/return', { method: 'POST', body: JSON.stringify(input) })
  }
  approve(examSubjectId: string, input: MarksReviewInput): Promise<unknown> {
    return this.requester.request('/evaluation/subjects/' + encodeURIComponent(examSubjectId) + '/approve', { method: 'POST', body: JSON.stringify(input) })
  }
  reopen(examSubjectId: string, input: MarksReviewInput): Promise<unknown> {
    return this.requester.request('/evaluation/subjects/' + encodeURIComponent(examSubjectId) + '/reopen', { method: 'POST', body: JSON.stringify(input) })
  }
}
