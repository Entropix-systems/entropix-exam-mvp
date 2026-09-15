import { createContext, useContext } from 'react'

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info'

export type NotificationContextValue = {
  notify(message: string, severity?: NotificationSeverity): void
}

export const NotificationContext = createContext<NotificationContextValue>({ notify: () => undefined })

export function useNotification() {
  return useContext(NotificationContext)
}
