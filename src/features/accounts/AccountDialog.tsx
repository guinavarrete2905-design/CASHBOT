import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { toUserMessage } from '@/lib/errors'
import { formatMoneyInput, parseMoneyInput } from '@/lib/money'
import {
  ACCOUNT_TYPE_LABEL,
  isCard,
  useCreateAccount,
  useUpdateAccount,
  type Account,
  type AccountType,
} from './api'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

/** Lê um valor que pode ser negativo ("-1.234,56"). */
function parseSigned(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const negative = trimmed.startsWith('-')
  const value = parseMoneyInput(negative ? trimmed.slice(1) : trimmed)
  if (value === null) return null
  return negative ? -value : value
}

function MoneyField({ id, label, hint, value, onChange, allowNegative = false }: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  allowNegative?: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode={allowNegative ? 'text' : 'decimal'}
          autoComplete="off"
          placeholder="0,00"
          className="tabular pl-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export function AccountDialog({ spaceId, account, defaultType = 'checking', onClose }: {
  spaceId: string
  account?: Account
  defaultType?: AccountType
  onClose: () => void
}) {
  const editing = Boolean(account)
  const create = useCreateAccount(spaceId)
  const update = useUpdateAccount(spaceId)

  const [type, setType] = useState<AccountType>(account?.type ?? defaultType)
  const [name, setName] = useState(account?.name ?? '')
  const [initialText, setInitialText] = useState(
    account ? formatMoneyInput(Math.abs(account.initialBalance)) : '',
  )
  const [initialNegative, setInitialNegative] = useState(Boolean(account && !isCard(account) && account.initialBalance < 0))
  const [limitText, setLimitText] = useState(account?.creditLimit != null ? formatMoneyInput(account.creditLimit) : '')
  const [closingDay, setClosingDay] = useState(String(account?.closing_day ?? 5))
  const [dueDay, setDueDay] = useState(String(account?.due_day ?? 12))
  const [error, setError] = useState<string | null>(null)

  const card = type === 'credit_card'
  const saving = create.isPending || update.isPending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Informe um nome. Ex.: Nubank, Carteira, Poupança.')
      return
    }
    const initial = parseSigned(initialText)
    if (initial === null) {
      setError('O valor inicial não é válido. Ex.: 1.250,90')
      return
    }
    const limit = limitText.trim() ? parseMoneyInput(limitText) : null
    if (card && limitText.trim() && limit === null) {
      setError('O limite não é válido. Ex.: 5.000,00')
      return
    }

    const input = {
      name,
      type,
      initialBalance: card ? Math.abs(initial) : initialNegative ? -Math.abs(initial) : Math.abs(initial),
      creditLimit: card ? limit : null,
      closingDay: card ? Number(closingDay) : null,
      dueDay: card ? Number(dueDay) : null,
    }
    const onError = (err: unknown) => setError(toUserMessage(err, 'Não foi possível salvar.'))

    if (account) {
      update.mutate(
        { id: account.id, ...input },
        {
          onSuccess: () => {
            toast.success(card ? 'Cartão atualizado.' : 'Conta atualizada.')
            onClose()
          },
          onError,
        },
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(card ? 'Cartão cadastrado.' : 'Conta cadastrada.')
          onClose()
        },
        onError,
      })
    }
  }

  // Ao editar, conta não vira cartão (nem o contrário).
  const typeOptions = (Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).filter(
    (t) => !account || (t === 'credit_card') === isCard(account),
  )

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? (card ? 'Editar cartão' : 'Editar conta') : card ? 'Novo cartão' : 'Nova conta'}
          </DialogTitle>
          <DialogDescription>
            {card
              ? 'Os dias de fechamento e vencimento organizam as compras em faturas.'
              : 'O saldo é atualizado a cada receita, despesa ou transferência marcada como paga.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="acc-type">Tipo</Label>
              <NativeSelect
                id="acc-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                disabled={typeOptions.length < 2}
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-name">Nome</Label>
              <Input
                id="acc-name"
                maxLength={60}
                placeholder={card ? 'Ex.: Nubank' : 'Ex.: Sicredi'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={!editing}
              />
            </div>
          </div>

          {card ? (
            <>
              <MoneyField id="acc-limit" label="Limite (opcional)" value={limitText} onChange={setLimitText} />
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="acc-closing">Dia do fechamento</Label>
                  <NativeSelect id="acc-closing" value={closingDay} onChange={(e) => setClosingDay(e.target.value)}>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        Dia {d}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="acc-due">Dia do vencimento</Label>
                  <NativeSelect id="acc-due" value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        Dia {d}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <MoneyField
                id="acc-initial"
                label="Valor já em aberto no cartão (opcional)"
                hint="O que você já deve neste cartão antes de começar a lançar as compras aqui."
                value={initialText}
                onChange={setInitialText}
              />
            </>
          ) : (
            <div className="grid gap-2">
              <MoneyField
                id="acc-initial"
                label="Saldo inicial"
                hint="Saldo da conta antes dos lançamentos que você vai registrar aqui."
                value={initialText}
                onChange={setInitialText}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="acc-negative"
                  type="checkbox"
                  className="size-4 rounded border-input accent-[hsl(var(--primary))]"
                  checked={initialNegative}
                  onChange={(e) => setInitialNegative(e.target.checked)}
                />
                Saldo negativo (no cheque especial)
              </label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
