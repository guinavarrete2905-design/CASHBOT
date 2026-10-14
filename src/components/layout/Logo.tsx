import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M21.5 11.2A7 7 0 1 0 21.5 20.8"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22" cy="16" r="1.8" fill="#e3b75a" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight">CashBot</span>
    </span>
  )
}
