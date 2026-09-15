import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type AsyncButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  loadingText: ReactNode
}

export function AsyncButton({
  children,
  disabled,
  loading = false,
  loadingText,
  className = '',
  ...props
}: AsyncButtonProps) {
  return (
    <button
      {...props}
      className={`async-button ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span>{loading ? loadingText : children}</span>
    </button>
  )
}
