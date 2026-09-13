import { describe, expect, it, vi } from 'vitest'
import type { CurrentUserResponse } from '@entropix/contracts'
import { AuthApiClient } from './auth-client'

const me: CurrentUserResponse = {
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  context: {
    kind: 'TENANT',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: '11111111-1111-4111-8111-111111111111',
    membershipId: '22222222-2222-4222-8222-222222222222',
    grants: [{ role: 'STUDENT', departmentId: null }],
  },
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status < 400
        ? { data, requestId: 'request-1' }
        : {
            code: status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
            message: 'Session is not valid',
            fieldErrors: [],
            requestId: 'request-1',
          },
    ),
    { status, headers: { 'content-type': 'application/json' } },
  )
}

describe('AuthApiClient', () => {
  it('restores the session through the HttpOnly cookie and keeps access authority in memory', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'restored', expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse(me))
    const client = new AuthApiClient('/api/v1', fetchMock)
    await expect(client.restoreSession()).resolves.toEqual(me)
    expect(client.hasAccessToken()).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/refresh')
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include')
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('x-csrf-protection')).toBe('1')
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer restored')
  })

  it('coordinates concurrent ordinary-request refresh with one in-flight promise', async () => {
    let token = 'old-access'
    let refreshCalls = 0
    let releaseRefresh: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { releaseRefresh = resolve })
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input)
      if (path.endsWith('/auth/login')) return jsonResponse({ accessToken: token, expiresInSeconds: 900 })
      if (path.endsWith('/auth/me')) return jsonResponse(me)
      if (path.endsWith('/auth/refresh')) {
        refreshCalls += 1
        await gate
        token = 'new-access'
        return jsonResponse({ accessToken: token, expiresInSeconds: 900 })
      }
      const authorization = new Headers(init?.headers).get('authorization')
      return authorization === 'Bearer new-access'
        ? jsonResponse({ value: path })
        : jsonResponse(null, 401)
    })
    const client = new AuthApiClient('/api/v1', fetchMock)
    await client.login({ email: 'a@example.test', password: 'correct password', institutionSlug: 'northstar-college' })
    const first = client.request<{ value: string }>('/resource/one')
    const second = client.request<{ value: string }>('/resource/two')
    await vi.waitFor(() => expect(refreshCalls).toBe(1))
    releaseRefresh?.()
    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: '/api/v1/resource/one' },
      { value: '/api/v1/resource/two' },
    ])
    expect(refreshCalls).toBe(1)
  })

  it('clears in-memory access state after logout even when the server rejects it', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'access', expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse(me))
      .mockResolvedValueOnce(jsonResponse(null, 401))
      .mockResolvedValueOnce(jsonResponse(null, 401))
    const client = new AuthApiClient('/api/v1', fetchMock)
    await client.login({ email: 'a@example.test', password: 'correct password' })
    await expect(client.logout()).rejects.toMatchObject({ status: 401 })
    expect(client.hasAccessToken()).toBe(false)
  })

  it('clears state and returns to unauthenticated behavior when refresh fails', async () => {
    const client = new AuthApiClient(
      '/api/v1',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(null, 401)),
    )
    await expect(client.restoreSession()).rejects.toMatchObject({ status: 401 })
    expect(client.hasAccessToken()).toBe(false)
  })

  it('notifies the shell when an ordinary request cannot refresh a revoked session', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'access', expiresInSeconds: 900 }))
      .mockResolvedValueOnce(jsonResponse(me))
      .mockResolvedValueOnce(jsonResponse(null, 401))
      .mockResolvedValueOnce(jsonResponse(null, 401))
    const client = new AuthApiClient('/api/v1', fetchMock)
    const sessionFailed = vi.fn()
    client.onSessionFailure(sessionFailed)
    await client.login({ email: 'a@example.test', password: 'correct password' })

    await expect(client.request('/protected')).rejects.toMatchObject({ status: 401 })

    expect(sessionFailed).toHaveBeenCalledOnce()
    expect(client.hasAccessToken()).toBe(false)
  })

  it('never writes access tokens to browser persistence', async () => {
    const storageNames = ['localStorage', 'sessionStorage', 'indexedDB'] as const
    const descriptors = storageNames.map((name) =>
      Object.getOwnPropertyDescriptor(globalThis, name),
    )
    for (const name of storageNames)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get: () => {
          throw new Error(`Browser persistence accessed: ${name}`)
        },
      })
    try {
      const client = new AuthApiClient(
        '/api/v1',
        vi.fn<typeof fetch>()
          .mockResolvedValueOnce(jsonResponse({ accessToken: 'memory-only', expiresInSeconds: 900 }))
          .mockResolvedValueOnce(jsonResponse(me)),
      )
      await client.login({ email: 'a@example.test', password: 'correct password' })
      expect(client.hasAccessToken()).toBe(true)
    } finally {
      storageNames.forEach((name, index) => {
        const descriptor = descriptors[index]
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else Reflect.deleteProperty(globalThis, name)
      })
    }
  })
})
