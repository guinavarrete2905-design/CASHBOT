import { shiftMonth } from '@/lib/dates'
import { currentInvoices, invoicePeriod, invoiceTotal } from '@/features/accounts/invoice'
import { budgetStatus, goalPlan } from '@/features/planning/calc'
import { netWorth } from '@/features/wealth/calc'
import { formatPct, sharePct, sumCents, variationPct } from './calc'
import { cap, LINKS, list, money, note, plural, shortDate, text, transactionsLink } from './format'
import { addDays, bareLabel, lastDayOfMonth, monthLabel, monthPeriod, type Period } from './parse'
import { normalizeText } from './normalize'
import type { Entities, Handler, HandlerResult } from './engine'
import { STATIC } from './static'
import type { AccountData, Block, Choice, DataSource, IntentId, Link, Metric, ResultMemo } from './types'

/*
  Respostas às consultas financeiras. Todos os números vêm da DataSource (dados reais do espaço atual);
  nada é estimado ou inventado. Quando não há dados, a resposta diz isso.
*/

const cents = (n: number) => Math.round(n * 100)
const isCardType = (a: { type: string }) => a.type === 'credit_card'

function currentMonth(e: Entities): Period {
  return monthPeriod(e.today.slice(0, 7), e.today)
}

function periodOf(e: Entities, fallback?: Period): Period {
  return e.period ?? fallback ?? currentMonth(e)
}

/** Período imediatamente anterior, de mesmo tamanho (mês anterior para meses). */
function previousPeriod(p: Period, today: string): Period {
  if (p.kind === 'month' && p.month) return monthPeriod(shiftMonth(p.month, -1), today)
  const days = Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000) + 1
  const to = addDays(p.from, -1)
  return { from: addDays(to, -(days - 1)), to, kind: 'range', label: 'no período anterior' }
}

function categoryOf(e: Entities, kind: 'expense' | 'income') {
  return e.category && e.category.category.kind === kind ? e.category.category : null
}

type AccountPick = { account: AccountData | null; choices?: Choice[] }

function accountOf(e: Entities): AccountPick {
  if (!e.account) return { account: null }
  if ('ambiguous' in e.account) {
    return {
      account: null,
      choices: e.account.ambiguous.map((a) => ({ label: a.name, message: `${e.n.original.replace(/cart[aã]o( de cr[eé]dito)?/i, a.name)}` })),
    }
  }
  const id = e.account.account.id
  return { account: e.accounts.find((a) => a.id === id) ?? null }
}

function ambiguousAccountReply(intent: IntentId, choices: Choice[]): HandlerResult {
  return { reply: { intent, blocks: [text('Você tem mais de um cartão. De qual deles?')], choices } }
}

function memo(intent: IntentId, metric: Metric, period: Period, value: number, extra: Partial<ResultMemo> = {}): ResultMemo {
  return { intent, metric, period, value, categoryId: null, categoryName: null, accountId: null, accountName: null, ...extra }
}

function variationSentence(prev: number, cur: number, prevLabel: string): string | null {
  const v = variationPct(prev, cur)
  if (v === null) return null
  if (Math.abs(v) < 0.05) return `O valor ficou igual ao de ${prevLabel}.`
  return `Em comparação com ${prevLabel}, houve ${v > 0 ? 'aumento' : 'redução'} de **${formatPct(Math.abs(v))}** (${money(prev)} → ${money(cur)}).`
}

function prevLabelOf(p: Period, today: string): string {
  return p.kind === 'month' && p.month ? `${monthLabel(p.month, today)}` : 'o período anterior'
}

// ---------------------------------------------------------------------------
// Totais de despesas e receitas
// ---------------------------------------------------------------------------

async function totalHandler(kind: 'expense' | 'income', e: Entities, ds: DataSource): Promise<HandlerResult> {
  const intent: IntentId = kind === 'expense' ? 'expenses_total' : 'income_total'
  const period = periodOf(e)
  const category = categoryOf(e, kind)
  const pick = accountOf(e)
  if (pick.choices) return ambiguousAccountReply(intent, pick.choices)
  const account = pick.account

  const s = await ds.periodSummary({ from: period.from, to: period.to, categoryId: category?.id, accountId: account?.id })
  const value = kind === 'expense' ? s.expense : s.income
  const pending = kind === 'expense' ? s.pendingExpense : s.pendingIncome
  const noun = kind === 'expense' ? 'despesas' : 'receitas'
  const scope = [category ? `com ${category.name.toLowerCase()}` : '', account ? `${isCardType(account) ? 'no cartão' : 'na conta'} ${account.name}` : '']
    .filter(Boolean)
    .join(' ')
  const filters = { categoryId: category?.id ?? null, accountId: account?.id ?? null }
  const links: Link[] = [transactionsLink(period)]

  if (value === 0) {
    return {
      reply: {
        intent,
        blocks: [text(`${cap(period.label)}, não encontrei ${noun}${scope ? ` ${scope}` : ''} registradas.`)],
        suggestions: [kind === 'expense' ? 'Registrar uma despesa' : 'Registrar uma receita', 'E no mês passado?'],
        links,
      },
      memo: memo(intent, kind, period, 0, { categoryId: category?.id ?? null, categoryName: category?.name ?? null, accountId: account?.id ?? null, accountName: account?.name ?? null }),
      period,
      filters,
    }
  }

  const blocks: Block[] = [text(`${cap(period.label)}, suas ${noun}${scope ? ` ${scope}` : ''} totalizaram **${money(value)}**.`)]

  // Participação da categoria e variação em relação ao período anterior.
  if (category || account) {
    const all = await ds.periodSummary({ from: period.from, to: period.to })
    const share = sharePct(value, kind === 'expense' ? all.expense : all.income)
    if (share !== null) blocks.push(text(`Esse valor representa **${formatPct(share)}** do total de ${noun} do período.`))
  }
  if (period.kind === 'month' || period.kind === 'week' || period.kind === 'range') {
    const prev = previousPeriod(period, e.today)
    const ps = await ds.periodSummary({ from: prev.from, to: prev.to, categoryId: category?.id, accountId: account?.id })
    const sentence = variationSentence(kind === 'expense' ? ps.expense : ps.income, value, prevLabelOf(prev, e.today))
    if (sentence) blocks.push(text(sentence))
    else blocks.push(note(`Não há ${noun} registradas no período anterior para comparar.`))
  }

  blocks.push({
    type: 'facts',
    items: [
      { label: kind === 'expense' ? 'Já pagas' : 'Já recebidas', value: money((cents(value) - cents(pending)) / 100) },
      { label: kind === 'expense' ? 'Pendentes' : 'A receber', value: money(pending), tone: pending > 0 ? 'muted' : undefined },
      { label: 'Lançamentos', value: String(kind === 'expense' ? s.expenseCount : s.incomeCount) },
    ],
  })
  if (period.to > e.today && pending > 0) blocks.push(note('O total inclui lançamentos pendentes com data futura dentro do período.'))

  return {
    reply: {
      intent,
      blocks,
      links,
      suggestions: kind === 'expense' ? ['Qual categoria teve mais despesas?', 'E no mês passado?', 'Quais foram minhas maiores despesas?'] : ['Quanto gastei este mês?', 'Quanto sobrou neste mês?'],
    },
    memo: memo(intent, kind, period, value, { categoryId: category?.id ?? null, categoryName: category?.name ?? null, accountId: account?.id ?? null, accountName: account?.name ?? null }),
    period,
    filters,
  }
}

