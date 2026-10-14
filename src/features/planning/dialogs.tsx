import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import type { Category } from '@/features/categories/api'
import { toUserMessage } from '@/lib/errors'
import { formatMoney, formatMoneyInput, parseMoneyInput } from '@/lib/money'
import { useDeleteBudget, useSaveBudget, useSaveGoal, useUpdateGoalSaved, type Budget, type Goal } from './api'

export function BudgetDialog({ spaceId, categories, budgets, initialCategoryId, onClose }: {
  spaceId: string
  categories: Category[]
  budgets: Budget[]
  initialCategoryId?: string
  onClose: () => void
}) {
  const save = useSaveBudget(spaceId)
  const remove = useDeleteBudget(spaceId)
  const options = categories.filter((c) => c.kind === 'expense' && !c.archived)
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? options[0]?.id ?? '')
  const existing = budgets.find((b) => b.categoryId === categoryId)
  const [amountText, setAmountText] = useState(existing ? formatMoneyInput(existing.amount) : '')
  const [error, setError] = useState<string | null>(null)

  function changeCategory(id: string) {
    setCategoryId(id)
    const b = budgets.find((x) => x.categoryId === id)
    setAmountText(b ? formatMoneyInput(b.amount) : '')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = parseMoneyInput(amountText)
    if (!categoryId) return setError('Escolha uma categoria.')
    if (amount === null || amount <= 0) return setError('Informe um limite maior que zero. Ex.: 800,00')
    save.mutate(
      { categoryId, amount },
      {
        onSuccess: () => {
          toast.success('Orçamento salvo.')
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível salvar o orçamento.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? 'Ajustar orçamento' : 'Definir orçamento'}</DialogTitle>
          <DialogDescription>Quanto você quer gastar, no máximo, por mês nesta categoria.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <div className="grid gap-2">
            <Label htmlFor="budget-category">Categoria</Label>
            <NativeSelect id="budget-category" value={categoryId} onChange={(e) => changeCategory(e.target.value)}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {budgets.some((b) => b.categoryId === c.id) ? ' (já tem limite)' : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="budget-amount">Limite por mês</Label>
            <MoneyInput id="budget-amount" value={amountText} onValueChange={setAmountText} autoFocus />
          </div>
          <DialogFooter className="items-stretch sm:items-center">
            {existing && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(existing.id, {
                    onSuccess: () => {
                      toast.success('Limite removido.')
                      onClose()
                    },
                    onError: (err) => setError(toUserMessage(err, 'Não foi possível remover o limite.')),
                  })
                }
              >
                <Trash2 aria-hidden="true" />
                Remover limite
              </Button>
            )}
            <Button type="submit" loading={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GoalDialog({ spaceId, goal, onClose }: { spaceId: string; goal?: Goal; onClose: () => void }) {
  const save = useSaveGoal(spaceId)
  const [name, setName] = useState(goal?.name ?? '')
  const [targetText, setTargetText] = useState(goal ? formatMoneyInput(goal.target) : '')
  const [savedText, setSavedText] = useState(goal ? formatMoneyInput(goal.saved) : '')
  const [date, setDate] = useState(goal?.targetDate ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const target = parseMoneyInput(targetText)
    const saved = savedText.trim() ? parseMoneyInput(savedText) : 0
    if (!name.trim()) return setError('Dê um nome para a meta. Ex.: Viagem, Reserva de emergência.')
    if (target === null || target <= 0) return setError('Informe o valor da meta. Ex.: 10.000,00')
    if (saved === null) return setError('O valor já guardado não é válido.')
    save.mutate(
      { id: goal?.id, name, target, saved, targetDate: date || null },
      {
        onSuccess: () => {
          toast.success(goal ? 'Meta atualizada.' : 'Meta criada.')
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível salvar a meta.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          <DialogDescription>Com um prazo, o CashBot calcula quanto guardar por mês.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <div className="grid gap-2">
            <Label htmlFor="goal-name">Nome</Label>
            <Input id="goal-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="goal-target">Valor da meta</Label>
              <MoneyInput id="goal-target" value={targetText} onValueChange={setTargetText} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-saved">Já guardado</Label>
              <MoneyInput id="goal-saved" value={savedText} onValueChange={setSavedText} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="goal-date">
              Prazo <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Registra quanto foi guardado: somar um aporte, retirar ou corrigir o total. */
export function GoalSavedDialog({ spaceId, goal, onClose }: { spaceId: string; goal: Goal; onClose: () => void }) {
  const update = useUpdateGoalSaved(spaceId)
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add')
  const [amountText, setAmountText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const amount = parseMoneyInput(amountText)
  const next =
    amount === null
      ? null
      : mode === 'add'
        ? Math.round((goal.saved + amount) * 100) / 100
        : mode === 'remove'
          ? Math.round((goal.saved - amount) * 100) / 100
          : amount

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next === null) return setError('Informe um valor. Ex.: 250,00')
    if (next < 0) return setError('Não dá para retirar mais do que está guardado.')
    update.mutate(
      { id: goal.id, saved: next },
      {
        onSuccess: () => {
          toast.success(`Meta atualizada: ${formatMoney(next)} guardados.`)
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível atualizar a meta.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal.name}</DialogTitle>
          <DialogDescription>Guardado hoje: {formatMoney(goal.saved)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <Segmented
            label="Tipo de ajuste"
            value={mode}
            onChange={setMode}
            className="w-full"
            options={[
              { value: 'add', label: 'Guardar' },
              { value: 'remove', label: 'Retirar' },
              { value: 'set', label: 'Corrigir total' },
            ]}
          />
          <div className="grid gap-2">
            <Label htmlFor="goal-amount">{mode === 'set' ? 'Total guardado' : 'Valor'}</Label>
            <MoneyInput id="goal-amount" value={amountText} onValueChange={setAmountText} autoFocus />
            {next !== null && next >= 0 && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Novo total: {formatMoney(next)} de {formatMoney(goal.target)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={update.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
