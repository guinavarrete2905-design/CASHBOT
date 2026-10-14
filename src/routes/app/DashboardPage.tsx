import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ChartColumn, Check, ListOrdered, Plus, type LucideIcon } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategories } from '@/features/categories/api'
import { useProfile } from '@/features/profile/api'
import {
  summarize,
  useMonthlyTotals,
  useMonthTransactions,
  usePendingTransactions,
  useRecentTransactions,
  type Transaction,
} from '@/features/transactions/api'
import { MonthlyChart } from '@/features/transactions/MonthlyChart'
import { TransactionDialog } from '@/features/transactions/TransactionDialog'
import { TransactionRow } from '@/features/transactions/TransactionList'
import { currentYearMonth, formatMonth, todayISO } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useUser } from '@/providers/AuthProvider'
import { useCurrentSpace } from '@/providers/SpaceProvider'

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function Indicator({ label, value, hint, tone, loading }: {
  label: string
  value: number | null
  hint?: string
  tone?: 'positive' | 'negative'
  loading?: boolean
}) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : value === null ? (
        <p className="mt-1 font-display text-2xl font-semibold text-muted-foreground/60" aria-label="Sem dados">
          —
        </p>
      ) : (
        <p
          className={cn(
            'tabular mt-1 truncate font-display text-2xl font-semibold',
            tone === 'positive' && 'text-positive',
            tone === 'negative' && 'text-negative',
          )}
        >
          {formatMoney(value)}
        </p>
      )}
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Panel({ title, action, children, className }: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function PanelEmpty({ icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <EmptyState icon={icon} title={title} className="border-0 px-0 py-2">
      {children}
    </EmptyState>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  )
}

function Step({ done, title, children }: { done?: boolean; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-positive bg-positive text-white' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="size-3" /> : null}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {title}
          {done && <span className="sr-only"> (concluído)</span>}
        </p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}

const linkClass = 'inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'

export function DashboardPage() {
  const user = useUser()
  const { data: profile, isPending: profileLoading } = useProfile()
  const { current, spaces } = useCurrentSpace()
  const spaceId = current?.id
  const month = currentYearMonth()
  const today = todayISO()

  const monthTx = useMonthTransactions(spaceId, month)
  const recent = useRecentTransactions(spaceId)
  const pending = usePendingTransactions(spaceId)
  const totals = useMonthlyTotals(spaceId, 6, month)
  const categoriesQuery = useCategories(spaceId)
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const [dialog, setDialog] = useState<{ transaction?: Transaction } | null>(null)

  const recentItems = recent.data ?? []
  const pendingItems = pending.data ?? []
  const monthlyTotals = totals.data ?? []

  const firstName = profile?.full_name?.trim().split(/\s+/)[0]
  const hasSharedSpace = spaces.some((s) => s.type !== 'personal')
  const monthSummary = summarize(monthTx.data ?? [])
  const monthLoading = !spaceId || monthTx.isPending
  const hasAnyTransaction = recentItems.length > 0 || pendingItems.length > 0 || (monthTx.data?.length ?? 0) > 0
  const hasHistory = monthlyTotals.some((m) => m.income > 0 || m.expense > 0)
  const overdue = pendingItems.filter((t) => t.occurred_on < today).length
  const canDeleteAny = current?.role === 'owner' || current?.role === 'admin'

  return (
    <>
      {profileLoading ? (
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <PageHeader
          title={firstName ? `${greeting()}, ${firstName}` : greeting()}
          description={
            <>
              {formatMonth(month)}
              {current && (
                <>
                  {' · '}
                  <span className="text-foreground">{current.name}</span>
                </>
              )}
            </>
          }
          actions={
            <Button onClick={() => setDialog({})} disabled={!spaceId}>
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">Nova movimentação</span>
              <span className="sm:hidden">Lançar</span>
            </Button>
          }
        />
      )}

      <section aria-labelledby="resumo-titulo" className="mb-6">
        <h2 id="resumo-titulo" className="sr-only">
          Resumo do mês
        </h2>
        {monthTx.error ? (
          <ErrorState error={monthTx.error} onRetry={() => monthTx.refetch()} />
        ) : (
          <Card className="grid grid-cols-1 gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Indicator
              label="Receitas do mês"
              value={monthSummary.income}
              tone="positive"
              loading={monthLoading}
              hint={
                monthSummary.pendingIncome > 0
                  ? `${formatMoney(monthSummary.pendingIncome)} ainda a receber`
                  : 'Nada a receber'
              }
            />
            <Indicator
              label="Despesas do mês"
              value={monthSummary.expense}
              loading={monthLoading}
              hint={
                monthSummary.pendingExpense > 0
                  ? `${formatMoney(monthSummary.pendingExpense)} ainda a pagar`
                  : 'Nada a pagar'
              }
            />
            <Indicator
              label="Resultado do mês"
              value={monthSummary.balance}
              tone={monthSummary.balance < 0 ? 'negative' : 'positive'}
              loading={monthLoading}
              hint="Receitas menos despesas, com pendentes"
            />
            <Indicator label="Saldo em contas" value={null} hint="Aparece quando as contas forem cadastradas" />
          </Card>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-3">
          <Panel
            title="Movimentações recentes"
            action={
              hasAnyTransaction ? (
                <Link to="/movimentacoes" className={cn(linkClass, 'text-sm')}>
                  Ver todas <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : undefined
            }
          >
            {!spaceId || recent.isPending ? (
              <ListSkeleton />
            ) : recent.error ? (
              <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
            ) : recentItems.length === 0 ? (
              <PanelEmpty icon={ListOrdered} title="Nenhuma movimentação ainda">
                Lance sua primeira receita ou despesa pelo botão “Nova movimentação”.
              </PanelEmpty>
            ) : (
              <ul className="divide-y">
                {recentItems.map((t) => (
                  <li key={t.id}>
                    <TransactionRow
                      t={t}
                      showDate
                      categoryName={t.category_id ? names.get(t.category_id) : undefined}
                      onSelect={(tx) => setDialog({ transaction: tx })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Evolução dos últimos 6 meses">
            {!spaceId || totals.isPending ? (
              <Skeleton className="h-48" />
            ) : totals.error ? (
              <ErrorState error={totals.error} onRetry={() => totals.refetch()} />
            ) : !hasHistory ? (
              <PanelEmpty icon={ChartColumn} title="Sem histórico para mostrar">
                O gráfico aparece a partir da primeira movimentação lançada.
              </PanelEmpty>
            ) : (
              <MonthlyChart data={monthlyTotals} />
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-6 lg:col-span-2">
          <Panel title="A pagar e a receber">
            {!spaceId || pending.isPending ? (
              <ListSkeleton />
            ) : pending.error ? (
              <ErrorState error={pending.error} onRetry={() => pending.refetch()} />
            ) : pendingItems.length === 0 ? (
              <PanelEmpty icon={CalendarClock} title="Nada pendente">
                Ao lançar algo como “A pagar” ou “A receber”, ele aparece aqui em ordem de data.
              </PanelEmpty>
            ) : (
              <>
                {overdue > 0 && (
                  <p className="mb-2 rounded-md bg-negative/10 px-3 py-2 text-xs font-medium text-negative" role="status">
                    {overdue === 1 ? '1 pendência com data passada' : `${overdue} pendências com data passada`}
                  </p>
                )}
                <ul className="divide-y">
                  {pendingItems.map((t) => (
                    <li key={t.id}>
                      <TransactionRow
                        t={t}
                        showDate
                        categoryName={t.category_id ? names.get(t.category_id) : undefined}
                        onSelect={(tx) => setDialog({ transaction: tx })}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="Primeiros passos">
            <ol className="grid gap-4">
              <Step done title="Criar sua conta">
                Seu espaço pessoal já está pronto.
              </Step>
              <Step done={hasAnyTransaction} title="Lançar a primeira movimentação">
                {hasAnyTransaction ? (
                  'Pronto. Continue lançando para acompanhar o mês.'
                ) : (
                  <button type="button" className={linkClass} onClick={() => setDialog({})} disabled={!spaceId}>
                    Lançar agora <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </Step>
              <Step title="Revisar as categorias">
                <Link to="/configuracoes/categorias" className={linkClass}>
                  Ajustar categorias <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Step>
              <Step done={hasSharedSpace} title="Dividir com o casal ou a família (opcional)">
                <Link to="/configuracoes/espacos" className={linkClass}>
                  {hasSharedSpace ? 'Gerenciar espaços' : 'Criar um espaço compartilhado'}{' '}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Step>
            </ol>
          </Panel>
        </div>
      </div>

      {dialog && spaceId && (
        <TransactionDialog
          key={dialog.transaction?.id ?? 'new'}
          spaceId={spaceId}
          categories={categories}
          transaction={dialog.transaction}
          canDelete={Boolean(dialog.transaction) && (canDeleteAny || dialog.transaction?.created_by === user.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
