import type { ReactNode } from 'react'
import { Logo } from '@/components/layout/Logo'

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Logo className="mb-10" />
        <main>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </main>
        {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}
