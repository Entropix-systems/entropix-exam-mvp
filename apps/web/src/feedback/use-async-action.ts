import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error?: unknown; duplicate?: boolean }

export function createAsyncActionGate() {
  let active = false
  return async function runExclusive<T>(operation: () => Promise<T>): Promise<AsyncActionResult<T>> {
    if (active) return { ok: false, duplicate: true }
    active = true
    try {
      return { ok: true, value: await operation() }
    } catch (error) {
      return { ok: false, error }
    } finally {
      active = false
    }
  }
}

export function createKeyedAsyncActionGate() {
  const activeKeys = new Set<string>()
  return async function runExclusive<T>(key: string, operation: () => Promise<T>): Promise<AsyncActionResult<T>> {
    if (activeKeys.has(key)) return { ok: false, duplicate: true }
    activeKeys.add(key)
    try {
      return { ok: true, value: await operation() }
    } catch (error) {
      return { ok: false, error }
    } finally {
      activeKeys.delete(key)
    }
  }
}

export type MutationRefreshResult<T> =
  | { status: 'success'; value: T }
  | { status: 'mutation-failed'; error: unknown }
  | { status: 'refresh-failed'; value: T; error: unknown }

export async function runMutationAndRefresh<T>(
  mutation: () => Promise<T>,
  refresh: () => Promise<unknown>,
): Promise<MutationRefreshResult<T>> {
  let value: T
  try {
    value = await mutation()
  } catch (error) {
    return { status: 'mutation-failed', error }
  }
  try {
    await refresh()
    return { status: 'success', value }
  } catch (error) {
    return { status: 'refresh-failed', value, error }
  }
}

export function useAsyncAction() {
  const gate = useRef(createKeyedAsyncActionGate())
  const mounted = useRef(true)
  const [pendingActions, setPendingActions] = useState<readonly string[]>([])

  useEffect(() => () => { mounted.current = false }, [])

  const run = useCallback(async <T,>(key: string, operation: () => Promise<T>): Promise<AsyncActionResult<T>> => {
    return gate.current(key, async () => {
      if (mounted.current) setPendingActions((current) => current.includes(key) ? current : [...current, key])
      try {
        return await operation()
      } finally {
        if (mounted.current) setPendingActions((current) => current.filter((entry) => entry !== key))
      }
    })
  }, [])

  const runMutationWithRefresh = useCallback(async <T,>(
    key: string,
    mutation: () => Promise<T>,
    refresh: () => Promise<unknown>,
  ): Promise<MutationRefreshResult<T> | { status: 'duplicate' }> => {
    const result = await run(key, () => runMutationAndRefresh(mutation, refresh))
    if (result.ok) return result.value
    if (result.duplicate) return { status: 'duplicate' }
    return { status: 'mutation-failed', error: result.error }
  }, [run])

  return {
    pendingAction: pendingActions.length === 1 ? pendingActions[0] ?? null : null,
    pendingActions,
    isPending: pendingActions.length > 0,
    run,
    runMutationWithRefresh,
  }
}