// ---------------------------------------------------------------------------
// Saldo e contas
// ---------------------------------------------------------------------------

function noAccountsReply(intent: IntentId): HandlerResult {
  return {
    reply: {
      intent,
      blocks: [text('Você ainda não cadastrou contas neste espaço, então não tenho saldos para mostrar.'), note('Cadastre suas contas e cartões para eu conseguir responder sobre saldos e faturas.')],
      links: [LINKS.accounts],
    },
  }
}

const balance: Handler = async (e) => {
  const active = e.accounts.filter((a) => !a.archived)
  if (active.length === 0) return noAccountsReply('balance')
  const pick = accountOf(e)
  if (pick.choices) return ambiguousAccountReply('balance', pick.choices)
  if (pick.account) {
    const a = pick.account
    const blocks = isCardType(a)
      ? [text(`O cartão **${a.name}** tem **${money(Math.max(0, -a.balance))}** em aberto.`), note('No cartão, o saldo é o valor em aberto: compras menos pagamentos registrados.')]
      : [text(`O saldo da conta **${a.name}** é **${money(a.balance)}**.`), note('Considera só o que já foi pago ou recebido.')]
    return { reply: { intent: 'balance', blocks, links: [LINKS.accounts], suggestions: ['Quanto tenho em cada conta?'] }, filters: { categoryId: null, accountId: a.id } }
  }
  const regular = active.filter((a) => !isCardType(a))
  const cards = active.filter(isCardType)
  const total = sumCents(regular.map((a) => a.balance))
  const cardOpen = sumCents(cards.map((a) => Math.max(0, -a.balance)))
  const blocks: Block[] = [text(`Somando suas contas, você tem **${money(total)}** disponíveis.`)]
  if (cards.length) blocks.push(text(`Nos cartões, há **${money(cardOpen)}** em aberto.`))
  blocks.push({ type: 'facts', items: regular.map((a) => ({ label: a.name, value: money(a.balance), tone: a.balance < 0 ? 'negative' : undefined })) })
  blocks.push(note('Saldo considera só o que já foi pago ou recebido. Pendências futuras não entram.'))
  return { reply: { intent: 'balance', blocks, links: [LINKS.accounts], suggestions: ['Quanto preciso pagar até o fim do mês?', 'Quanto está a fatura do cartão?'] } }
}

const accountsList: Handler = async (e) => {
  const active = e.accounts.filter((a) => !a.archived)
  if (active.length === 0) return noAccountsReply('accounts_list')
  const regular = active.filter((a) => !isCardType(a))
  const cards = active.filter(isCardType)
  const blocks: Block[] = []
  if (regular.length) {
    blocks.push(text(`Você tem **${money(sumCents(regular.map((a) => a.balance)))}** em ${plural(regular.length, 'conta', 'contas')}:`))
    blocks.push({ type: 'facts', items: regular.map((a) => ({ label: a.name, value: money(a.balance), tone: a.balance < 0 ? 'negative' : undefined })) })
  }
  if (cards.length) {
    blocks.push(text(`Cartões (valor em aberto):`))
    blocks.push({ type: 'facts', items: cards.map((a) => ({ label: a.name, value: money(Math.max(0, -a.balance)) })) })
  }
  return { reply: { intent: 'accounts_list', blocks, links: [LINKS.accounts], suggestions: ['Quanto está a fatura do cartão?', 'Qual meu patrimônio líquido?'] } }
}

// ---------------------------------------------------------------------------
// Categorias e maiores despesas
// ---------------------------------------------------------------------------

const topCategory: Handler = async (e, _ctx, ds) => {
  const period = periodOf(e)
  const rows = await ds.expensesByCategory(period.from, period.to)
  const total = sumCents(rows.map((r) => r.total))
  if (rows.length === 0 || total === 0) {
    return { reply: { intent: 'top_category', blocks: [text(`${cap(period.label)}, não há despesas registradas.`)], links: [transactionsLink(period)] }, period }
  }
  const [first, ...rest] = rows
  const name = first.name ?? 'Sem categoria'
  const blocks: Block[] = [
    text(`${cap(period.label)}, a categoria com mais despesas foi **${name}**: **${money(first.total)}**, ou ${formatPct(sharePct(first.total, total) ?? 0)} do total (${money(total)}).`),
  ]
  if (rest.length) blocks.push(list(rest.slice(0, 3).map((r) => `${r.name ?? 'Sem categoria'}: ${money(r.total)} (${formatPct(sharePct(r.total, total) ?? 0)})`)))
  return {
    reply: { intent: 'top_category', blocks, links: [LINKS.reports], suggestions: ['Gastos por categoria', 'Compare com o mês passado'] },
    period,
    memo: memo('top_category', 'expense', period, first.total, { categoryId: first.categoryId, categoryName: name }),
  }
}

const byCategory: Handler = async (e, _ctx, ds) => {
  const period = periodOf(e)
  const rows = await ds.expensesByCategory(period.from, period.to)
  const total = sumCents(rows.map((r) => r.total))
  if (rows.length === 0 || total === 0) {
    return { reply: { intent: 'expenses_by_category', blocks: [text(`${cap(period.label)}, não há despesas registradas.`)], links: [transactionsLink(period)] }, period }
  }
  return {
    reply: {
      intent: 'expenses_by_category',
      blocks: [
        text(`${cap(period.label)}, suas despesas somaram **${money(total)}**, assim:`),
        { type: 'facts', items: rows.slice(0, 12).map((r) => ({ label: r.name ?? 'Sem categoria', value: `${money(r.total)} · ${formatPct(sharePct(r.total, total) ?? 0)}` })) },
      ],
      links: [LINKS.reports],
      suggestions: ['Quais foram minhas maiores despesas?', 'Como está meu orçamento?'],
    },
    period,
  }
}

