import { useState } from 'react'
import { formatMonth, formatMonthShort } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { MonthTotals } from './api'

/** Escala "redonda" para o eixo: 1, 2, 2,5 ou 5 × 10^n acima do maior valor. */
export function niceMax(value: number): number {
  if (value <= 0) return 0
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * exp) return step * exp
  }
  return 10 * exp
}

function compact(value: number) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

const SERIES = [
  { key: 'income', label: 'Receitas', className: 'bg-chart-income' },
  { key: 'expense', label: 'Despesas', className: 'bg-chart-expense' },
] as const

/** Barras agrupadas de receitas e despesas por mês. Uma escala, legenda, dica ao passar o mouse e tabela para leitores de tela. */
export function MonthlyChart({ data }: { data: MonthTotals[] }) {
  const [active, setActive] = useState<string | null>(null)
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.income, d.expense])))
  const ticks = max > 0 ? [max, max / 2, 0] : [0]
  const activeMonth = data.find((d) => d.month === active)

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', s.className)} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative" aria-hidden="true">
        {/* Grade e eixo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 flex items-center gap-2"
              style={{ top: `${max > 0 ? (1 - t / max) * 100 : 100}%` }}
            >
              <span className="tabular w-10 -translate-y-1/2 text-right text-[10px] text-muted-foreground">
                {compact(t)}
              </span>
              <span className={cn('h-px flex-1 -translate-y-1/2', t === 0 ? 'bg-border' : 'bg-border/50')} />
            </div>
          ))}
        </div>

        <div className="ml-12 grid h-40 items-end gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d) => (
            <div
              key={d.month}
              className={cn(
                'flex h-full items-end justify-center gap-0.5 rounded-sm transition-colors',
                active === d.month && 'bg-secondary/70',
              )}
              onMouseEnter={() => setActive(d.month)}
              onMouseLeave={() => setActive(null)}
            >
              {SERIES.map((s) => {
                const value = d[s.key]
                const pct = max > 0 ? (value / max) * 100 : 0
                return (
                  <div
                    key={s.key}
                    className={cn('w-full max-w-4 rounded-t-[4px]', s.className, value === 0 && 'opacity-0')}
                    style={{ height: `${Math.max(pct, value > 0 ? 1.5 : 0)}%` }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="ml-12 mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d) => (
            <span key={d.month} className="text-center text-[11px] capitalize text-muted-foreground">
              {formatMonthShort(d.month)}
            </span>
          ))}
        </div>
      </div>

      {/* Dica do mês em foco */}
      <p className="mt-3 min-h-5 text-xs text-muted-foreground" aria-hidden="true">
        {activeMonth ? (
          <>
            <span className="font-medium text-foreground">{formatMonth(activeMonth.month)}</span>
            {' · '}Receitas <span className="tabular text-foreground">{formatMoney(activeMonth.income)}</span>
            {' · '}Despesas <span className="tabular text-foreground">{formatMoney(activeMonth.expense)}</span>
          </>
        ) : (
          'Passe o mouse sobre um mês para ver os valores.'
        )}
      </p>

      <table className="sr-only">
        <caption>Receitas e despesas por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Receitas</th>
            <th scope="col">Despesas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{formatMonth(d.month)}</th>
              <td>{formatMoney(d.income)}</td>
              <td>{formatMoney(d.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
