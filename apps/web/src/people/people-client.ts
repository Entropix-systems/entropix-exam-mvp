import type {
  FacultyDirectoryRecord,
  StudentDirectoryRecord,
  StudentDirectoryResponse,
  StudentImportCommitResult,
  StudentImportPreview,
  StudentImportRequest,
} from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class PeopleApiClient {
  private readonly requester: AuthApiClient

  constructor(requester: AuthApiClient) {
    this.requester = requester
  }

  listStudents(options: {
    search?: string
    cursor?: string | null
    pageSize?: number
  } = {}): Promise<StudentDirectoryResponse> {
    const query = new URLSearchParams()
    if (options.search?.trim()) query.set('search', options.search.trim())
    if (options.cursor) query.set('cursor', options.cursor)
    if (options.pageSize) query.set('pageSize', String(options.pageSize))
    return this.requester.request(
      `/people/students${query.size ? `?${query.toString()}` : ''}`,
    )
  }

  getStudent(id: string): Promise<StudentDirectoryRecord> {
    return this.requester.request(`/people/students/${encodeURIComponent(id)}`)
  }

  listFaculty(): Promise<readonly FacultyDirectoryRecord[]> {
    return this.requester.request('/people/faculty')
  }

  previewStudents(input: StudentImportRequest): Promise<StudentImportPreview> {
    return this.requester.request('/people/student-imports/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  commitStudents(input: StudentImportRequest): Promise<StudentImportCommitResult> {
    return this.requester.request('/people/student-imports/commit', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }
}
