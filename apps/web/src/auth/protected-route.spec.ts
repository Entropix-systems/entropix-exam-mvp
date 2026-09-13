import { describe, expect, it } from 'vitest'
import { protectedDestination } from './route-policy'

describe('protected route policy', () => {
  it('redirects unauthenticated and denied contexts and admits restored sessions', () => {
    expect(protectedDestination('UNAUTHENTICATED')).toBe('/login')
    expect(protectedDestination('ACCESS_DENIED')).toBe('/access-denied')
    expect(protectedDestination('AUTHENTICATED')).toBeNull()
    expect(protectedDestination('RESTORING')).toBeNull()
  })
})
