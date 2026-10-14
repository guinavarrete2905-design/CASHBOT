const cents = (n: number) => Math.round(n * 100)

type AccountLike = { type: string; balance: number; archived: boolean }
type AssetLike = { value: number; archived: boolean }
type LiabilityLike = { balance: number; archived: boolean }

/**
 * Patrimônio líquido = saldo das contas + bens e investimentos − dívidas − valor em aberto nos cartões.
 * Itens arquivados não entram. Mesma regra da função record_net_worth_snapshot no banco.
 */
export function netWorth(input: { accounts: AccountLike[]; assets: AssetLike[]; liabilities: LiabilityLike[] }) {
  let accounts = 0
  let cardDebt = 0
  for (const a of input.accounts) {
    if (a.archived) continue
    if (a.type === 'credit_card') cardDebt += Math.max(0, -cents(a.balance))
    else accounts += cents(a.balance)
  }
  const assets = input.assets.filter((a) => !a.archived).reduce((s, a) => s + cents(a.value), 0)
  const debts = input.liabilities.filter((l) => !l.archived).reduce((s, l) => s + cents(l.balance), 0)
  const liabilities = debts + cardDebt
  return {
    accounts: accounts / 100,
    assets: assets / 100,
    cardDebt: cardDebt / 100,
    debts: debts / 100,
    liabilities: liabilities / 100,
    netWorth: (accounts + assets - liabilities) / 100,
  }
}
