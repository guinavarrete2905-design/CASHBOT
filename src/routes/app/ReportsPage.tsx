import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChartPie, Download, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/features/accounts/api'
import { useCategories } from '@/features/categories/api'
import { compareMonths, expensesByCategory, periodRange, toCsv, totals, type PeriodKey } from '@/features/reports/calc'
import { statusLabel, useRangeTransactions, type MonthTotals } from '@/features/transactions/api'
import { MonthlyChart } from '@/features/transactions/MonthlyChart'
import { buildLookup } from '@/features/transactions/TransactionList'
import { currentYearMonth, formatMonth, parseISODate, shiftMonth } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCurrentSpace } from '@/providers/SpaceProvider'

const PERIODS: Array<{ value: PeriodKey; label: string }> = [
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
  { value: 'year', label: 'Este ano' },
]

const KIND_LABEL = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' } as const

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'positive' | 'negative'; hint?: string }) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tabular mt-1 truncate font-display text-xl font-semibold sm:text-2xl',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ReportsPage() {
  const { current } = useCurrentSpace()
  const spaceId = current?.id
  const [period, setPeriod] = useState<PeriodKey>('6m')
  const [onlyPaid, setOnlyPaid] = useState<'all' | 'paid'>('all')

  const thisMonth = currentYearMonth()
  const range = periodRange(period, thisMonth)
  // Busca também o mês anterior ao período para o comparativo funcionar no período de 1 mês do ano.
  const fetchFrom = shiftMonth(range.from, range.from === range.to ? -1 : 0)
  const query = useRangeTransactions(spaceId, fetchFrom, range.to)
  const categoriesQuery = useCategories(spaceId)
  const accountsQuery = useAccounts(spaceId)
  const names = useMemo(
    () => buildLookup(categoriesQuery.data ?? [], accountsQuery.data ?? []),
    [categoriesQuery.data, accountsQuery.data],
  )

  const all = useMemo(
    () => (query.data ?? []).filter((t) => onlyPaid === 'all' || t.status === 'paid'),
    [query.data, onlyPaid],
  )
  const inPeriod = useMemo(() => all.filter((t) => t.occurred_on.slice(0, 7) >= range.from), [all, range.from])

  const sums = totals(inPeriod)
  const byCategory = expensesByCategory(inPeriod)
  const comparison = compareMonths(all, thisMonth)
  const monthly: MonthTotals[] = useMemo(() => {
    const buckets = new Map<string, MonthTotals>()
    for (let i = 0; i < range.months; i++) {
      const m = shiftMonth(range.from, i)
      buckets.set(m, { month: m, income: 0, expense: 0 })
    }
    for (const t of inPeriod) {
      const b = buckets.get(t.occurred_on.slice(0, 7))
      if (!b) continue
      if (t.kind === 'income') b.income = Math.round((b.income + t.amount) * 100) / 100
      else if (t.kind === 'expense') b.expense = Math.round((b.expense + t.amount) * 100) / 100
    }
    return [...buckets.values()]
  }, [inPeriod, range.from, range.months])

  const categoryName = (id: string | null) => (id ? (names.categories.get(id) ?? 'Categoria') : 'Sem categoria')
  const accountName = (id: string | null) => (id ? (names.accounts.get(id) ?? '') : '')
  const maxCategory = byCategory[0]?.amount ?? 0
  const monthsLabel = `${formatMonth(range.from).toLowerCase()} a ${formatMonth(range.to).toLowerCase()}`

  function exportCsv() {
    const rows = inPeriod.map((t) => [
      parseISODate(t.occurred_on).toLocaleDateString('pt-BR'),
      KIND_LABEL[t.kind],
      t.description,
      t.kind === 'transfer' ? '' : categoryName(t.category_id),
      accountName(t.account_id),
      t.kind === 'transfer' ? accountName(t.transfer_account_id) : '',
      statusLabel(t.kind, t.status),
      t.kind === 'expense' ? -t.amount : t.amount,
      t.notes ?? '',
    ])
    const csv = toCsv(
      ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Conta de destino', 'Situação', 'Valor', 'Observações'],
      rows,
    )
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `cashbot-${range.from}-a-${range.to}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`${rows.length} movimentações exportadas.`)
  }

  const loading = !spaceId || query.isPending

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={current ? `Para onde foi o dinheiro de ${current.name}.` : undefined}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={loading || inPeriod.length === 0}>
            <Download aria-hidden="true" />
            Exportar CSV
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented label="Período" value={period} onChange={setPeriod} options={PERIODS} className="max-w-full overflow-x-auto" />
        <Segmented
          label="Considerar"
          size="sm"
          value={onlyPaid}
          onChange={setOnlyPaid}
          options={[
            { value: 'all', label: 'Tudo' },
            { value: 'paid', label: 'Só pagos e recebidos' },
          ]}
        />
        <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">{monthsLabel}</p>
      </div>

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : inPeriod.length === 0 ? (
        <EmptyState icon={ChartPie} title="Sem movimentações neste período">
          Os relatórios aparecem a partir das receitas e despesas lançadas em Movimentações.
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border lg:grid-cols-4">
            <Stat label="Receitas" value={formatMoney(sums.income)} tone="positive" />
            <Stat label="Despesas" value={formatMoney(sums.expense)} />
            <Stat label="Resultado" value={formatMoney(sums.balance)} tone={sums.balance < 0 ? 'negative' : 'positive'} />
            <Stat
              label="Sobrou da renda"
              value={sums.savingsRate === null ? '—' : `${Math.round(sums.savingsRate)}%`}
              tone={sums.savingsRate !== null && sums.savingsRate < 0 ? 'negative' : undefined}
              hint={sums.savingsRate === null ? 'Sem receitas no período' : 'Resultado ÷ receitas'}
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Gastos por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
                ) : (
                  <ul className="grid gap-3">
                    {byCategory.map((c) => (
                      <li key={c.categoryId ?? 'none'}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">{categoryName(c.categoryId)}</span>
                          <span className="tabular whitespace-nowrap">
                            {formatMoney(c.amount)}{' '}
                            <span className="text-xs text-muted-foreground">{c.share.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-chart-expense"
                            style={{ width: `${maxCategory > 0 ? (c.amount / maxCategory) * 100 : 0}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Receitas x despesas por mês</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyChart data={monthly} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Despesas de {formatMonth(thisMonth).toLowerCase()} comparadas a {formatMonth(shiftMonth(thisMonth, -1)).toLowerCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comparison.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem despesas nesses dois meses.</p>
              ) : (
                <div className="-mx-5 overflow-x-auto px-5">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">Categoria</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Mês anterior</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Este mês</th>
                        <th scope="col" className="py-2 text-right font-medium">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {comparison.map((c) => {
                        const up = c.diff > 0
                        const same = c.diff === 0
                        const Icon = same ? Minus : up ? ArrowUpRight : ArrowDownRight
                        return (
                          <tr key={c.categoryId ?? 'none'}>
                            <th scope="row" className="max-w-[12rem] truncate py-2 pr-3 text-left font-normal">
                              {categoryName(c.categoryId)}
                            </th>
                            <td className="tabular py-2 pr-3 text-right text-muted-foreground">{formatMoney(c.previous)}</td>
                            <td className="tabular py-2 pr-3 text-right">{formatMoney(c.current)}</td>
                            <td
                              className={cn(
                                'tabular whitespace-nowrap py-2 text-right',
                                same ? 'text-muted-foreground' : up ? 'text-negative' : 'text-positive',
                              )}
                            >
                              <span className="inline-flex items-center gap-1">
                                <Icon className="size-3.5" aria-hidden="true" />
                                {same ? 'igual' : `${up ? '+' : '−'}${formatMoney(Math.abs(c.diff))}`}
                                {c.change !== null && !same && (
                                  <span className="text-xs">({Math.abs(Math.round(c.change))}%)</span>
                                )}
                                {c.change === null && !same && <span className="text-xs">(novo)</span>}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
