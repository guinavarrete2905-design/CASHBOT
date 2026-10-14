import type { ReactNode } from 'react'

export function SettingsBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b pb-8 pt-8 first:pt-0 last:border-b-0">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}
