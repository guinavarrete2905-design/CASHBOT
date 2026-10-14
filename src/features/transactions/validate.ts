import type { TransactionKind, TransactionStatus } from './summary'

/*
  Regras de validação de uma movimentação, usadas pelo formulário e pelo Assistente Financeiro.
  Mantê-las num só lugar garante que os dois caminhos aceitem e recusem exatamente as mesmas coisas.
*/

export const DESCRIPTION_MAX = 140
export const AMOUNT_MAX = 999_999_999_999

export type TransactionFields = {
  kind: TransactionKind
  amount: number | null
  description: string
  occurredOn: string
  accountId: string | null
  transferAccountId: string | null
}

/** Devolve a mensagem de erro em português, ou null quando está tudo certo. */
export function validateTransaction(v: TransactionFields): string | null {
  if (v.amount === null || !Number.isFinite(v.amount) || v.amount <= 0) {
    return 'Informe um valor maior que zero. Ex.: 1.250,90'
  }
  if (v.amount > AMOUNT_MAX) return 'O valor é grande demais.'
  const description = v.description.trim()
  if (!description) return 'Informe uma descrição.'
  if (description.length > DESCRIPTION_MAX) return `A descrição pode ter até ${DESCRIPTION_MAX} caracteres.`
  if (!v.occurredOn || !/^\d{4}-\d{2}-\d{2}$/.test(v.occurredOn)) return 'Informe a data.'
  if (v.kind === 'transfer') {
    if (!v.accountId || !v.transferAccountId) return 'Escolha a conta de origem e a de destino.'
    if (v.accountId === v.transferAccountId) return 'A conta de origem e a de destino precisam ser diferentes.'
  }
  return null
}

/** Compras no cartão entram na fatura; a situação de pagamento é a da fatura. */
export function effectiveStatus(kind: TransactionKind, onCard: boolean, status: TransactionStatus): TransactionStatus {
  return kind !== 'transfer' && onCard ? 'paid' : status
}

/** Em séries, as próximas ficam pendentes, exceto no cartão (entram nas faturas futuras). */
export function seriesFuturePending(kind: TransactionKind, onCard: boolean): boolean {
  return !(kind !== 'transfer' && onCard)
}

/** Limites de repetição oferecidos no formulário (parcelado: 2 a 48; todo mês: 2 a 60). */
export const SERIES_LIMITS = { installment: { min: 2, max: 48 }, recurring: { min: 2, max: 60 } } as const

/** Parcelado não vale para transferência (mesma regra do formulário e do banco). */
export function seriesAllowed(kind: TransactionKind, series: 'installment' | 'recurring'): boolean {
  return !(kind === 'transfer' && series === 'installment')
}
