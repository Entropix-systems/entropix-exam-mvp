import type {
  CurrentStudentDocumentMetadata,
  OwnPublishedResultRecord,
  OwnRegistrationRecord,
  OwnTimetableRecord,
  StudentPortalSnapshot,
} from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class StudentPortalApiClient {
  private readonly requester: AuthApiClient

  constructor(requester: AuthApiClient) {
    this.requester = requester
  }

  snapshot(): Promise<StudentPortalSnapshot> {
    return this.requester.request('/me/student-portal')
  }

  registrations(): Promise<readonly OwnRegistrationRecord[]> {
    return this.requester.request('/me/registrations')
  }

  timetable(): Promise<readonly OwnTimetableRecord[]> {
    return this.requester.request('/me/timetable')
  }

  result(): Promise<OwnPublishedResultRecord | null> {
    return this.requester.request('/me/result')
  }

  documents(): Promise<readonly CurrentStudentDocumentMetadata[]> {
    return this.requester.request('/me/documents')
  }
}
