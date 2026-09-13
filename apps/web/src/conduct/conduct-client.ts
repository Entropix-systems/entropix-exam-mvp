import type {
  AssignDutyInput,
  AttendanceReopenInput,
  AttendanceSaveInput,
  AttendanceSubmitInput,
  ConductResultState,
  ConductSnapshot,
  DeclineDutyInput,
  IncidentCreateInput,
  IncidentDispositionInput,
} from '@entropix/contracts'
import { AuthApiClient } from '../auth/auth-client'

export class ConductApiClient {
  private readonly requester: AuthApiClient
  constructor(requester: AuthApiClient) { this.requester = requester }
  list(): Promise<ConductSnapshot> { return this.requester.request('/conduct') }
  assign(sittingId: string, input: AssignDutyInput): Promise<unknown> { return this.requester.request(`/conduct/sittings/${encodeURIComponent(sittingId)}/duties`, { method: 'POST', body: JSON.stringify(input) }) }
  accept(dutyId: string): Promise<unknown> { return this.requester.request(`/conduct/duties/${encodeURIComponent(dutyId)}/accept`, { method: 'POST' }) }
  decline(dutyId: string, input: DeclineDutyInput): Promise<unknown> { return this.requester.request(`/conduct/duties/${encodeURIComponent(dutyId)}/decline`, { method: 'POST', body: JSON.stringify(input) }) }
  saveAttendance(sittingId: string, input: AttendanceSaveInput): Promise<unknown> { return this.requester.request(`/conduct/sittings/${encodeURIComponent(sittingId)}/attendance`, { method: 'PUT', body: JSON.stringify(input) }) }
  submitAttendance(sittingId: string, input: AttendanceSubmitInput): Promise<unknown> { return this.requester.request(`/conduct/sittings/${encodeURIComponent(sittingId)}/attendance/submit`, { method: 'POST', body: JSON.stringify(input) }) }
  reopenAttendance(sittingId: string, input: AttendanceReopenInput): Promise<unknown> { return this.requester.request(`/conduct/sittings/${encodeURIComponent(sittingId)}/attendance/reopen`, { method: 'POST', body: JSON.stringify(input) }) }
  createIncident(sittingId: string, input: IncidentCreateInput): Promise<unknown> { return this.requester.request(`/conduct/sittings/${encodeURIComponent(sittingId)}/incidents`, { method: 'POST', body: JSON.stringify(input) }) }
  disposeIncident(incidentId: string, input: IncidentDispositionInput): Promise<unknown> { return this.requester.request(`/conduct/incidents/${encodeURIComponent(incidentId)}/disposition`, { method: 'POST', body: JSON.stringify(input) }) }
  resultState(examId: string): Promise<ConductResultState> { return this.requester.request(`/conduct/exams/${encodeURIComponent(examId)}/result-state`) }
}
