import { describe, expect, it } from 'vitest'
import { normalize } from './normalize'
import {
  extractDescription,
  matchAccount,
  matchCategory,
  mergeRange,
  parseAmounts,
  parseDate,
  parseInstallments,
  parsePeriods,
  splitByAmounts,
  type Span,
} from './parse'

const TODAY = '2026-10-14' // quarta-feira
const t = (s: string) => normalize(s).text

const categories = [
  { id: 'food', name: 'Alimentação', kind: 'expense' as const },
  { id: 'transp', name: 'Transporte', kind: 'expense' as const },
  { id: 'bills', name: 'Contas e serviços', kind: 'expense' as const },
  { id: 'shop', name: 'Compras', kind: 'expense' as const },
  { id: 'pets', name: 'Pets', kind: 'expense' as const },
  { id: 'salary', name: 'Salário', kind: 'income' as const },
]
const accounts = [
  { id: 'nu', name: 'Nubank', type: 'credit_card' },
  { id: 'itau', name: 'Itaú', type: 'checking' },
  { id: 'cash', name: 'Carteira', type: 'wallet' },
]

describe('normalização', () => {
  it('remove acentos, maiúsculas e separa R$ do número', () => {
    expect(t('Quanto GASTEI com Alimentação?')).toBe('quanto gastei com alimentacao')
    expect(t('Gastei R$150,00')).toBe('gastei r$ 150,00')
  })
})

describe('valores', () => {
  const values = (s: string, bare = false) => parseAmounts(t(s), bare).map((a) => a.value)
  it('reconhece formatos brasileiros', () => {
    expect(values('Gastei R$ 150 no supermercado')).toEqual([150])
    expect(values('R$ 1.250,90 de aluguel')).toEqual([1250.9])
    expect(values('recebi 3 mil de salário')).toEqual([3000])
    expect(values('um bônus de 1,5k')).toEqual([1500])
    expect(values('paguei 150 reais')).toEqual([150])
    expect(values('cem reais de gasolina')).toEqual([100])
    expect(values('Recebi R$ 3.000 de salário')).toEqual([3000])
  })
  it('números soltos só quando permitido', () => {
    expect(values('gastei 80 no posto')).toEqual([])
    expect(values('gastei 80 no posto', true)).toEqual([80])
  })
  it('não confunde datas, parcelas e períodos com valores', () => {
    expect(values('comprei um celular de R$ 2.400 em 10 parcelas', true)).toEqual([2400])
    expect(values('gastei 50 no dia 10', true)).toEqual([50])
    expect(values('gastei 50 em 10/09', true)).toEqual([50])
    expect(values('quanto gastei nos últimos 3 meses', true)).toEqual([])
    expect(values('comprei 300 em 3x', true)).toEqual([300])
    expect(values('comprei por 1.200 em 2025', true)).toEqual([1200])
  })
  it('vários valores', () => {
    expect(values('Gastei R$ 80 de combustível e R$ 45 de estacionamento')).toEqual([80, 45])
  })
})

describe('datas', () => {
  const date = (s: string) => {
    const d = parseDate(t(s), TODAY)
    return d && d !== 'invalid' ? d.iso : d
  }
  it('relativas', () => {
    expect(date('gastei ontem')).toBe('2026-10-13')
    expect(date('anteontem')).toBe('2026-10-12')
    expect(date('hoje')).toBe('2026-10-14')
  })
  it('absolutas', () => {
    expect(date('dia 5')).toBe('2026-10-05')
    expect(date('em 10/09')).toBe('2026-09-10')
    expect(date('em 10/09/2025')).toBe('2025-09-10')
    expect(date('5 de setembro')).toBe('2026-09-05')
    expect(date('dia 31/02')).toBe('invalid')
  })
  it('dias da semana (o mais recente)', () => {
    expect(date('na segunda')).toBe('2026-10-12')
    expect(date('sexta passada')).toBe('2026-10-09')
    expect(date('quarta passada')).toBe('2026-10-07')
  })
})

