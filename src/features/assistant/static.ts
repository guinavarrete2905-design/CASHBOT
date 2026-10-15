import { compoundInterest, formatMonths, formatPct, percentOf, periodsToReach, priceInstallment, savingPerPeriod, simpleInterest, variationPct } from './calc'
import { cap, LINKS, list, money, note, text } from './format'
import { CATEGORY_LABEL, articleMeta, loadArticle, searchArticles } from './knowledge/index'
import { REF } from './knowledge/refs'
import type { Entities, Handler, HandlerResult } from './engine'
import type { Block, IntentId, Link } from './types'

/*
  Respostas que não dependem de consulta ao banco: conversa, base de conhecimento, calculadoras,
  orientações de segurança e redirecionamentos. Também a comparação com o contexto ("Qual a diferença?").
*/

export const STARTER_SUGGESTIONS = [
  'Quanto gastei este mês?',
  'Qual meu saldo?',
  'Quais contas preciso pagar?',
  'Qual categoria teve mais despesas?',
  'Gastei R$ 50 no mercado',
  'O que é reserva de emergência?',
]

const reply = (intent: IntentId, blocks: Block[], extra: Partial<HandlerResult['reply']> = {}): HandlerResult => ({
  reply: { intent, blocks, ...extra },
})

const greeting: Handler = async (_e, _ctx, ds) =>
  reply('greeting', [text(`Olá! Sou o Assistente Financeiro do CashBot. Estou consultando o espaço **${ds.space.name}**. Como posso ajudar?`)], {
    suggestions: STARTER_SUGGESTIONS.slice(0, 4),
  })

const thanks: Handler = async () => reply('thanks', [text('Por nada! Se precisar de mais alguma coisa, é só perguntar.')], { suggestions: ['Quanto gastei este mês?'] })

const help: Handler = async () =>
  reply(
    'help',
    [
      text('Eu consulto os dados do espaço atual, registro movimentações (sempre com sua confirmação) e explico conceitos de finanças. Alguns exemplos:'),
      list([
        '**Consultas:** "Quanto gastei em setembro?", "Qual meu saldo?", "Quanto está a fatura do cartão?", "Como está meu orçamento?"',
        '**Comparações:** "Compare meus gastos com o mês passado", "Gastos nos últimos 6 meses"',
        '**Lançamentos:** "Gastei R$ 150 no supermercado", "Recebi 3 mil de salário", "Comprei um celular de 2.400 em 10x"',
        '**Planejamento:** "Como estão minhas metas?", "Quanto deveria ter de reserva?"',
        '**Cálculos:** "Quanto rende 1000 a 1% ao mês por 12 meses?", "Quanto é 15% de 200?"',
        '**Conceitos:** "O que é CDB?", "Como sair das dívidas?"',
      ]),
      note('Funciono por regras e consultas aos seus dados — não uso inteligência artificial generativa. Se eu não entender, reformule com palavras simples.'),
    ],
    { suggestions: STARTER_SUGGESTIONS },
  )

const identity: Handler = async () =>
  reply('identity', [
    text('Sou o **Assistente Financeiro** do CashBot. Funciono com regras de interpretação, consultas aos seus dados e uma base de conhecimento própria — não uso inteligência artificial generativa nem envio suas mensagens para serviços externos.'),
    text('Por isso respondo melhor a perguntas diretas sobre suas finanças, cálculos e conceitos financeiros.'),
  ], { suggestions: STARTER_SUGGESTIONS.slice(0, 3) })

// ---------------------------------------------------------------------------
// Base de conhecimento
// ---------------------------------------------------------------------------

