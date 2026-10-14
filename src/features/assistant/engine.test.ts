import { describe, expect, it } from 'vitest'
import { respond } from './engine'
import { EMPTY_CONTEXT, type ConversationContext } from './types'
import { createFakeDataSource } from './testing/fakeData'
import { blocksToText } from './format'
import { REFERENCE } from './testing/reference'

async function chat(messages: string[], ds = createFakeDataSource()) {
  let ctx: ConversationContext = EMPTY_CONTEXT
  const replies = []
  for (const m of messages) {
    const r = await respond(m, ctx, ds)
    ctx = r.ctx
    replies.push(r.reply)
  }
  // Intl usa espaço não separável entre R$ e o número.
  return { replies, ctx, last: replies[replies.length - 1], text: blocksToText(replies[replies.length - 1].blocks).replace(/\u00a0/g, ' ') }
}

describe('consultas com dados reais (fonte de teste)', () => {
  it('total de despesas do mês com variação', async () => {
    const { last, text } = await chat(['Quanto gastei este mês?'])
    expect(last.intent).toBe('expenses_total')
    expect(text).toContain('R$ 2.900,00')
    expect(text).toContain('23,4%')
  })
  it('despesas por categoria com participação', async () => {
    const { text } = await chat(['Quanto gastei com alimentação?'])
    expect(text).toContain('R$ 1.000,00')
    expect(text).toContain('34,5%')
  })
  it('transferências não contam como despesa', async () => {
    const { text } = await chat(['Quanto gastei este mês?'])
    expect(text).not.toContain('3.200')
  })
  it('saldo soma contas e separa cartão', async () => {
    const { text } = await chat(['Qual meu saldo?'])
    expect(text).toContain('R$ 3.350,00')
    expect(text).toContain('R$ 850,00')
  })
  it('contas a pagar inclui as atrasadas', async () => {
    const { text } = await chat(['Quais contas preciso pagar?'])
    expect(text).toContain('R$ 300,00')
    expect(text).toContain('Internet')
  })
  it('sem dados, informa a limitação em vez de inventar', async () => {
    const { text } = await chat(['Quanto gastei este mês?'], createFakeDataSource({ empty: true }))
    expect(text).toContain('não encontrei despesas')
    const balance = await chat(['Qual meu saldo?'], createFakeDataSource({ empty: true }))
    expect(balance.text).toContain('ainda não cadastrou contas')
  })
})

describe('contexto da conversa', () => {
  it('"E em outubro?" reaproveita a pergunta e "Qual a diferença?" compara', async () => {
    const { replies, text } = await chat(['Quanto gastei em setembro?', 'E em outubro?', 'Qual a diferença?'])
    expect(replies[1].intent).toBe('expenses_total')
    expect(blocksToText(replies[1].blocks).replace(/\u00a0/g, ' ')).toContain('R$ 2.900,00')
    expect(text).toContain('R$ 550,00')
    expect(text).toContain('maiores')
  })
  it('sem contexto, pede esclarecimento', async () => {
    const { last } = await chat(['Qual a diferença?'])
    expect(last.intent).toBe('difference')
    expect(blocksToText(last.blocks)).toContain('Diferença entre o quê?')
  })
  it('mantém a categoria ao trocar o período', async () => {
    const { text } = await chat(['Quanto gastei com alimentação em setembro?', 'E em outubro?'])
    expect(text).toContain('alimentação')
    expect(text).toContain('R$ 1.000,00')
  })
})

