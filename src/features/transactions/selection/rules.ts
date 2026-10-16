/*
  Regras das ações em massa, sem React (testadas em rules.test.ts). Antecipam na tela o que o banco
  recusaria, para explicar o motivo antes de a pessoa tentar.
*/

export type SelectedTx = {
  id: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  created_by: string | null
  account_id: string | null
  transfer_account_id: string | null
  series_id: string | null
}

/** Alterar categoria só faz sentido com receitas OU despesas (transferências não têm categoria). */
export function categoryChange(items: SelectedTx[]): { allowed: true; kind: 'income' | 'expense' } | { allowed: false; reason: string } {
  if (!items.length) return { allowed: false, reason: 'Selecione movimentações.' }
  if (items.some((t) => t.kind === 'transfer')) return { allowed: false, reason: 'Transferências não têm categoria. Tire-as da seleção.' }
  const kinds = new Set(items.map((t) => t.kind))
  if (kinds.size > 1) return { allowed: false, reason: 'A seleção mistura receitas e despesas. Selecione só um tipo para trocar a categoria.' }
  return { allowed: true, kind: items[0].kind as 'income' | 'expense' }
}

/** Problema ao trocar a conta (origem, nas transferências) para `accountId`. */
export function accountChangeProblem(items: SelectedTx[], accountId: string | null): string | null {
  const transfers = items.filter((t) => t.kind === 'transfer')
  if (!transfers.length) return null
  if (!accountId) return 'Transferências precisam de uma conta de origem.'
  if (transfers.some((t) => t.transfer_account_id === accountId)) return 'Em alguma transferência, essa conta já é o destino. Origem e destino precisam ser diferentes.'
  return null
}

/** Quem não é proprietário/administrador só exclui o que lançou (mesma regra do banco). */
export function deleteBlockedCount(items: SelectedTx[], userId: string, canDeleteAny: boolean): number {
  if (canDeleteAny) return 0
  return items.filter((t) => t.created_by !== userId).length
}

/** Totais da seleção (transferências separadas, em centavos para não perder precisão). */
export function selectionTotals(items: SelectedTx[]) {
  let income = 0
  let expense = 0
  let transfer = 0
  for (const t of items) {
    const c = Math.round(t.amount * 100)
    if (t.kind === 'income') income += c
    else if (t.kind === 'expense') expense += c
    else transfer += c
  }
  return { income: income / 100, expense: expense / 100, transfer: transfer / 100, inSeries: items.filter((t) => t.series_id).length }
}

/** Seleção por intervalo (Shift+clique): ids entre a âncora e o alvo, na ordem da lista. */
export function rangeIds(order: string[], anchor: string, target: string): string[] {
  const a = order.indexOf(anchor)
  const b = order.indexOf(target)
  if (a < 0 || b < 0) return [target]
  const [from, to] = a < b ? [a, b] : [b, a]
  return order.slice(from, to + 1)
}
