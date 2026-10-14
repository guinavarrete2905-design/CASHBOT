import { useMemo, useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, CreditCard, Ellipsis, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountDialog } from '@/features/accounts/AccountDialog'
import {
  ACCOUNT_TYPE_LABEL,
  isCard,
  useAccounts,
  useArchiveAccount,
  useCardMovements,
  useDeleteAccount,
  type Account,
  type AccountType,
} from '@/features/accounts/api'
import { currentInvoices, invoiceTotal, type InvoicePeriod } from '@/features/accounts/invoice'
import { useCategories } from '@/features/categories/api'
import { TransactionDialog, type TransactionPrefill } from '@/features/transactions/TransactionDialog'
import { toUserMessage } from '@/lib/errors'
import { formatShortDate, todayISO } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCurrentSpace } from '@/providers/SpaceProvider'

function sumCents(values: number[]) {
  return values.reduce((s, v) => s + Math.round(v * 100), 0) / 100
}

function AccountMenu({ account, onEdit, onToggleArchive, onDelete }: {
  account: Account
  onEdit: () => void
  onToggleArchive: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações de ${account.name}`}>
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleArchive}>
          {account.archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
          {account.archived ? 'Reativar' : 'Arquivar'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InvoiceLine({ label, total, note }: { label: string; total: number; note: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 font-medium">{formatMoney(total)}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

function periodNote(kind: 'open' | 'closed', period: InvoicePeriod) {
  return kind === 'open'
    ? `Fecha em ${formatShortDate(period.closing)} · vence em ${formatShortDate(period.due)}`
    : `${period.due < todayISO() ? 'Venceu' : 'Vence'} em ${formatShortDate(period.due)}`
}

function CardItem({ card, movements, onPay, menu }: {
  card: Account
  movements: Parameters<typeof invoiceTotal>[0]
  onPay: (amount: number) => void
  menu: ReactNode
}) {
  const debt = Math.max(0, -card.balance)
  const { open, closed } = currentInvoices(card.closing_day ?? 1, card.due_day ?? 10)
  const openTotal = invoiceTotal(movements, card.id, open)
  const closedTotal = invoiceTotal(movements, card.id, closed)
  const usedPct = card.creditLimit ? Math.min(100, (debt / card.creditLimit) * 100) : null
  const available = card.creditLimit !== null ? card.creditLimit - debt : null

  return (
    <li className={cn('rounded-lg border bg-card p-4', card.archived && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <CreditCard className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {card.name}
            {card.archived && <span className="ml-2 text-xs font-normal text-muted-foreground">(arquivado)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Fecha dia {card.closing_day} · vence dia {card.due_day}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Em aberto</p>
          <p className={cn('tabular font-display text-lg font-semibold', debt > 0 && 'text-negative')}>{formatMoney(debt)}</p>
        </div>
        {menu}
      </div>

      {usedPct !== null && (
        <div className="mt-4">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-secondary"
            role="meter"
            aria-label="Limite usado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPct)}
          >
            <div
              className={cn('h-full rounded-full', usedPct >= 90 ? 'bg-warning' : 'bg-primary')}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {formatMoney(available ?? 0)} disponíveis de {formatMoney(card.creditLimit ?? 0)}
            {usedPct >= 90 && <span className="ml-1 font-medium text-warning">· limite quase no fim</span>}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
        <InvoiceLine label="Fatura atual" total={openTotal} note={periodNote('open', open)} />
        <InvoiceLine label="Última fatura fechada" total={closedTotal} note={periodNote('closed', closed)} />
      </div>

      {debt > 0 && !card.archived && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onPay(closedTotal > 0 ? Math.min(closedTotal, debt) : debt)}>
            Pagar fatura
          </Button>
        </div>
      )}
    </li>
  )
}

export function AccountsPage() {
  const { current } = useCurrentSpace()
  const spaceId = current?.id
  const canManage = current?.role === 'owner' || current?.role === 'admin'

  const accountsQuery = useAccounts(spaceId)
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const categoriesQuery = useCategories(spaceId)
  const archive = useArchiveAccount(spaceId ?? '')
  const remove = useDeleteAccount(spaceId ?? '')

  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<{ account?: Account; type?: AccountType } | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [paying, setPaying] = useState<TransactionPrefill | null>(null)

  const visible = accounts.filter((a) => showArchived || !a.archived)
  const regular = visible.filter((a) => !isCard(a))
  const cards = visible.filter(isCard)
  const archivedCount = accounts.filter((a) => a.archived).length

  // Movimentações dos cartões desde o início da última fatura fechada.
  const earliestStart = cards
    .map((c) => currentInvoices(c.closing_day ?? 1, c.due_day ?? 10).closed.start)
    .sort()[0]
  const movementsQuery = useCardMovements(spaceId, cards.map((c) => c.id), earliestStart ?? '9999-12-31')
  const movements = movementsQuery.data ?? []

  const activeRegular = accounts.filter((a) => !a.archived && !isCard(a))
  const totalBalance = sumCents(activeRegular.map((a) => a.balance))
  const totalDebt = sumCents(accounts.filter((a) => !a.archived && isCard(a)).map((a) => Math.max(0, -a.balance)))

  function toggleArchive(a: Account) {
    archive.mutate(
      { id: a.id, archived: !a.archived },
      {
        onSuccess: () => toast.success(a.archived ? 'Reativada.' : 'Arquivada. Ela some das listas, mas o histórico continua.'),
        onError: (err) => toast.error(toUserMessage(err, 'Não foi possível alterar.')),
      },
    )
  }

  function menuFor(a: Account) {
    if (!canManage) return null
    return (
      <AccountMenu
        account={a}
        onEdit={() => setEditing({ account: a })}
        onToggleArchive={() => toggleArchive(a)}
        onDelete={() => setDeleting(a)}
      />
    )
  }

  function payInvoice(card: Account, amount: number) {
    const from = accounts.find((a) => !a.archived && a.type === 'checking') ?? accounts.find((a) => !a.archived && !isCard(a))
    setPaying({
      kind: 'transfer',
      amount,
      description: `Pagamento da fatura ${card.name}`,
      accountId: from?.id ?? null,
      transferAccountId: card.id,
    })
  }

  const loading = !spaceId || accountsQuery.isPending

  return (
    <>
      <PageHeader
        title="Contas e cartões"
        description={current ? `Saldos e faturas de ${current.name}.` : undefined}
        actions={
          canManage ? (
            <Button onClick={() => setEditing({})} disabled={!spaceId}>
              <Plus aria-hidden="true" />
              Nova conta
            </Button>
          ) : undefined
        }
      />

      {!canManage && current && (
        <p className="-mt-4 mb-6 text-sm text-muted-foreground">
          Somente o proprietário ou um administrador do espaço cadastra e edita contas. Você pode usá-las nos lançamentos.
        </p>
      )}

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : accountsQuery.error ? (
        <ErrorState error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta cadastrada"
          action={
            canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setEditing({ type: 'checking' })}>
                  <Plus aria-hidden="true" />
                  Adicionar conta
                </Button>
                <Button variant="outline" onClick={() => setEditing({ type: 'credit_card' })}>
                  <CreditCard aria-hidden="true" />
                  Adicionar cartão
                </Button>
              </div>
            ) : undefined
          }
        >
          Cadastre contas bancárias, carteira e cartões. Com elas, o CashBot mostra o saldo de cada conta e organiza as
          compras do cartão em faturas.
        </EmptyState>
      ) : (
        <div className="grid gap-8">
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border">
            <div className="bg-card px-5 py-4">
              <p className="text-sm text-muted-foreground">Saldo em contas</p>
              <p className={cn('tabular mt-1 font-display text-2xl font-semibold', totalBalance < 0 && 'text-negative')}>
                {formatMoney(totalBalance)}
              </p>
            </div>
            <div className="bg-card px-5 py-4">
              <p className="text-sm text-muted-foreground">Em aberto nos cartões</p>
              <p className={cn('tabular mt-1 font-display text-2xl font-semibold', totalDebt > 0 && 'text-negative')}>
                {formatMoney(totalDebt)}
              </p>
            </div>
          </Card>

          <section aria-labelledby="contas-titulo">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="contas-titulo" className="font-sans text-base font-semibold">
                Contas
              </h2>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ type: 'checking' })}>
                  <Plus aria-hidden="true" />
                  Conta
                </Button>
              )}
            </div>
            {regular.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Nenhuma conta. Adicione a conta corrente, a poupança ou o dinheiro da carteira.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {regular.map((a) => (
                  <li key={a.id} className={cn('flex items-center gap-3 py-3 pl-4 pr-2', a.archived && 'opacity-60')}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                      <Landmark className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.name}
                        {a.archived && <span className="ml-2 text-xs font-normal text-muted-foreground">(arquivada)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABEL[a.type]}</p>
                    </div>
                    <p className={cn('tabular whitespace-nowrap text-sm font-medium', a.balance < 0 && 'text-negative')}>
                      {formatMoney(a.balance)}
                    </p>
                    {menuFor(a) ?? <span className="w-2" />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="cartoes-titulo">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="cartoes-titulo" className="font-sans text-base font-semibold">
                Cartões de crédito
              </h2>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ type: 'credit_card' })}>
                  <Plus aria-hidden="true" />
                  Cartão
                </Button>
              )}
            </div>
            {cards.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Nenhum cartão. Ao cadastrar, informe os dias de fechamento e vencimento para ver as faturas.
              </p>
            ) : movementsQuery.error ? (
              <ErrorState error={movementsQuery.error} onRetry={() => movementsQuery.refetch()} />
            ) : (
              <ul className="grid gap-3">
                {cards.map((c) => (
                  <CardItem
                    key={c.id}
                    card={c}
                    movements={movements}
                    onPay={(amount) => payInvoice(c, amount)}
                    menu={menuFor(c)}
                  />
                ))}
              </ul>
            )}
          </section>

          {archivedCount > 0 && (
            <div>
              <Button variant="link" className="h-auto px-0" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Esconder arquivadas' : `Mostrar arquivadas (${archivedCount})`}
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && spaceId && (
        <AccountDialog
          key={editing.account?.id ?? editing.type ?? 'new'}
          spaceId={spaceId}
          account={editing.account}
          defaultType={editing.type}
          onClose={() => setEditing(null)}
        />
      )}

      {paying && spaceId && (
        <TransactionDialog
          spaceId={spaceId}
          categories={categoriesQuery.data ?? []}
          prefill={paying}
          onClose={() => setPaying(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting && isCard(deleting) ? 'Excluir cartão?' : 'Excluir conta?'}
        description={
          <>
            <strong className="font-medium text-foreground">{deleting?.name}</strong> será excluída definitivamente. Só é
            possível excluir quando não há movimentações nela. Para manter o histórico, use Arquivar.
          </>
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success('Excluída.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível excluir.'))
            throw err
          }
        }}
      />
    </>
  )
}