describe('lançamentos guiados', () => {
  it('prepara a despesa com categoria e conta, sem salvar', async () => {
    const { last } = await chat(['Gastei R$ 150 no supermercado no itaú'])
    expect(last.drafts).toHaveLength(1)
    expect(last.drafts![0]).toMatchObject({ kind: 'expense', amount: 150, description: 'Supermercado', categoryId: 'food', accountId: 'itau', status: 'paid' })
    expect(last.effect).toBeUndefined()
  })
  it('pergunta a conta quando não foi dita', async () => {
    const { last, ctx } = await chat(['Gastei R$ 150 no supermercado'])
    expect(last.drafts).toBeUndefined()
    expect(ctx.awaiting?.slot).toBe('account')
    const after = await respond('Carteira', ctx, createFakeDataSource())
    expect(after.reply.drafts![0].accountId).toBe('cash')
  })
  it('pergunta o valor quando falta', async () => {
    const { ctx } = await chat(['Registre uma despesa'])
    expect(ctx.awaiting?.slot).toBe('amount')
  })
  it('compra parcelada no cartão', async () => {
    const { last } = await chat(['Comprei um celular de R$ 2.400 em 10 parcelas no nubank'])
    expect(last.drafts![0]).toMatchObject({ amount: 2400, series: { kind: 'installment', count: 10 }, onCard: true, description: 'Celular' })
  })
  it('vários itens numa mensagem', async () => {
    const { last } = await chat(['Gastei R$ 80 de combustível e R$ 45 de estacionamento em dinheiro'])
    expect(last.drafts!.map((d) => [d.description, d.amount, d.categoryId])).toEqual([
      ['Combustível', 80, 'transp'],
      ['Estacionamento', 45, 'transp'],
    ])
  })
  it('transferência entre contas', async () => {
    const { last } = await chat(['Transferi 500 do Itaú para a carteira'])
    expect(last.drafts![0]).toMatchObject({ kind: 'transfer', accountId: 'itau', transferAccountId: 'cash', amount: 500 })
  })
  it('data futura vira pendente', async () => {
    const { last } = await chat(['Paguei 120 da conta de luz dia 20 no itaú'])
    expect(last.drafts![0]).toMatchObject({ occurredOn: '2026-10-20', status: 'pending' })
  })
  it('confirmar por texto devolve só os rascunhos mostrados', async () => {
    const { replies } = await chat(['Gastei 40 no mercado na carteira', 'confirmar'])
    const id = replies[0].drafts![0].id
    expect(replies[1].effect).toEqual({ type: 'confirm', draftIds: [id] })
  })
  it('sem rascunho, "confirmar" não faz nada', async () => {
    const { last } = await chat(['confirmar'])
    expect(last.effect).toBeUndefined()
  })
  it('cancelar descarta o rascunho', async () => {
    const { last, ctx } = await chat(['Gastei 40 no mercado na carteira', 'cancelar'])
    expect(last.effect?.type).toBe('cancel')
    expect(ctx.pendingDrafts).toHaveLength(0)
  })
  it('cada rascunho tem identificador próprio (base da proteção contra duplicidade)', async () => {
    const { last } = await chat(['Gastei 80 de combustível e 45 de estacionamento na carteira'])
    const ids = last.drafts!.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('muitos itens vão para o fluxo de lançamento em massa', async () => {
    const { last } = await chat(['gastei 10, 20, 30, 40, 50 e 60 no mercado'])
    expect(last.intent).toBe('bulk_entry')
  })
})

describe('segurança', () => {
  it('não altera permissões', async () => {
    const { last } = await chat(['Torne o João administrador do espaço'])
    expect(last.intent).toBe('permissions')
    expect(last.drafts).toBeUndefined()
    expect(last.effect).toBeUndefined()
  })
  it('texto com SQL é tratado como texto comum', async () => {
    const { last } = await chat(["'; DROP TABLE transactions; --"])
    expect(last.intent).toBe('unknown')
  })
  it('não inventa taxas atuais', async () => {
    const { last, text } = await chat(['Qual a Selic hoje?'])
    expect(last.intent).toBe('current_rates')
    expect(text).not.toMatch(/\d+(,\d+)?%/)
  })
  it('se identifica como Assistente Financeiro, sem IA generativa', async () => {
    const { text } = await chat(['Você é uma IA?'])
    expect(text).toContain('Assistente Financeiro')
    expect(text).toContain('não uso inteligência artificial generativa')
  })
})

describe('cobertura das perguntas de referência', () => {
  it('acerta pelo menos 95% do conjunto', async () => {
    let ok = 0
    for (const c of REFERENCE) {
      const { last } = await chat([...(c.before ?? []), c.q])
      const expected = Array.isArray(c.expect) ? c.expect : [c.expect]
      if (expected.includes(last.intent)) ok++
    }
    expect(ok / REFERENCE.length).toBeGreaterThanOrEqual(0.95)
  })
})