const topExpenses: Handler = async (e, _ctx, ds) => {
  const period = periodOf(e)
  const n = Number(/\b(?:top|as|os)? ?(\d{1,2}) (?:maiores|mais)\b|\btop (\d{1,2})\b/.exec(e.t)?.slice(1).find(Boolean) ?? 5)
  const limit = Math.min(Math.max(n, 1), 20)
  const category = categoryOf(e, 'expense')
  const rows = await ds.topExpenses(period.from, period.to, limit, category?.id)
  if (rows.length === 0) {
    return { reply: { intent: 'top_expenses', blocks: [text(`${cap(period.label)}, não há despesas${category ? ` com ${category.name.toLowerCase()}` : ''} registradas.`)], links: [transactionsLink(period)] }, period }
  }
  const blocks: Block[] = [
    text(rows.length === 1 ? `${cap(period.label)}, sua maior despesa${category ? ` com ${category.name.toLowerCase()}` : ''} foi:` : `${cap(period.label)}, suas ${rows.length} maiores despesas${category ? ` com ${category.name.toLowerCase()}` : ''}:`),
    list(rows.map((r) => `**${money(r.amount)}** — ${r.description} · ${shortDate(r.occurredOn, e.today)}${r.categoryName ? ` · ${r.categoryName}` : ''}${r.status === 'pending' ? ' · pendente' : ''}`)),
  ]
  return {
    reply: { intent: 'top_expenses', blocks, links: [transactionsLink(period)], suggestions: ['Qual categoria teve mais despesas?', 'E no mês passado?'] },
    period,
    filters: { categoryId: category?.id ?? null, accountId: null },
  }
}

// ---------------------------------------------------------------------------
// Pendências
// ---------------------------------------------------------------------------

type DueItem = { label: string; amount: number; date: string; overdue: boolean }

/** Faturas de cartão fechadas cujo vencimento cai no intervalo (as compras do cartão ficam como pagas). */
async function cardInvoicesDue(e: Entities, ds: DataSource, until: string): Promise<DueItem[]> {
  const cards = e.accounts.filter((a) => !a.archived && isCardType(a) && a.closingDay && a.dueDay)
  if (!cards.length) return []
  const invoices = cards.map((c) => ({ card: c, inv: currentInvoices(c.closingDay!, c.dueDay!, e.today).closed }))
  const from = invoices.reduce((min, x) => (x.inv.start < min ? x.inv.start : min), e.today)
  const movements = await ds.cardMovements(cards.map((c) => c.id), from)
  const out: DueItem[] = []
  for (const { card, inv } of invoices) {
    if (inv.due < e.today || inv.due > until) continue
    const total = invoiceTotal(movements, card.id, inv)
    if (total > 0) out.push({ label: `Fatura ${card.name}`, amount: total, date: inv.due, overdue: false })
  }
  return out
}

async function pendingHandler(intent: 'bills_due' | 'receivables' | 'overdue', e: Entities, ds: DataSource): Promise<HandlerResult> {
  const explicit = e.period
  const until = intent === 'overdue' ? addDays(e.today, -1) : explicit ? explicit.to : lastDayOfMonth(e.today.slice(0, 7))
  const kind = intent === 'receivables' ? 'income' : 'expense'
  const items = (await ds.pendingUntil(until)).filter((p) => p.kind === kind && (!explicit || intent === 'overdue' || p.occurredOn >= explicit.from || p.occurredOn < e.today))
  const due: DueItem[] = items.map((p) => ({ label: p.description, amount: p.amount, date: p.occurredOn, overdue: p.occurredOn < e.today }))
  if (intent === 'bills_due') due.push(...(await cardInvoicesDue(e, ds, until)))
  due.sort((a, b) => a.date.localeCompare(b.date))

  const label = intent === 'overdue' ? '' : explicit ? explicit.label : 'até o fim do mês'
  const total = sumCents(due.map((d) => d.amount))
  const overdue = due.filter((d) => d.overdue)
  const title = { bills_due: 'contas a pagar', receivables: 'valores a receber', overdue: 'contas atrasadas' }[intent]

  if (due.length === 0) {
    const empty = intent === 'overdue' ? 'Você não tem contas atrasadas registradas. 👍' : `Não encontrei ${title} ${label}.`
    return { reply: { intent, blocks: [text(empty)], links: [LINKS.transactions], suggestions: ['Quanto gastei este mês?'] }, period: explicit ?? null }
  }
  const blocks: Block[] = [
    text(
      intent === 'overdue'
        ? `Você tem **${plural(due.length, 'conta atrasada', 'contas atrasadas')}**, somando **${money(total)}**:`
        : `Você tem **${money(total)}** em ${title} ${label}${overdue.length ? `, incluindo ${money(sumCents(overdue.map((o) => o.amount)))} já vencidos` : ''}:`,
    ),
    list(due.slice(0, 10).map((d) => `${d.overdue ? '⚠️ ' : ''}${shortDate(d.date, e.today)} — ${d.label}: **${money(d.amount)}**`)),
  ]
  if (due.length > 10) blocks.push(note(`E mais ${due.length - 10} itens. Veja todos em Movimentações.`))
  return {
    reply: { intent, blocks, links: [LINKS.transactions], suggestions: intent === 'receivables' ? ['Quanto recebi este mês?'] : ['Qual meu saldo?', 'Como vou fechar o mês?'] },
    period: explicit ?? null,
  }
}

// ---------------------------------------------------------------------------
// Comparações e evolução
// ---------------------------------------------------------------------------

function metricOf(e: Entities): Metric {
  const income = /\b(receb\w*|receitas?|entrou|entradas?|ganhei|ganhos?|renda)\b/.test(e.t)
  const expense = /\b(gast\w*|despesas?|saiu|saidas?|paguei)\b/.test(e.t)
  if (/\b(sobr\w*|economi\w*|resultado|saldo do mes)\b/.test(e.t)) return 'net'
  return income && !expense ? 'income' : 'expense'
}

const METRIC_NOUN: Record<Metric, string> = { expense: 'despesas', income: 'receitas', net: 'resultado (receitas − despesas)' }

