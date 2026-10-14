import { useState } from 'react'
import { formatMonth, formatMonthShort } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Snapshot } from './api'

function compact(value: number) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Barras do patrimônio líquido por mês (uma série). Valores negativos ficam abaixo da linha do zero. */
export function NetWorthChart({ data }: { data: Snapshot[] }) {
  const [active, setActive] = useState<string | null>(null)
  const values = data.map((d) => d.netWorth)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const zeroPct = (max / span) * 100
  const activeItem = data.find((d) => d.month === active) ?? data[data.length - 1]

  return (
    <div>
      <div className="relative h-40" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-border" style={{ top: `${zeroPct}%` }} />
        <span className="tabular absolute left-0 -translate-y-full text-[10px] text-muted-foreground" style={{ top: 0 }}>
          {compact(max)}
        </span>
        <div className="absolute inset-0 ml-10 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d) => {
            const h = (Math.abs(d.netWorth) / span) * 100
            const negative = d.netWorth < 0
            return (
              <div
                key={d.month}
                className={cn('relative h-full rounded-sm', active === d.month && 'bg-secondary/70')}
                onMouseEnter={() => setActive(d.month)}
                onMouseLeave={() => setActive(null)}
              >
                <div
                  className={cn('absolute inset-x-1/4 bg-chart-expense', negative ? 'rounded-b-[4px] bg-negative' : 'rounded-t-[4px]')}
                  style={negative ? { top: `${zeroPct}%`, height: `${h}%` } : { bottom: `${100 - zeroPct}%`, height: `${h}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="ml-10 mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {data.map((d) => (
          <span key={d.month} className="text-center text-[11px] capitalize text-muted-foreground">
            {formatMonthShort(d.month)}
          </span>
        ))}
      </div>
      {activeItem && (
        <p className="mt-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="font-medium text-foreground">{formatMonth(activeItem.month)}</span>
          {' · '}
          Patrimônio líquido <span className="tabular text-foreground">{formatMoney(activeItem.netWorth)}</span>
        </p>
      )}
      <table className="sr-only">
        <caption>Patrimônio líquido por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Patrimônio líquido</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{formatMonth(d.month)}</th>
              <td>{formatMoney(d.netWorth)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