describe('períodos', () => {
  const period = (s: string, prefer: 'past' | 'future' = 'past') => {
    const p = parsePeriods(t(s), TODAY, prefer)[0]
    return p ? { from: p.from, to: p.to, label: p.label } : null
  }
  it('mês atual, passado e por nome', () => {
    expect(period('quanto gastei este mês')).toEqual({ from: '2026-10-01', to: '2026-10-31', label: 'neste mês' })
    expect(period('e no mês passado?')?.from).toBe('2026-09-01')
    expect(period('em setembro')).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
    expect(period('em novembro')?.from).toBe('2025-11-01')
    expect(period('em novembro', 'future')?.from).toBe('2026-11-01')
    expect(period('em março de 2025')?.from).toBe('2025-03-01')
    expect(period('no mês de agosto')?.from).toBe('2026-08-01')
  })
  it('intervalos', () => {
    expect(period('nos últimos 6 meses')).toMatchObject({ from: '2026-05-01', to: '2026-10-31' })
    expect(period('últimos três meses')?.from).toBe('2026-08-01')
    expect(period('últimos 30 dias')).toMatchObject({ from: '2026-09-15', to: '2026-10-14' })
    expect(period('até o fim do mês')).toMatchObject({ from: '2026-10-14', to: '2026-10-31' })
    expect(period('nos próximos 7 dias')).toMatchObject({ from: '2026-10-14', to: '2026-10-21' })
    expect(period('este ano')).toMatchObject({ from: '2026-01-01', to: '2026-10-31' })
    expect(period('ano passado')).toMatchObject({ from: '2025-01-01', to: '2025-12-31' })
    expect(period('esta semana')).toMatchObject({ from: '2026-10-12', to: '2026-10-18' })
  })
  it('dois meses e intervalo entre meses', () => {
    const text = t('compare agosto e setembro')
    expect(parsePeriods(text, TODAY).map((p) => p.month)).toEqual(['2026-08', '2026-09'])
    const range = t('de agosto a outubro')
    expect(mergeRange(range, parsePeriods(range, TODAY))).toMatchObject({ from: '2026-08-01', to: '2026-10-31' })
    expect(mergeRange(text, parsePeriods(text, TODAY))).toBeNull()
  })
})

describe('parcelas', () => {
  it('formatos comuns', () => {
    expect(parseInstallments(t('em 10x'))?.count).toBe(10)
    expect(parseInstallments(t('em 10 parcelas'))?.count).toBe(10)
    expect(parseInstallments(t('parcelado em doze vezes'))?.count).toBe(12)
    expect(parseInstallments(t('3x sem juros'))?.count).toBe(3)
    expect(parseInstallments(t('gastei 50 no mercado'))).toBeNull()
  })
})

describe('categorias', () => {
  const cat = (s: string, kind?: 'expense' | 'income') => matchCategory(t(s), categories, kind)?.category.id ?? null
  it('por palavra-chave', () => {
    expect(cat('Gastei R$ 150 no supermercado')).toBe('food')
    expect(cat('80 de combustível')).toBe('transp')
    expect(cat('estacionamento')).toBe('transp')
    expect(cat('conta de luz')).toBe('bills')
    expect(cat('comprei um celular')).toBe('shop')
    expect(cat('mercado livre')).toBe('shop')
  })
  it('pelo nome, inclusive categorias criadas pelo usuário', () => {
    expect(cat('quanto gastei com alimentação')).toBe('food')
    expect(cat('ração dos pets')).toBe('pets')
    expect(cat('recebi salário', 'income')).toBe('salary')
  })
  it('sem palavra conhecida, sem categoria', () => {
    expect(cat('gastei 30 com fulano')).toBeNull()
  })
})

describe('contas', () => {
  it('pelo nome e por termos genéricos', () => {
    const m = matchAccount(t('paguei no Itaú'), accounts)
    expect(m && 'account' in m ? m.account.id : null).toBe('itau')
    const c = matchAccount(t('no cartão'), accounts)
    expect(c && 'account' in c ? c.account.id : null).toBe('nu')
    const w = matchAccount(t('em dinheiro'), accounts)
    expect(w && 'account' in w ? w.account.id : null).toBe('cash')
  })
  it('ambiguidade quando há mais de um cartão', () => {
    const two = [...accounts, { id: 'inter', name: 'Inter', type: 'credit_card' }]
    const m = matchAccount(t('no cartão'), two)
    expect(m && 'ambiguous' in m ? m.ambiguous.length : 0).toBe(2)
  })
})

describe('descrição', () => {
  function describeOf(s: string) {
    const n = normalize(s)
    const consumed: Span[] = [
      ...parseAmounts(n.text, true),
      ...(parseInstallments(n.text) ? [parseInstallments(n.text)!] : []),
    ]
    const acc = matchAccount(n.text, accounts)
    if (acc) consumed.push(acc)
    const d = parseDate(n.text, TODAY)
    if (d && d !== 'invalid') consumed.push(d)
    return extractDescription(n, consumed)
  }
  it('limpa verbos, valores e preposições', () => {
    expect(describeOf('Gastei R$ 150 no supermercado')).toBe('Supermercado')
    expect(describeOf('Recebi R$ 3.000 de salário')).toBe('Salário')
    expect(describeOf('Comprei um celular de R$ 2.400 em 10 parcelas')).toBe('Celular')
    expect(describeOf('paguei 120 da conta de luz no Itaú ontem')).toBe('Conta de luz')
  })
  it('divide vários itens', () => {
    const n = normalize('Gastei R$ 80 de combustível e R$ 45 de estacionamento')
    const parts = splitByAmounts(n.text, parseAmounts(n.text, true))
    expect(parts.map((p) => n.text.slice(p.start, p.end).trim())).toEqual(['gastei r$ 80 de combustivel', 'e r$ 45 de estacionamento'])
  })
})