const knowledge: Handler = async (e) => {
  const found = searchArticles(e.n.original, 3)
  if (!found.length) return unknown(e, {} as never, {} as never)
  const article = await loadArticle(found[0].id)
  if (!article) return unknown(e, {} as never, {} as never)
  const blocks: Block[] = [text(`**${article.title}**`), text(article.summary), ...article.details.map(text)]
  if (article.examples.length) blocks.push(list(article.examples))
  if (article.needsUpdate) blocks.push(note(`⚠️ Depende de atualização: ${article.needsUpdate}`))
  blocks.push(note(`${CATEGORY_LABEL[article.category]} · revisado em ${article.reviewedAt.split('-').reverse().join('/')} · conteúdo educativo, não é recomendação individual.`))
  const links: Link[] = article.references.map((r) => ({ label: r.label, to: r.url }))
  const related = [...found.slice(1).map((f) => f.id), ...article.related]
    .filter((id, i, arr) => id !== article.id && arr.indexOf(id) === i)
    .slice(0, 3)
    .map((id) => articleMeta(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
  return reply('knowledge', blocks, {
    links,
    suggestions: article.relatedQuestions.slice(0, 3),
    choices: related.map((m) => ({ label: m.title, message: `O que é ${m.title.toLowerCase()}?` })),
  })
}

// ---------------------------------------------------------------------------
// Fora do escopo, segurança e redirecionamentos
// ---------------------------------------------------------------------------

const currentRates: Handler = async () =>
  reply(
    'current_rates',
    [
      text('Não tenho acesso a taxas, índices ou cotações atuais (Selic, CDI, IPCA, dólar...), e não vou chutar um número.'),
      text('Consulte os valores oficiais nas fontes abaixo. Se quiser, explico o que cada indicador significa ou faço uma simulação com a taxa que você informar.'),
    ],
    {
      links: [{ label: 'Banco Central', to: 'https://www.bcb.gov.br' }, REF.ibge, REF.tesouro].map((r) => ('to' in r ? r : { label: r.label, to: r.url })),
      suggestions: ['O que é inflação?', 'Quanto rende 1000 a 1% ao mês por 12 meses?'],
    },
  )

const taxLegal: Handler = async () =>
  reply(
    'tax_legal',
    [
      text('Não dou orientação tributária nem jurídica: as regras mudam e dependem da situação de cada pessoa.'),
      text('Para imposto de renda e tributos, consulte a Receita Federal ou um contador. Posso ajudar a levantar seus dados no CashBot (receitas, despesas por categoria, patrimônio) para facilitar.'),
    ],
    { links: [{ label: REF.receita.label, to: REF.receita.url }], suggestions: ['Quanto recebi neste ano?', 'Qual meu patrimônio líquido?'] },
  )

const investmentAdvice: Handler = async () =>
  reply(
    'investment_advice',
    [
      text('Não faço recomendação individual de investimento — ela depende do seu perfil, prazo e objetivos, e deve vir de um profissional habilitado.'),
      text('Posso explicar os conceitos que ajudam na decisão: reserva de emergência primeiro, liquidez, risco, diversificação e como comparar rentabilidades.'),
    ],
    {
      choices: [
        { label: 'Reserva de emergência', message: 'O que é reserva de emergência?' },
        { label: 'Risco e perfil', message: 'O que é risco nos investimentos?' },
        { label: 'Renda fixa', message: 'O que é renda fixa?' },
      ],
      links: [{ label: REF.cvm.label, to: REF.cvm.url }],
    },
  )

const permissions: Handler = async () =>
  reply(
    'permissions',
    [
      text('Por segurança, eu não altero membros, papéis ou permissões dos espaços.'),
      text('O proprietário ou um administrador do espaço pode fazer isso em Configurações › Espaços.'),
    ],
    { links: [LINKS.spaces] },
  )

const editDelete: Handler = async () =>
  reply(
    'edit_delete',
    [
      text('Eu não edito nem excluo movimentações pelo chat. Assim nada é alterado por engano.'),
      text('Em Movimentações, toque no lançamento para editar ou excluir (inclusive parcelas de uma série).'),
    ],
    { links: [LINKS.transactions] },
  )

const bulkEntry: Handler = async () =>
  reply(
    'bulk_entry',
    [
      text('Para muitos lançamentos de uma vez, o melhor caminho é um formulário estruturado — interpretar listas longas pelo chat seria pouco confiável.'),
      text('Use o **Lançamento em massa**, em Movimentações:'),
      list([
        'Uma planilha para preencher várias movimentações de uma vez (dá para colar do Excel ou Google Planilhas).',
        '"Importar arquivo" lê extrato do banco ou fatura do cartão em **CSV, OFX ou XLSX**; você revisa antes de salvar.',
        'Aqui no chat, até 5 itens numa mensagem: "Gastei 80 de combustível e 45 de estacionamento".',
      ]),
    ],
    { links: [LINKS.transactions], suggestions: ['Gastei 80 de combustível e 45 de estacionamento'] },
  )

const NAV_TARGETS: Array<{ re: RegExp; link: Link }> = [
  { re: /movimentac/, link: LINKS.transactions },
  { re: /\b(contas|cartoes|cartao)\b/, link: LINKS.accounts },
  { re: /planejamento|orcamento|metas/, link: LINKS.planning },
  { re: /patrimonio/, link: LINKS.wealth },
  { re: /relatorio/, link: LINKS.reports },
  { re: /categorias/, link: LINKS.categories },
  { re: /espacos/, link: LINKS.spaces },
  { re: /perfil/, link: { label: 'Perfil', to: '/configuracoes/perfil' } },
  { re: /configurac|ajustes/, link: { label: 'Configurações', to: '/configuracoes' } },
  { re: /inicio|dashboard|painel/, link: { label: 'Início', to: '/' } },
]

const navigate: Handler = async (e) => {
  const target = NAV_TARGETS.find((n) => n.re.test(e.t))
  if (!target) return unknown(e, {} as never, {} as never)
  return reply('navigate', [text(`É só tocar abaixo para abrir **${target.link.label}**.`)], { links: [target.link] })
}

const clearHistory: Handler = async () => ({
  reply: {
    intent: 'clear_history',
    blocks: [text('Quer mesmo apagar todo o histórico desta conversa neste espaço? Isso não afeta suas movimentações.')],
    choices: [
      { label: 'Sim, apagar histórico', message: 'sim' },
      { label: 'Não', message: 'não' },
    ],
  },
  awaiting: { slot: 'clear-history', drafts: [] },
})

// ---------------------------------------------------------------------------
// Contexto: diferença entre os dois últimos resultados
// ---------------------------------------------------------------------------

const difference: Handler = async (_e, ctx) => {
  const a = ctx.previous
  const b = ctx.last
  if (!a || !b) {
    return reply('difference', [text('Diferença entre o quê? Pergunte dois valores primeiro — por exemplo, "Quanto gastei em setembro?" e depois "E em outubro?".')], {
      suggestions: ['Compare meus gastos com o mês passado'],
    })
  }
  if (a.metric !== b.metric) {
    return reply('difference', [text('Os dois últimos valores medem coisas diferentes, então não dá para comparar diretamente. Quer comparar despesas ou receitas?')], {
      choices: [
        { label: 'Despesas', message: 'Compare meus gastos com o mês passado' },
        { label: 'Receitas', message: 'Compare minhas receitas com o mês passado' },
      ],
    })
  }
  const diff = Math.round(b.value * 100 - a.value * 100) / 100
  const v = variationPct(a.value, b.value)
  const what = b.metric === 'expense' ? 'despesas' : b.metric === 'income' ? 'receitas' : 'resultado'
  const filter = b.categoryName ? ` com ${b.categoryName.toLowerCase()}` : ''
  const subject = what === 'resultado' ? 'o resultado foi' : `as ${what}${filter} foram`
  const word = diff > 0 ? (what === 'resultado' ? 'maior' : 'maiores') : what === 'resultado' ? 'menor' : 'menores'
  const sentence =
    diff === 0
      ? `Os dois valores são iguais: ${money(b.value)}.`
      : `${cap(b.period.label)}, ${subject} **${money(Math.abs(diff))} ${word}** do que ${a.period.label}${v !== null ? ` (${diff > 0 ? '+' : '−'}${formatPct(Math.abs(v))})` : ''}.`
  return {
    reply: {
      intent: 'difference',
      blocks: [
        text(sentence),
        { type: 'facts', items: [{ label: cap(a.period.label), value: money(a.value) }, { label: cap(b.period.label), value: money(b.value) }] },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Calculadoras
// ---------------------------------------------------------------------------

type RateInfo = { monthly: number; label: string }

/** Taxa informada, convertida para ao mês quando vier ao ano. */
function rateOf(e: Entities, compound: boolean): RateInfo | null {
  const p = e.percents[0]
  if (!p) return null
  const after = e.t.slice(p.end, p.end + 20)
  const yearly = /^\s*(ao ano|a a\b|aa\b|anual|por ano)/.test(after)
  if (!yearly) return { monthly: p.value, label: `${formatPct(p.value, 4)} ao mês` }
  const monthly = compound ? ((1 + p.value / 100) ** (1 / 12) - 1) * 100 : p.value / 12
  return { monthly, label: `${formatPct(p.value, 4)} ao ano (≈ ${formatPct(monthly, 4)} ao mês)` }
}

function missing(intent: IntentId, what: string, example: string): HandlerResult {
  return reply(intent, [text(`Para calcular, preciso de ${what}.`), note(`Exemplo: "${example}"`)])
}

const calcPercentage: Handler = async (e) => {
  const p = e.percents[0]
  const v = e.amounts.find((a) => a.start > (p?.end ?? 0)) ?? e.amounts[0]
  if (!p || !v) return missing('calc_percentage', 'um percentual e um valor', 'Quanto é 15% de 200?')
  return reply('calc_percentage', [text(`${formatPct(p.value, 4)} de ${money(v.value)} é **${money(percentOf(p.value, v.value))}**.`)])
}

const calcInterest = (kind: 'simple' | 'compound'): Handler => async (e) => {
  const intent: IntentId = kind === 'simple' ? 'calc_simple' : 'calc_compound'
  const rate = rateOf(e, kind === 'compound')
  const principal = e.amounts[0]
  const months = e.duration?.months
  if (!rate || !principal || !months) {
    return missing(intent, 'valor, taxa e prazo', kind === 'simple' ? 'Juros simples de 1000 a 2% ao mês por 6 meses' : 'Quanto rende 1000 a 1% ao mês por 12 meses?')
  }
  // Aporte mensal: segundo valor seguido de "por mês" / "todo mês".
  const deposit = kind === 'compound' ? e.amounts.slice(1).find((a) => /^\s*(por mes|todo mes|mensal|ao mes)/.test(e.t.slice(a.end, a.end + 12)) || /(aport\w*|deposit\w*|guard\w*|invest\w*)\s*$/.test(e.t.slice(Math.max(0, a.start - 14), a.start))) : undefined
  if (kind === 'simple') {
    const r = simpleInterest(principal.value, rate.monthly, months)
    return reply(intent, [
      text(`Com juros simples, ${money(principal.value)} a ${rate.label} por ${formatMonths(months)} geram **${money(r.interest)}** de juros, totalizando **${money(r.total)}**.`),
      note('Cálculo sem impostos, taxas ou inflação.'),
    ])
  }
  const r = compoundInterest(principal.value, rate.monthly, months, deposit?.value ?? 0)
  return reply(intent, [
    text(
      `Com juros compostos, ${money(principal.value)}${deposit ? ` mais ${money(deposit.value)} por mês` : ''} a ${rate.label} por ${formatMonths(months)} chegam a **${money(r.total)}**.`,
    ),
    { type: 'facts', items: [{ label: 'Total investido', value: money(r.invested) }, { label: 'Juros', value: money(r.interest), tone: 'positive' }, { label: 'Montante final', value: money(r.total) }] },
    note('Simulação com taxa constante, sem impostos, taxas ou inflação. Rentabilidade real pode ser diferente.'),
  ], { suggestions: ['O que são juros compostos?', 'O que é rentabilidade?'] })
}

const calcInstallment: Handler = async (e) => {
  const rate = rateOf(e, true)
  const principal = e.amounts[0]
  const months = e.duration?.months ?? (e.installments && e.installments.count >= 2 ? e.installments.count : undefined)
  if (!rate || !principal || !months) return missing('calc_installment', 'valor, taxa e número de parcelas', 'Quanto fica a parcela de 30 mil a 1,5% ao mês em 48 meses?')
  const r = priceInstallment(principal.value, rate.monthly, months)
  return reply('calc_installment', [
    text(`Pela tabela Price, ${money(principal.value)} a ${rate.label} em ${months} parcelas dá **${money(r.payment)} por mês**.`),
    { type: 'facts', items: [{ label: 'Total pago', value: money(r.total) }, { label: 'Juros no período', value: money(r.interest), tone: 'negative' }] },
    note('Simulação sem tarifas, seguros e impostos. Para comparar ofertas reais, use o CET informado pela instituição.'),
  ], { suggestions: ['O que é CET?', 'O que é amortização?'] })
}

const calcSavingPlan: Handler = async (e) => {
  const target = e.amounts[0]
  let months = e.duration?.months
  if (!months && e.period) {
    const [ty, tm] = e.today.split('-').map(Number)
    const [py, pm] = e.period.to.split('-').map(Number)
    months = Math.max(0, py * 12 + pm - (ty * 12 + tm) + 1)
  }
  if (!target || !months) return missing('calc_saving_plan', 'o valor e o prazo', 'Quanto preciso guardar por mês para juntar 10 mil em 12 meses?')
  const rate = e.percents.length ? rateOf(e, true) : null
  const per = savingPerPeriod(target.value, months, rate?.monthly ?? 0)
  if (per === null) return missing('calc_saving_plan', 'um prazo futuro', 'Quanto preciso guardar por mês para juntar 10 mil até dezembro?')
  return reply('calc_saving_plan', [
    text(`Para juntar ${money(target.value)} em ${formatMonths(months)}, guarde **${money(per)} por mês**${rate ? ` (com rendimento de ${rate.label})` : ''}.`),
    ...(rate ? [] : [note('Cálculo sem considerar rendimentos.')]),
  ], { suggestions: ['Como estão minhas metas?', 'O que é reserva de emergência?'] })
}

const calcGoalTime: Handler = async (e) => {
  const [target, deposit] = e.amounts
  if (!target || !deposit) return missing('calc_goal_time', 'o valor da meta e quanto você vai guardar por mês', 'Em quanto tempo junto 10 mil guardando 500 por mês?')
  const rate = e.percents.length ? rateOf(e, true) : null
  const n = periodsToReach(target.value, deposit.value, 0, rate?.monthly ?? 0)
  if (n === null) return reply('calc_goal_time', [text('Com esses valores, a meta não é alcançada em um prazo razoável.')])
  return reply('calc_goal_time', [
    text(`Guardando ${money(deposit.value)} por mês, você junta ${money(target.value)} em **${formatMonths(n)}**${rate ? ` (com rendimento de ${rate.label})` : ''}.`),
    ...(rate ? [] : [note('Cálculo sem considerar rendimentos.')]),
  ])
}

// ---------------------------------------------------------------------------
// Confirmação e cancelamento por texto
// ---------------------------------------------------------------------------

const confirm: Handler = async (_e, ctx) => {
  if (!ctx.pendingDrafts.length) return reply('confirm', [text('Não há nenhum lançamento aguardando confirmação.')], { suggestions: ['Gastei R$ 50 no mercado'] })
  return {
    reply: { intent: 'confirm', blocks: [], effect: { type: 'confirm', draftIds: ctx.pendingDrafts.map((d) => d.id) } },
    pendingDrafts: [],
  }
}

const cancel: Handler = async (_e, ctx) => {
  if (!ctx.pendingDrafts.length) return reply('cancel', [text('Tudo bem. Nada foi alterado.')])
  return {
    reply: { intent: 'cancel', blocks: [text('Lançamento cancelado. Nada foi registrado.')], effect: { type: 'cancel', draftIds: ctx.pendingDrafts.map((d) => d.id) } },
    pendingDrafts: [],
  }
}

// ---------------------------------------------------------------------------
// Não entendi
// ---------------------------------------------------------------------------

const unknown: Handler = async (e) => {
  const blocks: Block[] = [text('Não entendi bem o que você precisa.')]
  const suggestions: string[] = []
  if (e.amounts?.length) {
    const v = money(e.amounts[0].value)
    blocks.push(text(`Vi o valor ${v}. Você quer registrar uma despesa ou uma receita?`))
    return reply('unknown', blocks, {
      choices: [
        { label: 'Despesa', message: `Registrar despesa de ${v}` },
        { label: 'Receita', message: `Registrar receita de ${v}` },
      ],
    })
  }
  const articles = e.n ? searchArticles(e.n.original, 2) : []
  for (const a of articles) {
    const m = articleMeta(a.id)
    if (m) suggestions.push(`O que é ${m.title.toLowerCase()}?`)
  }
  blocks.push(text('Experimente perguntar de outro jeito ou escolha uma sugestão:'))
  return reply('unknown', blocks, { suggestions: [...suggestions, ...STARTER_SUGGESTIONS].slice(0, 5) })
}

export const STATIC: Record<string, Handler> = {
  greeting,
  thanks,
  help,
  identity,
  knowledge,
  current_rates: currentRates,
  tax_legal: taxLegal,
  investment_advice: investmentAdvice,
  permissions,
  edit_delete: editDelete,
  bulk_entry: bulkEntry,
  navigate,
  clear_history: clearHistory,
  difference,
  calc_percentage: calcPercentage,
  calc_simple: calcInterest('simple'),
  calc_compound: calcInterest('compound'),
  calc_installment: calcInstallment,
  calc_saving_plan: calcSavingPlan,
  calc_goal_time: calcGoalTime,
  confirm,
  cancel,
  unknown,
}
