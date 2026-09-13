import type {
  AcceptInvitationRequest,
  AccessTokenResponse,
  ApiError,
  ApiSuccess,
  CurrentUserResponse,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from '@entropix/contracts'

export class AuthApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

export type FetchImplementation = typeof fetch

export class AuthApiClient {
  private accessToken: string | null = null
  private refreshInFlight: Promise<void> | null = null
  private readonly sessionFailureListeners = new Set<() => void>()
  private readonly baseUrl: string
  private readonly fetchImplementation: FetchImplementation

  constructor(
    baseUrl: string,
    fetchImplementation?: FetchImplementation,
  ) {
    this.baseUrl = baseUrl
    this.fetchImplementation =
      fetchImplementation ?? globalThis.fetch.bind(globalThis)
  }

  hasAccessToken(): boolean {
    return this.accessToken !== null
  }

  onSessionFailure(listener: () => void): () => void {
    this.sessionFailureListeners.add(listener)
    return () => this.sessionFailureListeners.delete(listener)
  }

  async login(input: LoginRequest): Promise<CurrentUserResponse> {
    const issued = await this.send<AccessTokenResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    )
    this.accessToken = issued.accessToken
    try {
      return await this.getMe(false)
    } catch (error) {
      this.clearSession()
      throw error
    }
  }

  async restoreSession(): Promise<CurrentUserResponse> {
    try {
      await this.refreshSession()
      return await this.getMe(false)
    } catch (error) {
      this.clearSession()
      throw error
    }
  }

  async getMe(retryAfterRefresh = true): Promise<CurrentUserResponse> {
    return this.send<CurrentUserResponse>(
      '/auth/me',
      { method: 'GET' },
      retryAfterRefresh,
    )
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.send<{ loggedOut: true }>(
          '/auth/logout',
          {
            method: 'POST',
            headers: { 'x-csrf-protection': '1' },
          },
          true,
        )
      }
    } finally {
      this.clearSession()
    }
  }

  forgotPassword(input: ForgotPasswordRequest): Promise<{ accepted: true }> {
    return this.send(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    )
  }

  resetPassword(input: ResetPasswordRequest): Promise<{ reset: true }> {
    return this.send(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    )
  }

  acceptInvitation(
    input: AcceptInvitationRequest,
  ): Promise<{ accepted: true }> {
    return this.send(
      '/auth/invitations/accept',
      { method: 'POST', body: JSON.stringify(input) },
      false,
    )
  }

  clearSession(): void {
    this.accessToken = null
  }

  /** Ordinary API calls share one refresh operation in this browser context. */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.send<T>(path, init, true)
  }

  private async refreshSession(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null
      })
    }
    return this.refreshInFlight
  }

  private async performRefresh(): Promise<void> {
    try {
      const issued = await this.send<AccessTokenResponse>(
        '/auth/refresh',
        {
          method: 'POST',
          headers: { 'x-csrf-protection': '1' },
        },
        false,
      )
      this.accessToken = issued.accessToken
    } catch (error) {
      this.clearSession()
      this.sessionFailureListeners.forEach((listener) => listener())
      throw error
    }
  }

  private async send<T>(
    path: string,
    init: RequestInit,
    retryAfterRefresh: boolean,
  ): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    if (this.accessToken)
      headers.set('Authorization', `Bearer ${this.accessToken}`)
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })
    if (response.status === 401 && retryAfterRefresh) {
      await this.refreshSession()
      return this.send<T>(path, init, false)
    }
    const payload = (await response.json().catch(() => null)) as
      | ApiSuccess<T>
      | ApiError
      | null
    if (!response.ok) {
      const error = payload as ApiError | null
      throw new AuthApiError(
        response.status,
        error?.code ?? 'REQUEST_FAILED',
        error?.message ?? 'Request failed',
        error?.requestId,
      )
    }
    if (!payload || !('data' in payload))
      throw new AuthApiError(500, 'INVALID_RESPONSE', 'Request failed')
    return payload.data
  }
}
