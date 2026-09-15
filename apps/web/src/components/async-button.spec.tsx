import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AsyncButton } from './async-button'

describe('AsyncButton', () => {
  it('renders an accessible disabled loading state with progressive copy', () => {
    const html = renderToStaticMarkup(
      <AsyncButton className="primary-button" loading loadingText="Saving…">Save</AsyncButton>,
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('button-spinner')
    expect(html).toContain('Saving…')
    expect(html).not.toContain('>Save<')
  })

  it('keeps the idle label and does not force disabled state', () => {
    const html = renderToStaticMarkup(
      <AsyncButton className="secondary-button" loadingText="Submitting…">Submit</AsyncButton>,
    )

    expect(html).toContain('>Submit<')
    expect(html).not.toContain('aria-busy')
    expect(html).not.toContain('disabled')
  })
})