async function metricValue(ds: DataSource, metric: Metric, p: Period, categoryId?: string | null) {
  const s = await ds.periodSummary({ from: p.from, to: p.to, categoryId })
  return metric === 'expense' ? s.expense : metric === 'income' ? s.income : (cents(s.income) - cents(s.expense)) / 100
}

const compare: Handler = async (e, ctx, ds) => {
  // Intervalo de vários meses: mostra a evolução mês a mês.
  if (e.period && e.period.kind === 'range' && e.periods.length < 2 && Date.parse(e.period.to) - Date.parse(e.period.from) > 40 * 86_400_000) {
    return evolution(e, ctx, ds)
  }
  const metric = metricOf(e)
  const category = categoryOf(e, metric === 'income' ? 'income' : 'expense')
  let a: Period
  let b: Period
  if (e.periods.length >= 2) [a, b] = [e.periods[0], e.periods[1]].sort((x, y) => x.from.localeCompare(y.from))
  else {
    b = periodOf(e)
    a = previousPeriod(b, e.today)
  }
  const [va, vb] = await Promise.all([metricValue(ds, metric, a, category?.id), metricValue(ds, metric, b, category?.id)])
  const noun = `${METRIC_NOUN[metric]}${category ? ` com ${category.name.toLowerCase()}` : ''}`
  const blocks: Block[] = [
    {
      type: 'facts',
      items: [
        { label: cap(a.label), value: money(va) },
        { label: cap(b.label), value: money(vb) },
        { label: 'Diferença', value: `${vb - va >= 0 ? '+' : '−'}${money(Math.abs((cents(vb) - cents(va)) / 100))}`, tone: metric === 'expense' ? (vb > va ? 'negative' : 'positive') : vb >= va ? 'positive' : 'negative' },
      ],
    },
  ]
  const v = variationPct(va, vb)
  if (va === 0 && vb === 0) blocks.unshift(text(`Não há ${METRIC_NOUN[metric]} registradas nos dois períodos para comparar.`))
  else if (v === null) blocks.unshift(text(`Comparando ${noun}: ${a.label} não tem registros, então não dá para calcular a variação percentual.`))
  else blocks.unshift(text(`Suas ${noun} ${v > 0 ? 'aumentaram' : v < 0 ? 'diminuíram' : 'ficaram iguais'}${v !== 0 ? ` **${formatPct(Math.abs(v))}**` : ''} ${b.label}, em comparação com ${bareLabel(a.label)}.`))

  // Categorias que mais mudaram (só para despesas sem filtro).
  if (metric === 'expense' && !category && (va > 0 || vb > 0)) {
    const [ra, rb] = await Promise.all([ds.expensesByCategory(a.from, a.to), ds.expensesByCategory(b.from, b.to)])
    const before = new Map(ra.map((r) => [r.categoryId ?? '', r]))
    const changes = rb
      .map((r) => ({ name: r.name ?? 'Sem categoria', diff: (cents(r.total) - cents(before.get(r.categoryId ?? '')?.total ?? 0)) / 100 }))
      .concat(ra.filter((r) => !rb.some((x) => (x.categoryId ?? '') === (r.categoryId ?? ''))).map((r) => ({ name: r.name ?? 'Sem categoria', diff: -r.total })))
      .filter((c) => Math.abs(c.diff) >= 0.01)
      .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
      .slice(0, 3)
    if (changes.length) {
      blocks.push(text('O que mais mudou:'))
      blocks.push(list(changes.map((c) => `${c.name}: ${c.diff > 0 ? '+' : '−'}${money(Math.abs(c.diff))}`)))
    }
  }
  return {
    reply: { intent: 'compare', blocks, links: [LINKS.reports], suggestions: ['Gastos nos últimos 6 meses', 'Qual categoria teve mais despesas?'] },
    memo: [memo('compare', metric, a, va, { categoryId: category?.id ?? null, categoryName: category?.name ?? null }), memo('compare', metric, b, vb, { categoryId: category?.id ?? null, categoryName: category?.name ?? null })],
    period: b,
    filters: { categoryId: category?.id ?? null, accountId: null },
  }
}

const evolution: Handler = async (e, _ctx, ds) => {
  const cur = e.today.slice(0, 7)
  const period: Period = e.period && e.period.kind !== 'day' && e.period.kind !== 'week' && e.period.kind !== 'month'
    ? e.period
    : { from: `${shiftMonth(cur, -5)}-01`, to: lastDayOfMonth(cur), kind: 'range', label: 'nos últimos 6 meses' }
  const rows = await ds.monthlyTotals(period.from, period.to)
  // Preenche meses sem movimentação com zero.
  const months: string[] = []
  for (let m = period.from.slice(0, 7); m <= period.to.slice(0, 7) && months.length < 36; m = shiftMonth(m, 1)) months.push(m)
  const byMonth = new Map(rows.map((r) => [r.month.slice(0, 7), r]))
  const series = months.map((m) => ({ month: m, income: byMonth.get(m)?.income ?? 0, expense: byMonth.get(m)?.expense ?? 0 }))
  if (series.every((s) => s.income === 0 && s.expense === 0)) {
    return { reply: { intent: 'monthly_evolution', blocks: [text(`${cap(period.label)}, não há movimentações registradas.`)], links: [LINKS.reports] }, period }
  }
  const metric = metricOf(e)
  const values = series.map((s) => (metric === 'income' ? s.income : metric === 'net' ? (cents(s.income) - cents(s.expense)) / 100 : s.expense))
  const complete = series.filter((s) => s.month < cur)
  const withData = (complete.length ? complete : series).filter((s) => s.income !== 0 || s.expense !== 0)
  const avgBase = (withData.length ? withData : series).map((s) => (metric === 'income' ? s.income : metric === 'net' ? s.income - s.expense : s.expense))
  const avg = sumCents(avgBase) / avgBase.length
  const maxIdx = values.indexOf(Math.max(...values))
  const blocks: Block[] = [
    text(`Suas ${METRIC_NOUN[metric]} ${period.label}, mês a mês:`),
    {
      type: 'facts',
      items: series.map((s, i) => ({ label: cap(monthLabel(s.month, e.today)), value: money(values[i]), tone: metric === 'net' ? (values[i] >= 0 ? 'positive' : 'negative') : undefined })),
    },
    text(`Média mensal (meses completos com registros): **${money(Math.round(avg * 100) / 100)}**. O maior valor foi em ${monthLabel(series[maxIdx].month, e.today)}.`),
  ]
  return { reply: { intent: 'monthly_evolution', blocks, links: [LINKS.reports], suggestions: ['Compare este mês com o passado', 'Qual categoria teve mais despesas?'] }, period }
}

