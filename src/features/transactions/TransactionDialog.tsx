import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { isCard, useAccounts, type Account } from '@/features/accounts/api'
import type { Category } from '@/features/categories/api'
import { toUserMessage } from '@/lib/errors'
import { formatMoney, formatMoneyInput, parseMoneyInput } from '@/lib/money'
import { todayISO } from '@/lib/dates'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type Transaction,
  type TransactionKind,
  type TransactionStatus,
} from './api'

export type TransactionPrefill = Partial<{
  kind: TransactionKind
  amount: number
  description: string
  accountId: string | null
  transferAccountId: string | null
  occurredOn: string
}>

type Props = {
  spaceId: string
  categories: Category[]
  /** Movimentação a editar; ausente para criar uma nova. */
  transaction?: Transaction
  /** Valores iniciais de uma nova movimentação (ex.: pagamento de fatura). */
  prefill?: TransactionPrefill
  defaultDate?: string
  canDelete?: boolean
  onClose: () => void
}

const KIND_NOUN: Record<TransactionKind, string> = {
  expense: 'Despesa',
  income: 'Receita',
  transfer: 'Transferência',
}

function AccountOptions({ accounts, keepId }: { accounts: Account[]; keepId?: string | null }) {
  const visible = accounts.filter((a) => !a.archived || a.id === keepId)
  const regular = visible.filter((a) => !isCard(a))
  const cards = visible.filter(isCard)
  return (
    <>
      {regular.length > 0 && (
        <optgroup label="Contas">
          {regular.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived ? ' (arquivada)' : ''}
            </option>
          ))}
        </optgroup>
      )}
      {cards.length > 0 && (
        <optgroup label="Cartões">
          {cards.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived ? ' (arquivado)' : ''}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )
}

