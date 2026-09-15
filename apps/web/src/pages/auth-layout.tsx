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
        <p className="auth-product-lockup">ExamOS <span>by Entropix Systems</span></p>
        <h1 id="auth-title">{title}</h1>
        <p className="intro">{intro}</p>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
      <aside className="auth-aside" aria-label="Product information">
        <div>
          <p className="auth-product-lockup">ExamOS <span>by Entropix Systems</span></p>
          <h2>The Examination Operating System for Modern Institutions</h2>
          <p>Run every exam. From registration to results.</p>
        </div>
      </aside>
    </main>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p className="form-message error" role="alert">{message}</p> : null
}
