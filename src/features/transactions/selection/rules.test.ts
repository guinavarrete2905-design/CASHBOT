import { describe, expect, it } from 'vitest'
import { accountChangeProblem, categoryChange, deleteBlockedCount, rangeIds, selectionTotals, type SelectedTx } from './rules'

const tx = (t: Partial<SelectedTx>): SelectedTx => ({
  id: t.id ?? Math.random().toString(36),
  kind: 'expense',
  amount: 10,
  created_by: 'ana',
  account_id: 'itau',
  transfer_account_id: null,
  series_id: null,
  ...t,
})

describe('ações em massa', () => {
  it('categoria: só receitas ou só despesas, sem transferências', () => {
    expect(categoryChange([tx({}), tx({})])).toEqual({ allowed: true, kind: 'expense' })
    expect(categoryChange([tx({ kind: 'income' })])).toEqual({ allowed: true, kind: 'income' })
    expect(categoryChange([tx({}), tx({ kind: 'income' })]).allowed).toBe(false)
    expect(categoryChange([tx({}), tx({ kind: 'transfer', transfer_account_id: 'cash' })]).allowed).toBe(false)
    expect(categoryChange([]).allowed).toBe(false)
  })
  it('conta: transferência precisa de origem diferente do destino', () => {
    const t = tx({ kind: 'transfer', transfer_account_id: 'cash' })
    expect(accountChangeProblem([tx({}), t], 'nu')).toBeNull()
    expect(accountChangeProblem([t], 'cash')).toContain('Origem e destino')
    expect(accountChangeProblem([t], null)).toContain('conta de origem')
    expect(accountChangeProblem([tx({})], null)).toBeNull()
  })
  it('exclusão: membro só exclui o que lançou', () => {
    const items = [tx({ created_by: 'ana' }), tx({ created_by: 'bruno' }), tx({ created_by: null })]
    expect(deleteBlockedCount(items, 'ana', false)).toBe(2)
    expect(deleteBlockedCount(items, 'ana', true)).toBe(0)
  })
  it('totais em centavos, transferências à parte', () => {
    const s = selectionTotals([tx({ amount: 0.1 }), tx({ amount: 0.2 }), tx({ kind: 'income', amount: 5 }), tx({ kind: 'transfer', amount: 7, series_id: 's' })])
    expect(s).toEqual({ income: 5, expense: 0.3, transfer: 7, inSeries: 1 })
  })
  it('intervalo com Shift', () => {
    expect(rangeIds(['a', 'b', 'c', 'd'], 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(['a', 'b', 'c', 'd'], 'd', 'a')).toEqual(['a', 'b', 'c', 'd'])
    expect(rangeIds(['a', 'b'], 'x', 'b')).toEqual(['b'])
  })
})
