import { describe, expect, it } from 'vitest'
import { buildSeries } from '../series'
import {
  applyPaste,
  buildBatch,
  emptyRow,
  evaluateRow,
  findDuplicates,
  parseAmountBR,
  parseDateBR,
  splitPaste,
  summarize,
  type BulkContext,
  type BulkRow,
} from './model'

const ctx: BulkContext = {
  today: '2026-10-14',
  accounts: [
    { id: 'itau', name: 'Itaú', type: 'checking', archived: false },
    { id: 'cash', name: 'Carteira', type: 'wallet', archived: false },
    { id: 'nu', name: 'Nubank', type: 'credit_card', archived: false },
    { id: 'old', name: 'Conta antiga', type: 'checking', archived: true },
  ],
  categories: [
    { id: 'food', name: 'Alimentação', kind: 'expense', archived: false },
    { id: 'transp', name: 'Transporte', kind: 'expense', archived: false },
    { id: 'gone', name: 'Antiga', kind: 'expense', archived: true },
    { id: 'salary', name: 'Salário', kind: 'income', archived: false },
  ],
}

const row = (r: Partial<BulkRow>) => emptyRow({ date: '05/10/2026', description: 'Mercado', amount: '100,00', ...r })
const ids = () => {
  let n = 0
  return () => `s${++n}`
}

describe('datas e valores', () => {
  it('datas no formato DD/MM/AAAA, sem trocar dia e mês', () => {
    expect(parseDateBR('05/10/2026')).toEqual({ iso: '2026-10-05' })
    expect(parseDateBR('5/1/2026')).toEqual({ iso: '2026-01-05' })
    expect(parseDateBR('2026-10-05')).toEqual({ iso: '2026-10-05' })
    expect(parseDateBR('31/02/2026')).toEqual({ error: 'Data inexistente.' })
    expect(parseDateBR('13/13/2026')).toEqual({ error: 'Data inexistente.' })
    expect(parseDateBR('10-05-2026')).toEqual({ error: 'Use o formato DD/MM/AAAA.' })
    expect(parseDateBR('')).toBeNull()
  })
  it('valores em centavos, formato brasileiro', () => {
    expect(parseAmountBR('1.250,90')).toEqual({ cents: 125090 })
    expect(parseAmountBR('R$ 1.250,90')).toEqual({ cents: 125090 })
    expect(parseAmountBR('1250,9')).toEqual({ cents: 125090 })
    expect(parseAmountBR('1250')).toEqual({ cents: 125000 })
    expect(parseAmountBR('1250.90')).toEqual({ cents: 125090 })
    expect(parseAmountBR('1,250.90')).toEqual({ cents: 125090 })
    expect(parseAmountBR('1.234.567,89')).toEqual({ cents: 123456789 })
    expect(parseAmountBR('0,10')).toEqual({ cents: 10 })
  })
  it('valores ambíguos ou inválidos viram erro, não palpite', () => {
    expect('error' in (parseAmountBR('1.234') ?? {})).toBe(true)
    expect('error' in (parseAmountBR('1,234') ?? {})).toBe(true)
    expect('error' in (parseAmountBR('-10') ?? {})).toBe(true)
    expect('error' in (parseAmountBR('abc') ?? {})).toBe(true)
    expect('error' in (parseAmountBR('10,999') ?? {})).toBe(true)
  })
})