// ---------------------------------------------------------------------------
// Resultado, previsão, média e quantidade
// ---------------------------------------------------------------------------

const savings: Handler = async (e, _ctx, ds) => {
  const period = periodOf(e)
  const s = await ds.periodSummary({ from: period.from, to: period.to })
  const result = (cents(s.income) - cents(s.expense)) / 100
  if (s.income === 0 && s.expense === 0) {
    return { reply: { intent: 'savings', blocks: [text(`${cap(period.label)}, não há receitas nem despesas registradas.`)], links: [transactionsLink(period)] }, period }
  }
  const rate = sharePct(result, s.income)
  const blocks: Block[] = [
    text(result >= 0 ? `${cap(period.label)}, sobraram **${money(result)}**.` : `${cap(period.label)}, as despesas superaram as receitas em **${money(-result)}**.`),
    {
      type: 'facts',
      items: [
        { label: 'Receitas', value: money(s.income), tone: 'positive' },
        { label: 'Despesas', value: money(s.expense), tone: 'negative' },
        { label: 'Resultado', value: money(result), tone: result >= 0 ? 'positive' : 'negative' },
        ...(rate !== null ? [{ label: 'Taxa de poupança', value: formatPct(rate) }] : []),
      ],
    },
  ]
  if (s.pendingExpense > 0 || s.pendingIncome > 0) blocks.push(note('Inclui lançamentos pendentes do período. Transferências entre contas não entram.'))
  return {
    reply: { intent: 'savings', blocks, links: [transactionsLink(period)], suggestions: ['E no mês passado?', 'Como vou fechar o mês?'] },
    memo: memo('savings', 'net', period, result),
    period,
  }
}

const forecast: Handler = async (e, _ctx, ds) => {
  const period = currentMonth(e)
  const s = await ds.periodSummary({ from: period.from, to: period.to })
  const accountsTotal = sumCents(e.accounts.filter((a) => !a.archived && !isCardType(a)).map((a) => a.balance))
  const futureIncome = s.pendingIncome
  const futureExpense = s.pendingExpense
  const projected = (cents(accountsTotal) + cents(futureIncome) - cents(futureExpense)) / 100
  const result = (cents(s.income) - cents(s.expense)) / 100
  const blocks: Block[] = [
    text(`Considerando o que está registrado, este mês deve fechar com resultado de **${money(result)}** (receitas − despesas, incluindo pendências).`),
    {
      type: 'facts',
      items: [
        { label: 'Saldo atual nas contas', value: money(accountsTotal) },
        { label: 'A receber até o fim do mês', value: money(futureIncome), tone: 'positive' },
        { label: 'A pagar até o fim do mês', value: money(futureExpense), tone: 'negative' },
        { label: 'Saldo previsto nas contas', value: money(projected), tone: projected >= 0 ? 'positive' : 'negative' },
      ],
    },
    note('É uma projeção simples com base só nos lançamentos registrados (inclusive pendentes). Gastos ainda não lançados não entram, e faturas de cartão aparecem em "Contas a pagar".'),
  ]
  return { reply: { intent: 'forecast', blocks, links: [LINKS.transactions], suggestions: ['Quais contas preciso pagar?', 'Quanto gastei este mês?'] }, period }
}

const average: Handler = async (e, _ctx, ds) => {
  const metric = metricOf(e)
  const noun = metric === 'income' ? 'receitas' : 'despesas'
  if (/\b(por dia|diari\w*)\b/.test(e.t)) {
    const period = periodOf(e)
    const end = period.to > e.today ? e.today : period.to
    const days = Math.round((Date.parse(end) - Date.parse(period.from)) / 86_400_000) + 1
    const s = await ds.periodSummary({ from: period.from, to: end })
    const v = metric === 'income' ? s.income : s.expense
    return {
      reply: {
        intent: 'average',
        blocks: [text(`${cap(period.label)}, a média de ${noun} foi de **${money(Math.round((v / days) * 100) / 100)} por dia** (${money(v)} em ${plural(days, 'dia', 'dias')}).`)],
        links: [LINKS.reports],
      },
      period,
    }
  }
  const cur = e.today.slice(0, 7)
  const from = shiftMonth(cur, -6)
  const rows = await ds.monthlyTotals(`${from}-01`, lastDayOfMonth(shiftMonth(cur, -1)))
  const vals = rows.map((r) => (metric === 'income' ? r.income : r.expense)).filter((v) => v > 0)
  if (!vals.length) {
    return { reply: { intent: 'average', blocks: [text(`Não há ${noun} registradas nos últimos 6 meses completos para calcular a média.`)], links: [LINKS.reports] } }
  }
  const avg = Math.round((sumCents(vals) / vals.length) * 100) / 100
  return {
    reply: {
      intent: 'average',
      blocks: [
        text(`Sua média mensal de ${noun} é **${money(avg)}**, considerando ${plural(vals.length, 'mês completo', 'meses completos')} com registros (o mês atual não entra).`),
      ],
      links: [LINKS.reports],
      suggestions: ['Gastos nos últimos 6 meses', 'Quanto deveria ter de reserva de emergência?'],
    },
  }
}

const txCount: Handler = async (e, _ctx, ds) => {
  const period = periodOf(e)
  const category = e.category?.category ?? null
  const s = await ds.periodSummary({ from: period.from, to: period.to, categoryId: category?.id })
  return {
    reply: {
      intent: 'tx_count',
      blocks: [
        text(`${cap(period.label)}, há **${plural(s.incomeCount + s.expenseCount, 'lançamento', 'lançamentos')}**${category ? ` em ${category.name}` : ''} (sem contar transferências).`),
        { type: 'facts', items: [{ label: 'Despesas', value: String(s.expenseCount) }, { label: 'Receitas', value: String(s.incomeCount) }] },
      ],
      links: [transactionsLink(period)],
    },
    period,
    filters: { categoryId: category?.id ?? null, accountId: null },
  }
}

