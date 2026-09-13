import { useEffect, useState } from 'react'

/** Capture once, then remove the credential from browser history/address bar. */
export function useOneTimeToken(): string | null {
  const [token] = useState(() =>
    new URL(window.location.href).searchParams.get('token'),
  )
  useEffect(() => {
    if (token) {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [token])
  return token
}