describe('validação das linhas', () => {
  it('receita, despesa e transferência válidas', () => {
    expect(evaluateRow(row({ kind: 'income', description: 'Salário', categoryId: 'salary', accountId: 'itau' }), ctx).state).toBe('valid')
    expect(evaluateRow(row({ categoryId: 'food', accountId: 'cash' }), ctx).state).toBe('valid')
    expect(evaluateRow(row({ kind: 'transfer', description: 'Saque', accountId: 'itau', transferAccountId: 'cash' }), ctx).state).toBe('valid')
  })
  it('linha em branco é ignorada; faltando dados é incompleta', () => {
    expect(evaluateRow(emptyRow({ date: '05/10/2026' }), ctx).state).toBe('empty')
    const ev = evaluateRow(row({ amount: '' }), ctx)
    expect(ev.state).toBe('incomplete')
    expect(ev.errors.amount).toBe('Informe o valor.')
  })
  it('erros específicos por célula', () => {
    expect(evaluateRow(row({ amount: '0' }), ctx).errors.amount).toBe('O valor deve ser maior que zero.')
    expect(evaluateRow(row({ date: '31/04/2026' }), ctx).errors.date).toBe('Data inexistente.')
    expect(evaluateRow(row({ categoryId: 'salary' }), ctx).errors.category).toContain('categoria de receita')
    expect(evaluateRow(row({ categoryId: 'gone' }), ctx).errors.category).toContain('arquivada')
    expect(evaluateRow(row({ accountId: 'old' }), ctx).errors.account).toContain('arquivada')
    expect(evaluateRow(row({ accountId: 'outro-espaco' }), ctx).errors.account).toContain('não encontrada')
  })
  it('transferência inválida', () => {
    const same = evaluateRow(row({ kind: 'transfer', accountId: 'itau', transferAccountId: 'itau' }), ctx)
    expect(same.state).toBe('error')
    expect(same.errors.transferAccount).toBe('A conta de origem e a de destino precisam ser diferentes.')
    expect(evaluateRow(row({ kind: 'transfer', accountId: 'itau' }), ctx).errors.transferAccount).toBe('Escolha a conta de destino.')
    expect(evaluateRow(row({ kind: 'transfer', accountId: 'itau', transferAccountId: 'cash', repeat: 'installment', count: '3' }), ctx).errors.repeat).toContain('não pode ser parcelada')
  })
  it('parcelas e meses dentro dos limites do formulário', () => {
    expect(evaluateRow(row({ repeat: 'installment', count: '1' }), ctx).errors.count).toBe('Parcelas: de 2 a 48.')
    expect(evaluateRow(row({ repeat: 'installment', count: '49' }), ctx).state).toBe('error')
    expect(evaluateRow(row({ repeat: 'recurring', count: '60' }), ctx).state).toBe('valid')
    expect(evaluateRow(row({ repeat: 'recurring', count: '' }), ctx).state).toBe('incomplete')
  })
  it('no cartão a situação é a da fatura (como no formulário)', () => {
    expect(evaluateRow(row({ accountId: 'nu', status: 'pending' }), ctx).parsed?.status).toBe('paid')
  })
})

describe('resumo', () => {
  it('separa transferências e conta só linhas válidas', () => {
    const rows = [
      row({ kind: 'income', description: 'Salário', amount: '8.500,00' }),
      row({ amount: '3.200,00' }),
      row({ kind: 'transfer', description: 'Poupança', amount: '1.000,00', accountId: 'itau', transferAccountId: 'cash' }),
      row({ amount: '' }),
      row({ amount: 'abc' }),
      emptyRow(),
    ]
    const s = summarize(rows, ctx)
    expect(s).toMatchObject({ valid: 3, incomplete: 1, errors: 1, income: 8500, expense: 3200, result: 5300, transfer: 1000 })
  })
  it('diferencia valor informado e movimentações geradas', () => {
    const s = summarize([row({ amount: '1.200,00', repeat: 'installment', count: '6' }), row({ description: 'Academia', amount: '100,00', repeat: 'recurring', count: '12' })], ctx)
    expect(s.expense).toBe(1300)
    expect(s.generatedExpense).toBe(2400)
    expect(s.generated).toBe(18)
    expect(s.futureInstallments).toBe(5)
    expect(s.futureRecurrences).toBe(11)
  })
})

describe('lote para gravação', () => {
  it('várias linhas com contas e categorias diferentes', () => {
    const batch = buildBatch(
      [
        row({ categoryId: 'food', accountId: 'cash' }),
        row({ description: 'Uber', amount: '25,50', categoryId: 'transp', accountId: 'itau' }),
        row({ kind: 'income', description: 'Salário', amount: '5.000,00', categoryId: 'salary', accountId: 'itau' }),
      ],
      ctx,
      ids(),
    )
    expect(batch.map((b) => [b.description, b.amount, b.category_id, b.account_id, b.ref])).toEqual([
      ['Mercado', 100, 'food', 'cash', '1'],
      ['Uber', 25.5, 'transp', 'itau', '2'],
      ['Salário', 5000, 'salary', 'itau', '3'],
    ])
  })
  it('transferência sem categoria, com destino', () => {
    const [t] = buildBatch([row({ kind: 'transfer', categoryId: 'food', accountId: 'itau', transferAccountId: 'cash' })], ctx, ids())
    expect(t).toMatchObject({ kind: 'transfer', category_id: null, account_id: 'itau', transfer_account_id: 'cash' })
  })
  it('parcelamento igual ao do formulário (centavos distribuídos, futuras pendentes)', () => {
    const batch = buildBatch([row({ amount: '1.000,00', repeat: 'installment', count: '3', accountId: 'itau', date: '10/10/2026' })], ctx, ids())
    const expected = buildSeries({ kind: 'installment', amount: 1000, count: 3, start: '2026-10-10', status: 'paid', futurePending: true, today: ctx.today })
    expect(batch.map((b) => [b.amount, b.occurred_on, b.status])).toEqual(expected.map((e) => [e.amount, e.occurredOn, e.status]))
    expect(batch.map((b) => b.amount)).toEqual([333.34, 333.33, 333.33])
    expect(new Set(batch.map((b) => b.series_id)).size).toBe(1)
    expect(batch.map((b) => b.ref)).toEqual(['1:1', '1:2', '1:3'])
  })
  it('parcelas no cartão ficam todas como pagas (entram nas faturas)', () => {
    const batch = buildBatch([row({ amount: '300', repeat: 'installment', count: '3', accountId: 'nu' })], ctx, ids())
    expect(batch.every((b) => b.status === 'paid')).toBe(true)
  })
  it('recorrência mensal repete o valor', () => {
    const batch = buildBatch([row({ description: 'Academia', amount: '99,90', repeat: 'recurring', count: '3', date: '31/01/2027' })], ctx, ids())
    expect(batch.map((b) => [b.amount, b.occurred_on, b.series_kind])).toEqual([
      [99.9, '2027-01-31', 'recurring'],
      [99.9, '2027-02-28', 'recurring'],
      [99.9, '2027-03-31', 'recurring'],
    ])
  })
  it('linhas inválidas ou vazias não entram no lote', () => {
    expect(buildBatch([row({ amount: '' }), emptyRow(), row({ amount: '1.234' })], ctx, ids())).toHaveLength(0)
  })
})

