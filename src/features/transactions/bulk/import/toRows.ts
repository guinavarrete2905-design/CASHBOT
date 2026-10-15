import { matchCategory } from '@/features/assistant/parse'
import { normalize } from '@/features/assistant/normalize'
import { emptyRow, formatAmountBR, isoToBR, type BulkRow, type CategoryRef } from '../model'
import type { ImportedTx } from './mapping'

/*
  Converte movimentações lidas de um arquivo em linhas da planilha.
  - Extrato da conta: saída = despesa; entrada = receita.
  - Fatura do cartão: compra = despesa no cartão; crédito = estorno (receita no cartão), exceto pagamento da
    fatura, que vira transferência para o cartão com a conta de origem em aberto (o usuário escolhe).
  - Categoria sugerida pelas mesmas palavras-chave do Assistente Financeiro; sem palavra conhecida, fica vazia.
*/

export type ImportSource = 'statement' | 'card'

const CARD_PAYMENT = /\b(pagamento|pgto|pagto)\b/

export function importedToRows(
  txs: ImportedTx[],
  opts: { source: ImportSource; accountId: string; categories: CategoryRef[]; fileName: string },
): BulkRow[] {
  const categories = opts.categories.map((c) => ({ ...c }))
  return txs.map((t) => {
    const description = t.description.slice(0, 140)
    const text = normalize(description).text
    const base = {
      date: isoToBR(t.date),
      description,
      amount: formatAmountBR(t.cents),
      status: 'paid' as const,
      notes: `Importado de ${opts.fileName}`.slice(0, 500),
    }
    if (opts.source === 'card' && t.direction === 'in' && CARD_PAYMENT.test(text)) {
      return emptyRow({ ...base, kind: 'transfer', accountId: '', transferAccountId: opts.accountId })
    }
    const kind = t.direction === 'out' ? 'expense' : 'income'
    const category = matchCategory(text, categories, kind)
    return emptyRow({ ...base, kind, accountId: opts.accountId, categoryId: category?.category.id ?? '' })
  })
}
