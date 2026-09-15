import { Alert, Snackbar } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { NotificationContext } from './notification-context'
import type { NotificationSeverity } from './notification-context'

type Notification = {
  id: number
  message: string
  severity: NotificationSeverity
}

const duration = (severity: NotificationSeverity) => {
  if (severity === 'error') return 7000
  if (severity === 'warning') return 5000
  if (severity === 'info') return 4000
  return 3500
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const [queue, setQueue] = useState<Notification[]>([])
  const notify = useCallback((message: string, severity: NotificationSeverity = 'info') => {
    setQueue((current) => {
      const duplicate = current.some((notification) => notification.message === message && notification.severity === severity)
      return duplicate ? current : [...current, { id: Date.now() + current.length, message, severity }]
    })
  }, [])
  const current = queue[0]
  const close = useCallback(() => setQueue((items) => items.slice(1)), [])
  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.id}
        open={Boolean(current)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={current ? duration(current.severity) : undefined}
        onClose={close}
      >
        {current ? (
          <Alert severity={current.severity} variant="filled" onClose={close} role="alert" sx={{ width: '100%' }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  )
}
