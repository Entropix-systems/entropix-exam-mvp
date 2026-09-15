import { describe, expect, it, vi } from 'vitest'
import { createAsyncActionGate, createKeyedAsyncActionGate, runMutationAndRefresh } from './use-async-action'

describe('async action gate', () => {
  it('suppresses a repeated invocation until the first operation settles', async () => {
    let release: (() => void) | undefined
    const deferred = new Promise<void>((resolve) => { release = resolve })
    const operation = vi.fn(() => deferred)
    const run = createAsyncActionGate()

    const first = run(operation)
    const duplicate = await run(operation)

    expect(duplicate).toEqual({ ok: false, duplicate: true })
    expect(operation).toHaveBeenCalledTimes(1)
    release?.()
    await expect(first).resolves.toEqual({ ok: true, value: undefined })
  })

  it('allows retry after failure', async () => {
    const run = createAsyncActionGate()
    await expect(run(async () => { throw new Error('failed') })).resolves.toMatchObject({ ok: false })
    await expect(run(async () => 'retried')).resolves.toEqual({ ok: true, value: 'retried' })
  })

  it('isolates keys while still suppressing a duplicate of the same action', async () => {
    let release: (() => void) | undefined
    const deferred = new Promise<void>((resolve) => { release = resolve })
    const run = createKeyedAsyncActionGate()

    const first = run('save-marks', () => deferred)
    const duplicate = await run('save-marks', () => Promise.resolve())
    const unrelated = await run('refresh-preview', async () => 'available')

    expect(duplicate).toEqual({ ok: false, duplicate: true })
    expect(unrelated).toEqual({ ok: true, value: 'available' })
    release?.()
    await expect(first).resolves.toEqual({ ok: true, value: undefined })
  })

  it('keeps a committed mutation distinct from a failed refresh and never reruns it', async () => {
    const mutation = vi.fn(async () => 'committed')
    const refresh = vi.fn(async () => { throw new Error('reload unavailable') })

    await expect(runMutationAndRefresh(mutation, refresh)).resolves.toMatchObject({
      status: 'refresh-failed',
      value: 'committed',
    })
    expect(mutation).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('permits a safe retry after a mutation failure', async () => {
    const mutation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('saved')
    const refresh = vi.fn(async () => undefined)

    await expect(runMutationAndRefresh(mutation, refresh)).resolves.toMatchObject({ status: 'mutation-failed' })
    await expect(runMutationAndRefresh(mutation, refresh)).resolves.toEqual({ status: 'success', value: 'saved' })
    expect(mutation).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
