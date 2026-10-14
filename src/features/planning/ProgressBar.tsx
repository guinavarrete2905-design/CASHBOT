import { cn } from '@/lib/utils'

const TONE = {
  ok: 'bg-primary',
  good: 'bg-positive',
  warning: 'bg-warning',
  over: 'bg-negative',
} as const

/** Barra de progresso acessível. O valor também deve aparecer em texto ao lado. */
export function ProgressBar({ value, tone = 'ok', label, className }: {
  value: number
  tone?: keyof typeof TONE
  label: string
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-secondary', className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={cn('h-full rounded-full transition-[width]', TONE[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}
