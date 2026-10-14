import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ListOrdered, Plus, Search } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories } from '@/features/categories/api'
import { summarize, useMonthTransactions, type Transaction } from '@/features/transactions/api'
import { TransactionDialog } from '@/features/transactions/TransactionDialog'
import { TransactionList } from '@/features/transactions/TransactionList'
import { currentYearMonth, formatMonth, isYearMonth, shiftMonth, todayISO } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useUser } from '@/providers/AuthProvider'
import { useCurrentSpace } from '@/providers/SpaceProvider'

type KindFilter = 'all' | 'income' | 'expense'

function normalizeText(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function SummaryItem({ label, value, tone, hint }: { label: string; value: number; tone?: 'positive' | 'negative'; hint?: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p
        className={cn(
          'tabular mt-0.5 truncate font-display text-lg font-semibold sm:text-xl',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        {formatMoney(value)}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TransactionsPage() {
  const user = useUser()
  const { current } = useCurrentSpace()
  const spaceId = current?.id
  const [params, setParams] = useSearchParams()
  const monthParam = params.get('mes')
  const month = isYearMonth(monthParam) ? monthParam : currentYearMonth()
  const isCurrentMonth = month === currentYearMonth()

  const transactions = useMonthTransactions(spaceId, month)
  const categoriesQuery = useCategories(spaceId)
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])

  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; transaction: Transaction } | null>(null)

  const all = useMemo(() => transactions.data ?? [], [transactions.data])
  const totals = useMemo(() => summarize(all), [all])

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim())
    return all.filter((t) => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false
      if (categoryFilter === 'none' && t.category_id) return false
      if (categoryFilter && categoryFilter !== 'none' && t.category_id !== categoryFilter) return false
      if (q && !normalizeText(`${t.description} ${t.notes ?? ''}`).includes(q)) return false
      return true
    })
  }, [all, kindFilter, categoryFilter, search])

  const filtering = kindFilter !== 'all' || categoryFilter !== '' || search.trim() !== ''

  function goToMonth(next: string) {
    setParams(next === currentYearMonth() ? {} : { mes: next }, { replace: true })
  }

  function clearFilters() {
    setKindFilter('all')
    setCategoryFilter('')
    setSearch('')
  }

  // Nova movimentação no mês exibido: hoje se for o mês atual, senão o dia 1.
  const defaultDate = isCurrentMonth ? todayISO() : `${month}-01`
  const canDeleteAny = current?.role === 'owner' || current?.role === 'admin'

  const categoryOptions = categories.filter((c) => kindFilter === 'all' || c.kind === kindFilter)

  return (
    <>
      <PageHeader
        title="Movimentações"
        description={current ? `Receitas e despesas de ${current.name}.` : undefined}
        actions={
          <Button onClick={() => setDialog({ mode: 'create' })} disabled={!spaceId} className="hidden sm:inline-flex">
            <Plus aria-hidden="true" />
            Nova movimentação
          </Button>
        }
      />

      {/* Navegação por mês */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goToMonth(shiftMonth(month, -1))} aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 className="min-w-0 flex-1 text-center font-sans text-base font-semibold sm:flex-none sm:px-3 sm:text-left" aria-live="polite">
          {formatMonth(month)}
        </h2>
        <Button variant="outline" size="icon" onClick={() => goToMonth(shiftMonth(month, 1))} aria-label="Próximo mês">
          <ChevronRight aria-hidden="true" />
        </Button>
        {!isCurrentMonth && (
          <Button variant="ghost" size="sm" onClick={() => goToMonth(currentYearMonth())}>
            Mês atual
          </Button>
        )}
      </div>

      {/* Resumo */}
      <Card className="mb-6 grid grid-cols-3 gap-px overflow-hidden bg-border" aria-label={`Resumo de ${formatMonth(month)}`}>
        {transactions.isPending ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card px-5 py-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-2 h-6 w-24" />
              </div>
            ))}
          </>
        ) : (
          <>
            <SummaryItem
              label="Receitas"
              value={totals.income}
              tone="positive"
              hint={totals.pendingIncome > 0 ? `${formatMoney(totals.pendingIncome)} a receber` : undefined}
            />
            <SummaryItem
              label="Despesas"
              value={totals.expense}
              hint={totals.pendingExpense > 0 ? `${formatMoney(totals.pendingExpense)} a pagar` : undefined}
            />
            <SummaryItem label="Resultado" value={totals.balance} tone={totals.balance < 0 ? 'negative' : 'positive'} />
          </>
        )}
      </Card>

      {/* Filtros */}
      {all.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Segmented
            label="Tipo"
            size="sm"
            value={kindFilter}
            onChange={(v) => {
              setKindFilter(v)
              setCategoryFilter('')
            }}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'expense', label: 'Despesas' },
              { value: 'income', label: 'Receitas' },
            ]}
          />
          <div className="w-44">
            <label htmlFor="filter-category" className="sr-only">
              Filtrar por categoria
            </label>
            <NativeSelect
              id="filter-category"
              className="h-9"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              <option value="none">Sem categoria</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Buscar por descrição"
              placeholder="Buscar"
              className="h-9 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Lista */}
      {!spaceId || transactions.isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : transactions.error ? (
        <ErrorState error={transactions.error} onRetry={() => transactions.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title={`Nenhuma movimentação em ${formatMonth(month).toLowerCase()}`}
          action={
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <Plus aria-hidden="true" />
              Lançar movimentação
            </Button>
          }
        >
          Registre receitas e despesas para acompanhar o mês. Use “A pagar” para contas que ainda vão vencer.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nada encontrado com esses filtros"
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          {filtering && (
            <p className="mb-3 text-xs text-muted-foreground">
              {filtered.length} de {all.length} movimentações
            </p>
          )}
          <TransactionList
            items={filtered}
            categories={categories}
            onSelect={(t) => setDialog({ mode: 'edit', transaction: t })}
          />
        </>
      )}

      {/* Atalho no celular */}
      {spaceId && (
        <Button
          size="icon"
          onClick={() => setDialog({ mode: 'create' })}
          aria-label="Nova movimentação"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 size-14 rounded-full shadow-lg sm:hidden [&_svg]:size-6"
        >
          <Plus aria-hidden="true" />
        </Button>
      )}

      {dialog && spaceId && (
        <TransactionDialog
          key={dialog.mode === 'edit' ? dialog.transaction.id : 'new'}
          spaceId={spaceId}
          categories={categories}
          transaction={dialog.mode === 'edit' ? dialog.transaction : undefined}
          defaultDate={defaultDate}
          canDelete={
            dialog.mode === 'edit' && (canDeleteAny || dialog.transaction.created_by === user.id)
          }
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