export function TransactionDialog({
  spaceId,
  categories,
  transaction,
  prefill,
  defaultDate,
  canDelete = false,
  onClose,
}: Props) {
  const editing = Boolean(transaction)
  const create = useCreateTransaction(spaceId)
  const update = useUpdateTransaction(spaceId)
  const remove = useDeleteTransaction(spaceId)
  const accountsQuery = useAccounts(spaceId)
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])

  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? prefill?.kind ?? 'expense')
  const initialAmount = transaction?.amount ?? prefill?.amount
  const [amountText, setAmountText] = useState(initialAmount ? formatMoneyInput(initialAmount) : '')
  const [description, setDescription] = useState(transaction?.description ?? prefill?.description ?? '')
  const [occurredOn, setOccurredOn] = useState(
    transaction?.occurred_on ?? prefill?.occurredOn ?? defaultDate ?? todayISO(),
  )
  const [categoryId, setCategoryId] = useState<string>(transaction?.category_id ?? '')
  // undefined = ainda não escolhido (usa a primeira conta quando as contas carregarem).
  const [accountChoice, setAccountChoice] = useState<string | undefined>(
    transaction ? (transaction.account_id ?? '') : prefill?.accountId ?? undefined,
  )
  const [transferTo, setTransferTo] = useState<string>(
    transaction?.transfer_account_id ?? prefill?.transferAccountId ?? '',
  )
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? 'paid')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const keepOpenRef = useRef(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const firstRegular = accounts.find((a) => !a.archived && !isCard(a))
  const accountId = accountChoice ?? firstRegular?.id ?? ''
  const selectedAccount = accounts.find((a) => a.id === accountId)
  const onCard = Boolean(selectedAccount && isCard(selectedAccount))

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.archived || c.id === transaction?.category_id)),
    [categories, kind, transaction?.category_id],
  )

  const amount = parseMoneyInput(amountText)
  const saving = create.isPending || update.isPending

  function changeKind(next: TransactionKind) {
    setKind(next)
    // A categoria precisa ser do mesmo tipo.
    if (categoryId && !categories.some((c) => c.id === categoryId && c.kind === next)) setCategoryId('')
  }

  function resetForNext() {
    setAmountText('')
    setDescription('')
    setNotes('')
    setError(null)
    amountRef.current?.focus()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (amount === null || amount <= 0) {
      setError('Informe um valor maior que zero. Ex.: 1.250,90')
      return
    }
    if (!description.trim()) {
      setError('Informe uma descrição.')
      return
    }
    if (!occurredOn) {
      setError('Informe a data.')
      return
    }
    if (kind === 'transfer') {
      if (!accountId || !transferTo) {
        setError('Escolha a conta de origem e a de destino.')
        return
      }
      if (accountId === transferTo) {
        setError('A conta de origem e a de destino precisam ser diferentes.')
        return
      }
    }

    const input = {
      kind,
      description,
      amount,
      occurredOn,
      categoryId: categoryId || null,
      accountId: accountId || null,
      transferAccountId: kind === 'transfer' ? transferTo : null,
      // Compras no cartão entram na fatura; a situação de pagamento é a da fatura.
      status: kind !== 'transfer' && onCard ? ('paid' as const) : status,
      notes,
    }
    const onError = (err: unknown) => setError(toUserMessage(err, 'Não foi possível salvar a movimentação.'))

    if (transaction) {
      update.mutate(
        { id: transaction.id, ...input },
        {
          onSuccess: () => {
            toast.success('Movimentação atualizada.')
            onClose()
          },
          onError,
        },
      )
    } else {
      const keepOpen = keepOpenRef.current
      create.mutate(input, {
        onSuccess: () => {
          toast.success(`${KIND_NOUN[kind]} de ${formatMoney(amount)} lançada.`)
          if (keepOpen) resetForNext()
          else onClose()
        },
        onError,
      })
    }
  }

  const placeholder =
    kind === 'income' ? 'Ex.: Salário de outubro' : kind === 'transfer' ? 'Ex.: Pagamento da fatura' : 'Ex.: Mercado do mês'

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar movimentação' : 'Nova movimentação'}</DialogTitle>
            <DialogDescription className="sr-only">
              Preencha tipo, valor, descrição, data, conta e categoria.
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4" noValidate>
            <FormError message={error} />

            <Segmented
              label="Tipo"
              value={kind}
              onChange={changeKind}
              className="w-full"
              options={[
                { value: 'expense', label: 'Despesa', className: 'text-negative' },
                { value: 'income', label: 'Receita', className: 'text-positive' },
                { value: 'transfer', label: 'Transferência' },
              ]}
            />

            <div className="grid gap-2">
              <Label htmlFor="tx-amount">Valor</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="tx-amount"
                  ref={amountRef}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="tabular pl-10 text-lg font-medium"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  onBlur={() => amount !== null && setAmountText(formatMoneyInput(amount))}
                  autoFocus={!editing}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tx-description">Descrição</Label>
              <Input
                id="tx-description"
                maxLength={140}
                placeholder={placeholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {kind === 'transfer' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="tx-from">De</Label>
                  <NativeSelect id="tx-from" value={accountId} onChange={(e) => setAccountChoice(e.target.value)}>
                    <option value="">Escolha</option>
                    <AccountOptions accounts={accounts} keepId={transaction?.account_id} />
                  </NativeSelect>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tx-to">Para</Label>
                  <NativeSelect id="tx-to" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                    <option value="">Escolha</option>
                    <AccountOptions accounts={accounts} keepId={transaction?.transfer_account_id} />
                  </NativeSelect>
                </div>
                {accounts.length < 2 && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Para transferir, cadastre pelo menos duas contas em Contas e cartões.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="tx-account">{kind === 'income' ? 'Recebida em' : 'Paga com'}</Label>
                  <NativeSelect id="tx-account" value={accountId} onChange={(e) => setAccountChoice(e.target.value)}>
                    <option value="">Sem conta</option>
                    <AccountOptions accounts={accounts} keepId={transaction?.account_id} />
                  </NativeSelect>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tx-category">Categoria</Label>
                  <NativeSelect id="tx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">Sem categoria</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.archived ? ' (arquivada)' : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="tx-date">{kind !== 'transfer' && onCard ? 'Data da compra' : 'Data'}</Label>
              <Input id="tx-date" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
            </div>

            {kind !== 'transfer' && onCard ? (
              <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
                Compras no cartão entram na fatura conforme a data e o dia de fechamento do cartão.
              </p>
            ) : (
              <div className="grid gap-2">
                <span className="text-sm font-medium" aria-hidden="true">
                  Situação
                </span>
                <Segmented
                  label="Situação"
                  value={status}
                  onChange={setStatus}
                  className="w-full"
                  options={
                    kind === 'transfer'
                      ? [
                          { value: 'paid', label: 'Feita' },
                          { value: 'pending', label: 'Agendada' },
                        ]
                      : [
                          { value: 'paid', label: kind === 'income' ? 'Recebida' : 'Paga' },
                          { value: 'pending', label: kind === 'income' ? 'A receber' : 'A pagar' },
                        ]
                  }
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="tx-notes">
                Observações <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea id="tx-notes" maxLength={500} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <DialogFooter className="items-stretch sm:items-center">
              {editing && canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Excluir
                </Button>
              )}
              {!editing && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    keepOpenRef.current = true
                    formRef.current?.requestSubmit()
                  }}
                >
                  Salvar e lançar outra
                </Button>
              )}
              <Button
                type="submit"
                loading={saving}
                onClick={() => {
                  keepOpenRef.current = false
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {transaction && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir movimentação?"
          description={
            <>
              <strong className="font-medium text-foreground">{transaction.description}</strong> (
              {formatMoney(transaction.amount)}) será excluída definitivamente.
            </>
          }
          confirmLabel="Excluir"
          onConfirm={async () => {
            try {
              await remove.mutateAsync(transaction.id)
              toast.success('Movimentação excluída.')
              onClose()
            } catch (err) {
              toast.error(toUserMessage(err, 'Não foi possível excluir a movimentação.'))
              throw err
            }
          }}
        />
      )}
    </>
  )
}
