import { describe, expect, it } from 'vitest'
import { netWorth } from './calc'

describe('patrimônio líquido', () => {
  it('soma contas e bens e desconta dívidas e cartões (sem arquivados)', () => {
    // Mesmo cenário do teste no banco (supabase/tests/rls_wealth.sql).
    expect(
      netWorth({
        accounts: [
          { type: 'checking', balance: 1000, archived: false },
          { type: 'credit_card', balance: -300, archived: false },
          { type: 'savings', balance: 999, archived: true },
        ],
        assets: [
          { value: 400000, archived: false },
          { value: 20000, archived: false },
          { value: 50000, archived: true },
        ],
        liabilities: [{ balance: 250000, archived: false }],
      }),
    ).toEqual({ accounts: 1000, assets: 420000, cardDebt: 300, debts: 250000, liabilities: 250300, netWorth: 170700 })
  })

  it('cartão com saldo a favor não vira dívida', () => {
    expect(netWorth({ accounts: [{ type: 'credit_card', balance: 50, archived: false }], assets: [], liabilities: [] }).liabilities).toBe(0)
  })
})