describe('possíveis duplicados', () => {
  it('na própria planilha e já gravados', () => {
    const rows = [row({ accountId: 'itau' }), row({ accountId: 'itau', description: ' mercado ' }), row({ accountId: 'cash' })]
    const hints = findDuplicates(rows, ctx, [{ occurred_on: '2026-10-05', amount: 100, description: 'Mercado', account_id: 'cash' }])
    expect(hints).toEqual([
      { rowIndex: 1, kind: 'sheet', withRow: 0 },
      { rowIndex: 2, kind: 'existing' },
    ])
  })
})

describe('colar de uma planilha', () => {
  it('distribui as colunas e cria linhas', () => {
    const grid = splitPaste('Data\tTipo\tDescrição\tValor\tConta\tCategoria\n05/10/2026\tDespesa\tMercado\t1.250,90\tItaú\tAlimentação\n06/10/2026\tReceita\tSalário\t5000\titau\tsalário\n')!
    expect(grid).toHaveLength(2)
    const { rows } = applyPaste([emptyRow()], 0, 'date', grid, ctx)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '05/10/2026', kind: 'expense', amount: '1.250,90', accountId: 'itau', categoryId: 'food' })
    expect(rows[1]).toMatchObject({ kind: 'income', amount: '5.000,00', accountId: 'itau', categoryId: 'salary' })
    expect(evaluateRow(rows[1], ctx).state).toBe('valid')
  })
  it('transferência: coluna de categoria vira conta de destino', () => {
    const { rows } = applyPaste([emptyRow()], 0, 'date', splitPaste('07/10/2026\tTransferência\tSaque\t300\tItaú\tCarteira')!, ctx)
    expect(rows[0]).toMatchObject({ kind: 'transfer', accountId: 'itau', transferAccountId: 'cash', categoryId: '' })
  })
  it('não interpreta em silêncio o que não reconhece', () => {
    const { rows } = applyPaste([emptyRow()], 0, 'date', splitPaste('07/10/2026\tDoação\tX\t1.234\tBanco Z\tPets')!, ctx)
    const ev = evaluateRow(rows[0], ctx)
    expect(ev.state).toBe('error')
    expect(ev.errors.kind).toContain('Doação')
    expect(ev.errors.amount).toContain('ambíguo')
    expect(ev.errors.account).toContain('Banco Z')
    expect(ev.errors.category).toContain('Pets')
  })
  it('colar a partir de uma coluna do meio', () => {
    const { rows } = applyPaste([row({}), row({})], 0, 'amount', splitPaste('10,00\n20,00')!, ctx)
    expect(rows.map((r) => r.amount)).toEqual(['10,00', '20,00'])
  })
  it('texto simples usa a colagem normal do campo', () => {
    expect(splitPaste('Mercado')).toBeNull()
  })
  it('repetição colada', () => {
    const { rows } = applyPaste([emptyRow()], 0, 'date', splitPaste('05/10/2026\tDespesa\tTV\t3.000,00\tNubank\t\tPaga\t10x')!, ctx)
    expect(rows[0]).toMatchObject({ repeat: 'installment', count: '10' })
  })
})