const recent: Handler = async (e, _ctx, ds) => {
  const n = Math.min(Number(/\b(\d{1,2})\b/.exec(e.t)?.[1] ?? 5) || 5, 15)
  const rows = await ds.recent(n)
  if (!rows.length) return { reply: { intent: 'recent', blocks: [text('Ainda não há movimentações registradas neste espaço.')], suggestions: ['Registrar uma despesa'] } }
  return {
    reply: {
      intent: 'recent',
      blocks: [text(`Suas últimas ${plural(rows.length, 'movimentação', 'movimentações')}:`), list(rows.map((r) => `${shortDate(r.occurredOn, e.today)} — ${r.description}: **${money(r.amount)}**`))],
      links: [LINKS.transactions],
    },
  }
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

function cardsOf(e: Entities): { cards: AccountData[]; choices?: Choice[] } {
  const all = e.accounts.filter((a) => !a.archived && isCardType(a))
  const pick = accountOf(e)
  if (pick.account && isCardType(pick.account)) return { cards: [pick.account] }
  return { cards: all }
}

const cardInvoice: Handler = async (e, _ctx, ds) => {
  const { cards } = cardsOf(e)
  if (!cards.length) return { reply: { intent: 'card_invoice', blocks: [text('Você não tem cartões de crédito cadastrados neste espaço.')], links: [LINKS.accounts] } }
  const withDays = cards.filter((c) => c.closingDay && c.dueDay)
  const periods = withDays.map((c) => ({ c, ...currentInvoices(c.closingDay!, c.dueDay!, e.today) }))
  const from = periods.reduce((m, p) => (p.closed.start < m ? p.closed.start : m), e.today)
  const movements = withDays.length ? await ds.cardMovements(withDays.map((c) => c.id), from) : []
  const blocks: Block[] = []
  for (const p of periods) {
    const open = invoiceTotal(movements, p.c.id, p.open)
    const closed = invoiceTotal(movements, p.c.id, p.closed)
    blocks.push(text(`**${p.c.name}**`))
    blocks.push({
      type: 'facts',
      items: [
        { label: `Fatura aberta (fecha ${shortDate(p.open.closing, e.today)})`, value: money(open) },
        { label: `Última fechada (vence ${shortDate(p.closed.due, e.today)})`, value: money(closed), tone: p.closed.due < e.today ? 'muted' : undefined },
      ],
    })
  }
  for (const c of cards.filter((x) => !x.closingDay || !x.dueDay)) {
    blocks.push(text(`**${c.name}**: ${money(Math.max(0, -c.balance))} em aberto. Cadastre os dias de fechamento e vencimento para eu separar as faturas.`))
  }
  blocks.push(note('A fatura soma compras e estornos lançados no cartão dentro do período. Pagamentos não entram.'))
  return {
    reply: { intent: 'card_invoice', blocks, links: [LINKS.accounts], suggestions: ['Qual o limite disponível do cartão?', 'Qual foi minha maior fatura?'] },
    filters: { categoryId: null, accountId: cards.length === 1 ? cards[0].id : null },
  }
}

const biggestInvoice: Handler = async (e, _ctx, ds) => {
  const { cards } = cardsOf(e)
  const withDays = cards.filter((c) => c.closingDay && c.dueDay)
  if (!withDays.length) {
    return { reply: { intent: 'biggest_invoice', blocks: [text('Para comparar faturas, preciso de cartões com dias de fechamento e vencimento cadastrados.')], links: [LINKS.accounts] } }
  }
  const curMonth = e.today.slice(0, 7)
  const movements = await ds.cardMovements(withDays.map((c) => c.id), `${shiftMonth(curMonth, -13)}-01`)
  let best: { card: AccountData; month: string; total: number; due: string } | null = null
  for (const c of withDays) {
    const lastClosed = currentInvoices(c.closingDay!, c.dueDay!, e.today).closed.month
    for (let i = 0; i < 12; i++) {
      const p = invoicePeriod(shiftMonth(lastClosed, -i), c.closingDay!, c.dueDay!)
      const total = invoiceTotal(movements, c.id, p)
      if (!best || total > best.total) best = { card: c, month: p.month, total, due: p.due }
    }
  }
  if (!best || best.total <= 0) return { reply: { intent: 'biggest_invoice', blocks: [text('Não encontrei faturas com valor nos últimos 12 meses.')], links: [LINKS.accounts] } }
  return {
    reply: {
      intent: 'biggest_invoice',
      blocks: [text(`Sua maior fatura nos últimos 12 meses foi a do **${best.card.name}** que fechou em ${monthLabel(best.month, e.today)}: **${money(best.total)}** (vencimento ${shortDate(best.due, e.today)}).`)],
      links: [LINKS.accounts],
    },
  }
}

const cardLimit: Handler = async (e) => {
  const { cards } = cardsOf(e)
  if (!cards.length) return { reply: { intent: 'card_limit', blocks: [text('Você não tem cartões de crédito cadastrados neste espaço.')], links: [LINKS.accounts] } }
  const items = cards.map((c) => {
    const used = Math.max(0, -c.balance)
    if (c.creditLimit === null) return { label: c.name, value: `limite não cadastrado · ${money(used)} em aberto` }
    const available = (cents(c.creditLimit) - cents(used)) / 100
    return { label: c.name, value: `${money(available)} de ${money(c.creditLimit)}`, tone: available < 0 ? ('negative' as const) : undefined }
  })
  return {
    reply: {
      intent: 'card_limit',
      blocks: [text('Limite disponível (limite − valor em aberto):'), { type: 'facts', items }, note('O valor em aberto considera compras menos pagamentos registrados. Confira com o banco antes de uma compra grande.')],
      links: [LINKS.accounts],
    },
  }
}

// ---------------------------------------------------------------------------
// Planejamento: orçamentos e metas
// ---------------------------------------------------------------------------

const budget: Handler = async (e, _ctx, ds) => {
  const period = e.period?.kind === 'month' ? e.period : currentMonth(e)
  const budgets = await ds.budgets()
  if (!budgets.length) {
    return { reply: { intent: 'budget', blocks: [text('Você ainda não definiu limites de gastos por categoria.'), note('Em Planejamento você define quanto quer gastar por mês em cada categoria e eu acompanho por aqui.')], links: [LINKS.planning] } }
  }
  const rows = await ds.expensesByCategory(period.from, period.to)
  const spent = new Map(rows.map((r) => [r.categoryId ?? '', r.total]))
  const name = (id: string) => e.categories.find((c) => c.id === id)?.name ?? 'Categoria'
  const category = categoryOf(e, 'expense')
  const selected = category ? budgets.filter((b) => b.categoryId === category.id) : budgets
  if (category && !selected.length) {
    return { reply: { intent: 'budget', blocks: [text(`Não há limite definido para ${category.name}.`)], links: [LINKS.planning] }, filters: { categoryId: category.id, accountId: null } }
  }
  const status = selected
    .map((b) => ({ b, s: budgetStatus(spent.get(b.categoryId) ?? 0, b.amount), spent: spent.get(b.categoryId) ?? 0 }))
    .sort((x, y) => y.s.pct - x.s.pct)
  const over = status.filter((x) => x.s.state === 'over')
  const blocks: Block[] = []
  if (category) {
    const x = status[0]
    blocks.push(
      text(
        x.s.remaining >= 0
          ? `${cap(period.label)}, você gastou **${money(x.spent)}** de **${money(x.b.amount)}** em ${category.name} (${formatPct(x.s.pct, 0)}). Ainda pode gastar **${money(x.s.remaining)}**.`
          : `${cap(period.label)}, o limite de ${category.name} foi ultrapassado em **${money(-x.s.remaining)}** (${money(x.spent)} de ${money(x.b.amount)}).`,
      ),
    )
  } else {
    blocks.push(text(over.length ? `${cap(period.label)}, ${plural(over.length, 'categoria passou', 'categorias passaram')} do limite.` : `${cap(period.label)}, todas as categorias estão dentro do limite.`))
    blocks.push({
      type: 'facts',
      items: status.map((x) => ({
        label: name(x.b.categoryId),
        value: `${money(x.spent)} de ${money(x.b.amount)} · ${formatPct(x.s.pct, 0)}`,
        tone: x.s.state === 'over' ? ('negative' as const) : x.s.state === 'warning' ? ('muted' as const) : undefined,
      })),
    })
  }
  blocks.push(note('O gasto inclui despesas pendentes do mês (é o previsto), como na tela de Planejamento.'))
  return { reply: { intent: 'budget', blocks, links: [LINKS.planning] }, period, filters: { categoryId: category?.id ?? null, accountId: null } }
}

function goalsList(e: Entities, goals: Awaited<ReturnType<DataSource['goals']>>) {
  return goals.filter((g) => !g.archived).map((g) => ({ g, plan: goalPlan(g, e.today) }))
}

const goals: Handler = async (e, _ctx, ds) => {
  const items = goalsList(e, await ds.goals())
  if (!items.length) return { reply: { intent: 'goals', blocks: [text('Você ainda não criou metas neste espaço.')], links: [LINKS.planning], suggestions: ['Como criar metas financeiras?'] } }
  return {
    reply: {
      intent: 'goals',
      blocks: [
        text(`Você tem ${plural(items.length, 'meta ativa', 'metas ativas')}:`),
        list(
          items.map(({ g, plan }) => {
            const base = `**${g.name}**: ${money(g.saved)} de ${money(g.target)} (${formatPct(plan.pct, 0)})`
            if (plan.done) return `${base} — concluída 🎉`
            if (plan.perMonth !== null) return `${base} — guardar ${money(plan.perMonth)}/mês até ${shortDate(g.targetDate!, e.today)}`
            if (plan.late) return `${base} — prazo vencido, faltam ${money(plan.remaining)}`
            return `${base} — faltam ${money(plan.remaining)}`
          }),
        ),
      ],
      links: [LINKS.planning],
    },
  }
}

const goalPlanHandler: Handler = async (e, ctx, ds) => {
  const items = goalsList(e, await ds.goals())
  if (!items.length) return goals(e, ctx, ds)
  const named = items.filter(({ g }) => {
    const n = normalizeText(g.name)
    return n.length >= 3 && e.t.includes(n)
  })
  const target = named.length === 1 ? named[0] : items.length === 1 ? items[0] : null
  if (!target) {
    return {
      reply: {
        intent: 'goal_plan',
        blocks: [text('De qual meta?')],
        choices: items.slice(0, 6).map(({ g }) => ({ label: g.name, message: `Quanto preciso guardar por mês para a meta ${g.name}?` })),
      },
    }
  }
  const { g, plan } = target
  let sentence: string
  if (plan.done) sentence = `A meta **${g.name}** já foi alcançada (${money(g.saved)} de ${money(g.target)}).`
  else if (!g.targetDate) sentence = `Faltam **${money(plan.remaining)}** para a meta **${g.name}**. Ela não tem prazo; defina uma data em Planejamento para eu calcular quanto guardar por mês.`
  else if (plan.late) sentence = `O prazo da meta **${g.name}** já passou e faltam **${money(plan.remaining)}**. Que tal definir um novo prazo?`
  else sentence = `Para chegar a **${money(g.target)}** em **${g.name}** até ${shortDate(g.targetDate, e.today)}, guarde **${money(plan.perMonth!)} por mês** nos próximos ${plural(plan.months!, 'mês', 'meses')} (faltam ${money(plan.remaining)}).`
  return { reply: { intent: 'goal_plan', blocks: [text(sentence), note('Cálculo sem considerar rendimentos.')], links: [LINKS.planning] } }
}

// ---------------------------------------------------------------------------
// Patrimônio e dívidas
// ---------------------------------------------------------------------------

const netWorthHandler: Handler = async (e, _ctx, ds) => {
  const [assets, liabilities] = await Promise.all([ds.assets(), ds.liabilities()])
  const nw = netWorth({ accounts: e.accounts, assets, liabilities })
  if (!e.accounts.length && !assets.length && !liabilities.length) {
    return { reply: { intent: 'net_worth', blocks: [text('Ainda não há contas, bens ou dívidas cadastrados para calcular o patrimônio.')], links: [LINKS.wealth, LINKS.accounts] } }
  }
  return {
    reply: {
      intent: 'net_worth',
      blocks: [
        text(`Seu patrimônio líquido é **${money(nw.netWorth)}**.`),
        {
          type: 'facts',
          items: [
            { label: 'Saldo das contas', value: money(nw.accounts) },
            { label: 'Bens e investimentos', value: money(nw.assets) },
            { label: 'Dívidas', value: `−${money(nw.debts)}`, tone: 'negative' },
            { label: 'Em aberto nos cartões', value: `−${money(nw.cardDebt)}`, tone: 'negative' },
          ],
        },
        note('Patrimônio líquido = contas + bens e investimentos − dívidas − valor em aberto nos cartões. Usa os valores que você cadastrou.'),
      ],
      links: [LINKS.wealth],
      suggestions: ['Como está minha evolução patrimonial?', 'Quanto estou devendo?'],
    },
  }
}

const netWorthEvolution: Handler = async (e, _ctx, ds) => {
  const snaps = await ds.snapshots()
  if (snaps.length < 2) {
    return {
      reply: {
        intent: 'net_worth_evolution',
        blocks: [text(snaps.length ? 'Há só um mês registrado no histórico do patrimônio, então ainda não dá para ver a evolução.' : 'Ainda não há histórico do patrimônio registrado.'), note('O histórico é atualizado quando você abre a tela de Patrimônio a cada mês.')],
        links: [LINKS.wealth],
      },
    }
  }
  const first = snaps[0]
  const last = snaps[snaps.length - 1]
  const diff = (cents(last.netWorth) - cents(first.netWorth)) / 100
  const v = variationPct(first.netWorth, last.netWorth)
  const recentSnaps = snaps.slice(-6)
  return {
    reply: {
      intent: 'net_worth_evolution',
      blocks: [
        text(
          `Desde ${monthLabel(first.month, e.today)}, seu patrimônio líquido ${diff >= 0 ? 'cresceu' : 'diminuiu'} **${money(Math.abs(diff))}**${v !== null ? ` (${formatPct(Math.abs(v))})` : ''}: de ${money(first.netWorth)} para ${money(last.netWorth)}.`,
        ),
        { type: 'facts', items: recentSnaps.map((s) => ({ label: cap(monthLabel(s.month, e.today)), value: money(s.netWorth) })) },
      ],
      links: [LINKS.wealth],
    },
  }
}

const debts: Handler = async (e, _ctx, ds) => {
  const liabilities = (await ds.liabilities()).filter((l) => !l.archived)
  const cards = e.accounts.filter((a) => !a.archived && isCardType(a) && a.balance < 0)
  if (!liabilities.length && !cards.length) {
    return { reply: { intent: 'debts', blocks: [text('Não há dívidas cadastradas nem valores em aberto nos cartões.'), note('Financiamentos e empréstimos podem ser cadastrados em Patrimônio.')], links: [LINKS.wealth] } }
  }
  const total = sumCents([...liabilities.map((l) => l.balance), ...cards.map((c) => -c.balance)])
  const monthly = sumCents(liabilities.map((l) => l.monthlyPayment ?? 0))
  const blocks: Block[] = [
    text(`Você deve **${money(total)}** no total.`),
    {
      type: 'facts',
      items: [
        ...liabilities.map((l) => ({ label: l.name, value: `${money(l.balance)}${l.monthlyPayment ? ` · parcela ${money(l.monthlyPayment)}` : ''}` })),
        ...cards.map((c) => ({ label: `Cartão ${c.name} (em aberto)`, value: money(-c.balance) })),
      ],
    },
  ]
  if (monthly > 0) blocks.push(text(`As parcelas cadastradas somam **${money(monthly)} por mês**.`))
  return { reply: { intent: 'debts', blocks, links: [LINKS.wealth], suggestions: ['Como sair das dívidas?', 'O que é amortização?'] } }
}

const emergencyReserve: Handler = async (e, _ctx, ds) => {
  if (/\b(o que e|como funciona|explic\w*|para que serve|pra que serve)\b/.test(e.t)) return STATIC.knowledge(e, _ctx, ds)
  const cur = e.today.slice(0, 7)
  const rows = await ds.monthlyTotals(`${shiftMonth(cur, -3)}-01`, lastDayOfMonth(shiftMonth(cur, -1)))
  const vals = rows.map((r) => r.expense).filter((v) => v > 0)
  const liquid = sumCents(e.accounts.filter((a) => !a.archived && !isCardType(a)).map((a) => a.balance))
  if (!vals.length) {
    return {
      reply: {
        intent: 'emergency_reserve',
        blocks: [text('Para estimar sua reserva, preciso de despesas registradas nos últimos meses completos — e ainda não há.'), note('Uma referência comum é guardar alguns meses de despesas essenciais. Veja o artigo sobre reserva de emergência.')],
        suggestions: ['O que é reserva de emergência?'],
      },
    }
  }
  const avg = Math.round((sumCents(vals) / vals.length) * 100) / 100
  const coverage = avg > 0 ? liquid / avg : 0
  return {
    reply: {
      intent: 'emergency_reserve',
      blocks: [
        text(`Sua despesa média mensal (últimos ${plural(vals.length, 'mês completo', 'meses completos')}) é **${money(avg)}**. Como referência:`),
        {
          type: 'facts',
          items: [
            { label: '3 meses de despesas', value: money(Math.round(avg * 3 * 100) / 100) },
            { label: '6 meses de despesas', value: money(Math.round(avg * 6 * 100) / 100) },
            { label: '12 meses de despesas', value: money(Math.round(avg * 12 * 100) / 100) },
          ],
        },
        text(`Hoje o saldo das suas contas cobre cerca de **${coverage.toFixed(1).replace('.', ',')} ${coverage >= 0.95 && coverage < 1.05 ? 'mês' : 'meses'}** dessas despesas.`),
        note('A média usa todas as despesas, não só as essenciais. O tamanho ideal da reserva depende da estabilidade da sua renda — é uma referência, não uma regra.'),
      ],
      links: [LINKS.planning],
      suggestions: ['O que é reserva de emergência?', 'O que é liquidez?'],
    },
  }
}

export const ANSWERS: Partial<Record<IntentId, Handler>> = {
  expenses_total: (e, _c, ds) => totalHandler('expense', e, ds),
  income_total: (e, _c, ds) => totalHandler('income', e, ds),
  balance,
  accounts_list: accountsList,
  top_category: topCategory,
  expenses_by_category: byCategory,
  top_expenses: topExpenses,
  bills_due: (e, _c, ds) => pendingHandler('bills_due', e, ds),
  receivables: (e, _c, ds) => pendingHandler('receivables', e, ds),
  overdue: (e, _c, ds) => pendingHandler('overdue', e, ds),
  compare,
  monthly_evolution: evolution,
  savings,
  forecast,
  average,
  tx_count: txCount,
  recent,
  card_invoice: cardInvoice,
  biggest_invoice: biggestInvoice,
  card_limit: cardLimit,
  budget,
  goals,
  goal_plan: goalPlanHandler,
  net_worth: netWorthHandler,
  net_worth_evolution: netWorthEvolution,
  debts,
  emergency_reserve: emergencyReserve,
}
