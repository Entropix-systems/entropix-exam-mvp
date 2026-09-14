/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('operational status badge layout', () => {
  it('keeps badges intrinsically sized across flex and grid card headers', () => {
    const badgeRule = css.match(/\.status-badge\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(badgeRule).toMatch(/align-self:\s*flex-start/)
    expect(badgeRule).toMatch(/width:\s*fit-content/)
    expect(badgeRule).toMatch(/max-width:\s*100%/)
  })

  it.each(['conduct', 'evaluation'])('top-aligns %s card header children', (card) => {
    const headerRule = css.match(new RegExp(`\\.${card}-card > header\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    expect(headerRule).toMatch(/align-items:\s*flex-start/)
  })
})
