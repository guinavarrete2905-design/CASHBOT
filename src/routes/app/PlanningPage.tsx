import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, CircleAlert, Flag, PiggyBank, Plus, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/features/accounts/api'
import { useCategories } from '@/features/categories/api'
import { budgetStatus, goalPlan, spentByCategory } from '@/features/planning/calc'
import { useBudgets, useDeleteGoal, useGoals, type Goal } from '@/features/planning/api'
import { BudgetDialog, GoalDialog, GoalSavedDialog } from '@/features/planning/dialogs'
import { ProgressBar } from '@/features/planning/ProgressBar'
import { useMonthTransactions, useUpcomingTransactions, type Transaction } from '@/features/transactions/api'
import { TransactionDialog } from '@/features/transactions/TransactionDialog'
import { buildLookup, TransactionRow } from '@/features/transactions/TransactionList'
import { currentYearMonth, formatDayHeading, formatMonth, isYearMonth, parseISODate, shiftMonth, todayISO } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useUser } from '@/providers/AuthProvider'
import { useCurrentSpace } from '@/providers/SpaceProvider'

function sumCents(values: number[]) {
  return values.reduce((s, v) => s + Math.round(v * 100), 0) / 100
}

function SectionTitle({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="font-sans text-base font-semibold">
        {title}
      </h2>
      {action}
    </div>
  )
}

