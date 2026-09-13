import type {
  AcademicInputByResource,
  AcademicRecordByResource,
  AcademicResourcePath,
  AcademicStructureSnapshot,
} from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class AcademicsApiClient {
  private readonly requester: AuthApiClient

  constructor(requester: AuthApiClient) {
    this.requester = requester
  }

  list(): Promise<AcademicStructureSnapshot> {
    return this.requester.request('/academics')
  }

  get<P extends AcademicResourcePath>(
    resource: P,
    id: string,
  ): Promise<AcademicRecordByResource[P]> {
    return this.requester.request(
      `/academics/${resource}/${encodeURIComponent(id)}`,
    )
  }

  create<P extends AcademicResourcePath>(
    resource: P,
    input: AcademicInputByResource[P],
  ): Promise<AcademicRecordByResource[P]> {
    return this.requester.request(`/academics/${resource}`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  update<P extends AcademicResourcePath>(
    resource: P,
    id: string,
    input: AcademicInputByResource[P],
  ): Promise<AcademicRecordByResource[P]> {
    return this.requester.request(
      `/academics/${resource}/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(input) },
    )
  }
}
