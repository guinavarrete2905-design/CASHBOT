import { useState } from 'react'
import { ArrowRightLeft, Tag, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { Account } from '@/features/accounts/api'
import type { Category } from '@/features/categories/api'
import { toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import type { Transaction } from '../api'
import { useDeleteTransactionsBatch, useUpdateTransactionsBatch } from './api'
import { accountChangeProblem, categoryChange, deleteBlockedCount, selectionTotals } from './rules'

/*
  Barra de ações em massa da lista de movimentações (aparece quando há movimentações marcadas).
  Excluir, trocar conta e trocar categoria: cada ação vale para todas as selecionadas ou para nenhuma.
  Em parcelas e recorrências, a ação vale só para as movimentações selecionadas (como "Só esta").
*/

type Mode = null | 'account' | 'category' | 'delete'

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function SelectionBar({
  spaceId,
  selected,
  visibleCount,
  accounts,
  categories,
  userId,
  canDeleteAny,
  onSelectAll,
  onClear,
  onExit,
}: {
  spaceId: string
  selected: Transaction[]
  visibleCount: number
  accounts: Account[]
  categories: Category[]
  userId: string
  canDeleteAny: boolean
  onSelectAll: () => void
  onClear: () => void
  onExit: () => void
}) {
  const [mode, setMode] = useState<Mode>(null)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateTransactionsBatch(spaceId)
  const remove = useDeleteTransactionsBatch(spaceId)

  const count = selected.length
  const totals = selectionTotals(selected)
  const cat = categoryChange(selected)
  const blocked = deleteBlockedCount(selected, userId, canDeleteAny)
  const activeAccounts = accounts.filter((a) => !a.archived)
  const ids = selected.map((t) => t.id)
  const accountProblem = mode === 'account' ? accountChangeProblem(selected, accountId === '__none' ? null : accountId || null) : null
  const movingToCard = activeAccounts.some((a) => a.id === accountId && a.type === 'credit_card')
  const hasTransfers = selected.some((t) => t.kind === 'transfer')

  function open(next: Mode) {
    setError(null)
    setAccountId('')
    setCategoryId('')
    setMode(next)
  }

  async function applyAccount() {
    if (!accountId || accountProblem) return
    setError(null)
    try {
      const n = await update.mutateAsync({ ids, account: { id: accountId === '__none' ? null : accountId } })
      toast.success(`Conta alterada em ${plural(n, 'movimentação', 'movimentações')}.`)
      setMode(null)
      onClear()
    } catch (err) {
      setError(toUserMessage(err, 'Não foi possível alterar. Nada foi modificado.'))
    }
  }

  async function applyCategory() {
    if (!categoryId) return
    setError(null)
    try {
      const n = await update.mutateAsync({ ids, category: { id: categoryId === '__none' ? null : categoryId } })
      toast.success(`Categoria alterada em ${plural(n, 'movimentação', 'movimentações')}.`)
      setMode(null)
      onClear()
    } catch (err) {
      setError(toUserMessage(err, 'Não foi possível alterar. Nada foi modificado.'))
    }
  }

  async function applyDelete() {
    try {
      const n = await remove.mutateAsync(ids)
      toast.success(`${plural(n, 'movimentação excluída', 'movimentações excluídas')}.`)
      onClear()
    } catch (err) {
      toast.error(toUserMessage(err, 'Não foi possível excluir. Nada foi excluído.'))
      throw err
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label="Ações para as movimentações selecionadas"
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-6 lg:left-64 lg:px-10"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-lg border bg-popover px-3 py-2 shadow-lg">
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">
            <span className="font-medium">{count === 0 ? 'Nenhuma selecionada' : plural(count, 'selecionada', 'selecionadas')}</span>
            {count > 0 && (
              <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                {totals.expense > 0 && <>Despesas {formatMoney(totals.expense)} </>}
                {totals.income > 0 && <>· Receitas {formatMoney(totals.income)} </>}
                {totals.transfer > 0 && <>· Transferências {formatMoney(totals.transfer)}</>}
              </span>
            )}
            {count < visibleCount && (
              <button type="button" onClick={onSelectAll} className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline">
                Selecionar todas ({visibleCount})
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" disabled={count === 0} onClick={() => open('account')}>
              <ArrowRightLeft aria-hidden="true" />
              Conta
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={count === 0}
              onClick={() => (cat.allowed ? open('category') : toast.info(cat.reason))}
              title={cat.allowed ? undefined : cat.reason}
            >
              <Tag aria-hidden="true" />
              Categoria
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-negative hover:text-negative"
              disabled={count === 0}
              onClick={() =>
                blocked > 0
                  ? toast.error(`Você só pode excluir as movimentações que lançou. ${plural(blocked, 'selecionada foi lançada', 'selecionadas foram lançadas')} por outra pessoa.`)
                  : open('delete')
              }
            >
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={onExit} aria-label="Limpar seleção" title="Limpar seleção (Esc)">
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Trocar conta */}
      <Dialog open={mode === 'account'} onOpenChange={(o) => !o && !update.isPending && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar conta</DialogTitle>
            <DialogDescription>{plural(count, 'movimentação selecionada', 'movimentações selecionadas')}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-account">Nova conta</Label>
            <NativeSelect id="bulk-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Escolha…</option>
              {!hasTransfers && <option value="__none">Sem conta</option>}
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.type === 'credit_card' ? ' (cartão)' : ''}
                </option>
              ))}
            </NativeSelect>
            {hasTransfers && <p className="text-xs text-muted-foreground">Nas transferências, muda a conta de origem.</p>}
            {movingToCard && <p className="text-xs text-muted-foreground">Compras no cartão ficam com a situação da fatura (pagas), como no formulário.</p>}
            {totals.inSeries > 0 && <p className="text-xs text-muted-foreground">Parcelas e repetições: muda só as selecionadas, não a série inteira.</p>}
            {accountProblem && <p className="text-sm text-negative">{accountProblem}</p>}
            {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setMode(null)} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => void applyAccount()} disabled={!accountId || Boolean(accountProblem)} loading={update.isPending}>
              Alterar {plural(count, 'movimentação', 'movimentações')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trocar categoria */}
      <Dialog open={mode === 'category'} onOpenChange={(o) => !o && !update.isPending && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar categoria</DialogTitle>
            <DialogDescription>
              {plural(count, cat.allowed && cat.kind === 'income' ? 'receita selecionada' : 'despesa selecionada', cat.allowed && cat.kind === 'income' ? 'receitas selecionadas' : 'despesas selecionadas')}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-category">Nova categoria</Label>
            <NativeSelect id="bulk-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Escolha…</option>
              <option value="__none">Sem categoria</option>
              {cat.allowed &&
                categories
                  .filter((c) => c.kind === cat.kind && !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
            </NativeSelect>
            {totals.inSeries > 0 && <p className="text-xs text-muted-foreground">Parcelas e repetições: muda só as selecionadas, não a série inteira.</p>}
            {error && <p className="text-sm text-negative" role="alert">{error}</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setMode(null)} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => void applyCategory()} disabled={!categoryId} loading={update.isPending}>
              Alterar {plural(count, 'movimentação', 'movimentações')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <ConfirmDialog
        open={mode === 'delete'}
        onOpenChange={(o) => !o && setMode(null)}
        title={`Excluir ${plural(count, 'movimentação', 'movimentações')}?`}
        description={
          <div className="grid gap-1.5">
            <p>Esta ação não pode ser desfeita. Saldos, faturas e relatórios serão recalculados.</p>
            {totals.inSeries > 0 && <p>{plural(totals.inSeries, 'é parcela ou repetição', 'são parcelas ou repetições')}: só as selecionadas são excluídas; as demais da série continuam.</p>}
          </div>
        }
        confirmLabel={`Excluir ${count}`}
        onConfirm={applyDelete}
      />
    </>
  )
}