function GoalCard({ goal, onSave, onEdit, onDelete }: {
  goal: Goal
  onSave: () => void
  onEdit: () => void
  onDelete?: () => void
}) {
  const plan = goalPlan({ target: goal.target, saved: goal.saved, targetDate: goal.targetDate }, todayISO())
  const deadline = goal.targetDate ? parseISODate(goal.targetDate).toLocaleDateString('pt-BR') : null

  return (
    <li className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{goal.name}</p>
          <p className="text-xs text-muted-foreground">{deadline ? `Prazo: ${deadline}` : 'Sem prazo'}</p>
        </div>
        <p className="tabular whitespace-nowrap text-sm font-medium">{Math.round(plan.pct)}%</p>
      </div>
      <ProgressBar className="mt-3" value={plan.pct} tone={plan.done ? 'good' : 'ok'} label={`Progresso da meta ${goal.name}`} />
      <p className="tabular mt-2 text-sm">
        {formatMoney(goal.saved)} <span className="text-muted-foreground">de {formatMoney(goal.target)}</span>
      </p>
      <p className={cn('mt-1 text-xs', plan.late ? 'text-negative' : 'text-muted-foreground')}>
        {plan.done
          ? 'Meta alcançada.'
          : plan.late
            ? `O prazo passou. Faltam ${formatMoney(plan.remaining)}.`
            : plan.perMonth !== null
              ? `Faltam ${formatMoney(plan.remaining)}: guarde ${formatMoney(plan.perMonth)} por mês${plan.months && plan.months > 1 ? ` por ${plan.months} meses` : ' este mês'}.`
              : `Faltam ${formatMoney(plan.remaining)}.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={onSave}>
          <PiggyBank aria-hidden="true" />
          Atualizar valor
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Editar
        </Button>
        {onDelete && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
            Excluir
          </Button>
        )}
      </div>
    </li>
  )
}

export function PlanningPage() {
  const user = useUser()
  const { current } = useCurrentSpace()
  const spaceId = current?.id
  const [params, setParams] = useSearchParams()
  const monthParam = params.get('mes')
  const month = isYearMonth(monthParam) ? monthParam : currentYearMonth()
  const isCurrentMonth = month === currentYearMonth()

  const budgetsQuery = useBudgets(spaceId)
  const goalsQuery = useGoals(spaceId)
  const monthTx = useMonthTransactions(spaceId, month)
  const upcoming = useUpcomingTransactions(spaceId, 60)
  const categoriesQuery = useCategories(spaceId)
  const accountsQuery = useAccounts(spaceId)
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const names = useMemo(() => buildLookup(categories, accountsQuery.data ?? []), [categories, accountsQuery.data])
  const deleteGoal = useDeleteGoal(spaceId ?? '')

  const [budgetDialog, setBudgetDialog] = useState<{ categoryId?: string } | null>(null)
  const [goalDialog, setGoalDialog] = useState<{ goal?: Goal } | null>(null)
  const [savingGoal, setSavingGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const budgets = budgetsQuery.data ?? []
  const spent = useMemo(() => spentByCategory(monthTx.data ?? []), [monthTx.data])
  const categoryName = (id: string) => names.categories.get(id) ?? 'Categoria'

  const budgetRows = budgets
    .map((b) => ({ ...b, spent: spent.get(b.categoryId) ?? 0, ...budgetStatus(spent.get(b.categoryId) ?? 0, b.amount) }))
    .sort((a, b) => b.pct - a.pct)
  const unbudgeted = [...spent.entries()]
    .filter(([id, value]) => id !== '' && value > 0 && !budgets.some((b) => b.categoryId === id))
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
  const totalBudget = sumCents(budgets.map((b) => b.amount))
  const totalSpentBudgeted = sumCents(budgetRows.map((r) => r.spent))
  const totalStatus = budgetStatus(totalSpentBudgeted, totalBudget)

  const goals = (goalsQuery.data ?? []).filter((g) => !g.archived)
  const canDeleteAny = current?.role === 'owner' || current?.role === 'admin'
  const today = todayISO()

  function goToMonth(next: string) {
    setParams(next === currentYearMonth() ? {} : { mes: next }, { replace: true })
  }

  const loadingBudget = !spaceId || budgetsQuery.isPending || monthTx.isPending

  return (
    <>
      <PageHeader title="Planejamento" description="Orçamento do mês, metas e próximos vencimentos." />

      <div className="grid gap-10">
        {/* Orçamento */}
        <section aria-labelledby="orcamento-titulo">
          <SectionTitle
            id="orcamento-titulo"
            title="Orçamento do mês"
            action={
              <Button size="sm" variant="ghost" onClick={() => setBudgetDialog({})} disabled={!spaceId}>
                <Plus aria-hidden="true" />
                Definir limite
              </Button>
            }
          />

          <div className="mb-4 flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => goToMonth(shiftMonth(month, -1))} aria-label="Mês anterior">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <p className="min-w-0 flex-1 text-center text-sm font-medium sm:flex-none sm:px-3" aria-live="polite">
              {formatMonth(month)}
            </p>
            <Button variant="outline" size="icon" onClick={() => goToMonth(shiftMonth(month, 1))} aria-label="Próximo mês">
              <ChevronRight aria-hidden="true" />
            </Button>
            {!isCurrentMonth && (
              <Button variant="ghost" size="sm" onClick={() => goToMonth(currentYearMonth())}>
                Mês atual
              </Button>
            )}
          </div>

          {loadingBudget ? (
            <div className="grid gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : budgetsQuery.error || monthTx.error ? (
            <ErrorState error={budgetsQuery.error ?? monthTx.error} onRetry={() => { budgetsQuery.refetch(); monthTx.refetch() }} />
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="Nenhum limite definido"
              action={
                <Button onClick={() => setBudgetDialog({})}>
                  <Plus aria-hidden="true" />
                  Definir o primeiro limite
                </Button>
              }
            >
              Escolha categorias como Alimentação ou Lazer e diga quanto quer gastar por mês. O CashBot avisa quando chegar
              perto do limite. Os gastos incluem o que ainda está a pagar no mês.
            </EmptyState>
          ) : (
            <div className="grid gap-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Gasto nas categorias com limite</p>
                  <p className="tabular text-sm">
                    <span className="font-display text-xl font-semibold">{formatMoney(totalSpentBudgeted)}</span>{' '}
                    <span className="text-muted-foreground">de {formatMoney(totalBudget)}</span>
                  </p>
                </div>
                <ProgressBar
                  className="mt-3"
                  value={totalStatus.pct}
                  tone={totalStatus.state}
                  label="Uso do orçamento total"
                />
                <p className={cn('mt-2 text-xs', totalStatus.state === 'over' ? 'text-negative' : 'text-muted-foreground')}>
                  {totalStatus.remaining >= 0
                    ? `Restam ${formatMoney(totalStatus.remaining)} no mês.`
                    : `Passou ${formatMoney(-totalStatus.remaining)} do total planejado.`}
                </p>
              </Card>

              <ul className="divide-y rounded-lg border bg-card">
                {budgetRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setBudgetDialog({ categoryId: row.categoryId })}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      aria-label={`Ajustar limite de ${categoryName(row.categoryId)}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                          {row.state === 'over' && <CircleAlert className="size-4 shrink-0 text-negative" aria-hidden="true" />}
                          {row.state === 'warning' && <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />}
                          <span className="truncate">{categoryName(row.categoryId)}</span>
                        </span>
                        <span className="tabular whitespace-nowrap text-sm">
                          {formatMoney(row.spent)} <span className="text-muted-foreground">/ {formatMoney(row.amount)}</span>
                        </span>
                      </div>
                      <ProgressBar
                        className="mt-2"
                        value={row.pct}
                        tone={row.state}
                        label={`Uso do limite de ${categoryName(row.categoryId)}`}
                      />
                      <p
                        className={cn(
                          'mt-1.5 text-xs',
                          row.state === 'over' ? 'text-negative' : row.state === 'warning' ? 'text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {row.state === 'over'
                          ? `Passou ${formatMoney(-row.remaining)} do limite`
                          : row.state === 'warning'
                            ? `Atenção: restam ${formatMoney(row.remaining)} (${Math.round(row.pct)}% usado)`
                            : `Restam ${formatMoney(row.remaining)}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>

              {unbudgeted.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Gastos sem limite definido
                  </p>
                  <ul className="divide-y rounded-lg border border-dashed">
                    {unbudgeted.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 py-2 pl-4 pr-2">
                        <span className="min-w-0 truncate text-sm">{categoryName(u.id)}</span>
                        <span className="tabular ml-auto whitespace-nowrap text-sm">{formatMoney(u.value)}</span>
                        <Button size="sm" variant="ghost" onClick={() => setBudgetDialog({ categoryId: u.id })}>
                          Definir limite
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Metas */}
        <section aria-labelledby="metas-titulo">
          <SectionTitle
            id="metas-titulo"
            title="Metas"
            action={
              <Button size="sm" variant="ghost" onClick={() => setGoalDialog({})} disabled={!spaceId}>
                <Plus aria-hidden="true" />
                Nova meta
              </Button>
            }
          />
          {!spaceId || goalsQuery.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : goalsQuery.error ? (
            <ErrorState error={goalsQuery.error} onRetry={() => goalsQuery.refetch()} />
          ) : goals.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="Nenhuma meta ainda"
              action={
                <Button variant="outline" onClick={() => setGoalDialog({})}>
                  <Plus aria-hidden="true" />
                  Criar meta
                </Button>
              }
            >
              Reserva de emergência, viagem, troca de carro: defina o valor e, se quiser, um prazo. O CashBot mostra quanto
              guardar por mês.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onSave={() => setSavingGoal(g)}
                  onEdit={() => setGoalDialog({ goal: g })}
                  onDelete={canDeleteAny || g.createdBy === user.id ? () => setDeletingGoal(g) : undefined}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Próximos vencimentos */}
        <section aria-labelledby="vencimentos-titulo">
          <SectionTitle id="vencimentos-titulo" title="Próximos vencimentos" />
          {!spaceId || upcoming.isPending ? (
            <Skeleton className="h-32" />
          ) : upcoming.error ? (
            <ErrorState error={upcoming.error} onRetry={() => upcoming.refetch()} />
          ) : (upcoming.data ?? []).length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nada a pagar ou receber nos próximos 60 dias">
              Lançamentos marcados como “A pagar” ou “A receber” aparecem aqui, organizados por data.
            </EmptyState>
          ) : (
            <div className="grid gap-5">
              {groupUpcoming(upcoming.data ?? [], today).map((group) => (
                <div key={group.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 border-b pb-2">
                    <h3
                      className={cn(
                        'font-sans text-xs font-medium uppercase tracking-wider',
                        group.key === 'late' ? 'text-negative' : 'text-muted-foreground',
                      )}
                    >
                      {group.title}
                    </h3>
                    <span className="tabular text-xs text-muted-foreground">{group.items.length}</span>
                  </div>
                  <ul>
                    {group.items.map((t) => (
                      <li key={t.id}>
                        <TransactionRow t={t} names={names} showDate onSelect={setEditingTx} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {budgetDialog && spaceId && (
        <BudgetDialog
          key={budgetDialog.categoryId ?? 'new'}
          spaceId={spaceId}
          categories={categories}
          budgets={budgets}
          initialCategoryId={budgetDialog.categoryId}
          onClose={() => setBudgetDialog(null)}
        />
      )}
      {goalDialog && spaceId && (
        <GoalDialog key={goalDialog.goal?.id ?? 'new'} spaceId={spaceId} goal={goalDialog.goal} onClose={() => setGoalDialog(null)} />
      )}
      {savingGoal && spaceId && <GoalSavedDialog spaceId={spaceId} goal={savingGoal} onClose={() => setSavingGoal(null)} />}
      {editingTx && spaceId && (
        <TransactionDialog
          key={editingTx.id}
          spaceId={spaceId}
          categories={categories}
          transaction={editingTx}
          canDelete={canDeleteAny || editingTx.created_by === user.id}
          onClose={() => setEditingTx(null)}
        />
      )}
      <ConfirmDialog
        open={deletingGoal !== null}
        onOpenChange={(open) => !open && setDeletingGoal(null)}
        title="Excluir meta?"
        description={
          <>
            A meta <strong className="font-medium text-foreground">{deletingGoal?.name}</strong> será excluída. O dinheiro
            guardado não é afetado: a meta só acompanha o valor.
          </>
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deletingGoal) return
          try {
            await deleteGoal.mutateAsync(deletingGoal.id)
            toast.success('Meta excluída.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível excluir a meta.'))
            throw err
          }
        }}
      />
    </>
  )
}

/** Agrupa pendências: atrasadas, depois por dia. */
function groupUpcoming(items: Transaction[], today: string) {
  const late = items.filter((t) => t.occurred_on < today)
  const groups: Array<{ key: string; title: string; items: Transaction[] }> = []
  if (late.length > 0) groups.push({ key: 'late', title: 'Atrasadas', items: late })
  for (const t of items.filter((x) => x.occurred_on >= today)) {
    const last = groups[groups.length - 1]
    if (last && last.key === t.occurred_on) last.items.push(t)
    else groups.push({ key: t.occurred_on, title: formatDayHeading(t.occurred_on), items: [t] })
  }
  return groups
}
