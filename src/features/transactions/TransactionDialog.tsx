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
import type { Category, CategoryKind } from '@/features/categories/api'
import { toUserMessage } from '@/lib/errors'
import { formatMoney, formatMoneyInput, parseMoneyInput } from '@/lib/money'
import { todayISO } from '@/lib/dates'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type Transaction,
  type TransactionStatus,
} from './api'

type Props = {
  spaceId: string
  categories: Category[]
  /** Movimentação a editar; ausente para criar uma nova. */
  transaction?: Transaction
  defaultDate?: string
  canDelete?: boolean
  onClose: () => void
}

export function TransactionDialog({ spaceId, categories, transaction, defaultDate, canDelete = false, onClose }: Props) {
  const editing = Boolean(transaction)
  const create = useCreateTransaction(spaceId)
  const update = useUpdateTransaction(spaceId)
  const remove = useDeleteTransaction(spaceId)

  const [kind, setKind] = useState<CategoryKind>(transaction?.kind ?? 'expense')
  const [amountText, setAmountText] = useState(transaction ? formatMoneyInput(transaction.amount) : '')
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [occurredOn, setOccurredOn] = useState(transaction?.occurred_on ?? defaultDate ?? todayISO())
  const [categoryId, setCategoryId] = useState<string>(transaction?.category_id ?? '')
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? 'paid')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const keepOpenRef = useRef(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const options = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.archived || c.id === transaction?.category_id)),
    [categories, kind, transaction?.category_id],
  )

  const amount = parseMoneyInput(amountText)
  const saving = create.isPending || update.isPending

  function changeKind(next: CategoryKind) {
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

    const input = {
      kind,
      description,
      amount,
      occurredOn,
      categoryId: categoryId || null,
      status,
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
          toast.success(`${kind === 'income' ? 'Receita' : 'Despesa'} de ${formatMoney(amount)} lançada.`)
          if (keepOpen) resetForNext()
          else onClose()
        },
        onError,
      })
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar movimentação' : 'Nova movimentação'}</DialogTitle>
            <DialogDescription className="sr-only">
              Preencha tipo, valor, descrição, data e categoria.
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
                placeholder={kind === 'income' ? 'Ex.: Salário de outubro' : 'Ex.: Mercado do mês'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tx-date">Data</Label>
                <Input id="tx-date" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tx-category">Categoria</Label>
                <NativeSelect id="tx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.archived ? ' (arquivada)' : ''}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium" aria-hidden="true">
                Situação
              </span>
              <Segmented
                label="Situação"
                value={status}
                onChange={setStatus}
                className="w-full"
                options={[
                  { value: 'paid', label: kind === 'income' ? 'Recebida' : 'Paga' },
                  { value: 'pending', label: kind === 'income' ? 'A receber' : 'A pagar' },
                ]}
              />
            </div>

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
