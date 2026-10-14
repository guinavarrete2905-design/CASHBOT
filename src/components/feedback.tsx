import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

export function FullScreenLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-6', className)}>
      <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="max-w-prose text-sm text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4">
      <div className="flex items-start gap-2 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <p>{toUserMessage(error, 'Não foi possível carregar estas informações.')}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

/** Mensagem de erro de formulário, anunciada para leitores de tela. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
