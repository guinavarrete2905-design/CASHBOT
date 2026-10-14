import type { Category } from '@/features/categories/api'
import { formatDayHeading } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Transaction } from './api'
import { groupByDay, statusLabel, summarize } from './summary'

export function SignedAmount({ kind, amount, className }: { kind: Transaction['kind']; amount: number; className?: string }) {
  return (
    <span className={cn('tabular whitespace-nowrap font-medium', kind === 'income' ? 'text-positive' : 'text-foreground', className)}>
      <span aria-hidden="true">{kind === 'income' ? '+' : '−'}</span>
      <span className="sr-only">{kind === 'income' ? 'receita de ' : 'despesa de '}</span>
      {formatMoney(amount)}
    </span>
  )
}

export function TransactionRow({ t, categoryName, onSelect, showDate = false }: {
  t: Transaction
  categoryName?: string
  onSelect?: (t: Transaction) => void
  showDate?: boolean
}) {
  const pending = t.status === 'pending'
  const meta = [categoryName ?? 'Sem categoria', showDate ? t.occurred_on.split('-').reverse().slice(0, 2).join('/') : null]
    .filter(Boolean)
    .join(' · ')

  const content = (
    <>
      <span
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', t.kind === 'income' ? 'bg-positive' : 'bg-negative/70')}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{t.description}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="truncate">{meta}</span>
          {pending && (
            <span className="rounded-sm bg-warning/15 px-1.5 py-px font-medium text-warning">
              {statusLabel(t.kind, t.status)}
            </span>
          )}
        </span>
      </span>
      <SignedAmount kind={t.kind} amount={t.amount} className={cn('text-sm', pending && 'opacity-70')} />
    </>
  )

  if (!onSelect) return <div className="flex items-start gap-3 py-3">{content}</div>

  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Editar ${t.description}`}
    >
      {content}
    </button>
  )
}

export function TransactionList({ items, categories, onSelect }: {
  items: Transaction[]
  categories: Category[]
  onSelect: (t: Transaction) => void
}) {
  const names = new Map(categories.map((c) => [c.id, c.name]))

  return (
    <div className="grid gap-6">
      {groupByDay(items).map(({ day, items: dayItems }) => {
        const { balance } = summarize(dayItems)
        return (
          <section key={day} aria-label={formatDayHeading(day)}>
            <header className="mb-1 flex items-baseline justify-between gap-3 border-b pb-2">
              <h3 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {formatDayHeading(day)}
              </h3>
              <span className="tabular text-xs text-muted-foreground">
                {balance >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(balance))}
              </span>
            </header>
            <ul>
              {dayItems.map((t) => (
                <li key={t.id}>
                  <TransactionRow t={t} categoryName={t.category_id ? names.get(t.category_id) : undefined} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
