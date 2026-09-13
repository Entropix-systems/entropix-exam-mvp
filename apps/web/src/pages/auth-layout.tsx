import type { PropsWithChildren, ReactNode } from 'react'

export function AuthLayout({
  title,
  intro,
  children,
  footer,
}: PropsWithChildren<{ title: string; intro: string; footer?: ReactNode }>) {
  return (
    <main className="auth-layout">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">E</div>
        <p className="eyebrow">Examination ERP</p>
        <h1 id="auth-title">{title}</h1>
        <p className="intro">{intro}</p>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
      <aside className="auth-aside" aria-label="Product information">
        <div>
          <p className="eyebrow">Secure examination operations</p>
          <h2>One identity. The right institution. Clear access boundaries.</h2>
          <p>Tenant membership and current assignments are checked by the server on every protected request.</p>
        </div>
      </aside>
    </main>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p className="form-message error" role="alert">{message}</p> : null
}

