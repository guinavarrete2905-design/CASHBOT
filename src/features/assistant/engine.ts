import { normalize, type Normalized } from './normalize'
import {
  matchAccount,
  matchCategory,
  mergeRange,
  parseAmounts,
  parseDate,
  parseDuration,
  parseInstallments,
  parsePercents,
  parsePeriods,
  type AccountMatch,
  type Amount,
  type CategoryMatch,
  type DateMatch,
  type Period,
  type PeriodMatch,
} from './parse'
import { isConflict, QUESTION_START, rankIntents, type Signals } from './intents'
import { searchArticles } from './knowledge/index'
import type {
  AccountData,
  Awaiting,
  CategoryData,
  ConversationContext,
  DataSource,
  Draft,
  IntentId,
  Reply,
  ResultMemo,
} from './types'
import { ANSWERS } from './answers'
import { answerSlot, DRAFT_INTENTS, registerFlow } from './drafts'
import { STATIC } from './static'

/*
  Motor de regras: recebe a mensagem, interpreta (entidades + intenção + contexto),
  chama o tratador da intenção e devolve a resposta com o novo contexto.
  Não acessa o banco diretamente: tudo passa pela DataSource (consultas autorizadas).
*/

export type Entities = {
  n: Normalized
  t: string
  today: string
  question: boolean
  amounts: Amount[]
  explicitAmounts: Amount[]
  periods: PeriodMatch[]
  /** Período principal: intervalo "de X a Y" ou o primeiro período citado. */
  period: Period | null
  category: CategoryMatch | null
  account: AccountMatch | null
  installments: ReturnType<typeof parseInstallments>
  percents: ReturnType<typeof parsePercents>
  duration: ReturnType<typeof parseDuration>
  date: DateMatch | 'invalid' | null
  categories: CategoryData[]
  accounts: AccountData[]
}

export type HandlerResult = {
  reply: Reply
  /** Resultado numérico para o contexto (um ou dois, quando há comparação). */
  memo?: ResultMemo | [ResultMemo, ResultMemo]
  period?: Period | null
  filters?: { categoryId: string | null; accountId: string | null }
  pendingDrafts?: Draft[]
  awaiting?: Awaiting | null
}

export type Handler = (e: Entities, ctx: ConversationContext, ds: DataSource) => Promise<HandlerResult>

/** Intenções que aceitam "E em outubro?". */
const PERIOD_FOLLOWUP: IntentId[] = [
  'expenses_total',
  'income_total',
  'top_category',
  'expenses_by_category',
  'top_expenses',
  'savings',
  'tx_count',
  'compare',
  'monthly_evolution',
  'bills_due',
  'receivables',
  'budget',
]
/** Intenções que aceitam "E com transporte?" / "E no Nubank?". */
const FILTER_FOLLOWUP: IntentId[] = ['expenses_total', 'income_total', 'top_expenses', 'tx_count', 'budget', 'balance', 'card_invoice', 'card_limit', 'compare']

const DIFFERENCE_RE =
  /^(e )?(qual (e |foi |seria )?a diferenca|a diferenca|diferenca|quanto a mais|quanto a menos|quanto mudou|compar\w* (os dois|com o anterior|com isso|esses dois|ambos)|e comparando|aumentou ou diminuiu|foi mais ou menos)\b/

export async function buildEntities(message: string, ds: DataSource, prefer: 'past' | 'future' = 'past'): Promise<Entities> {
  const n = normalize(message)
  const t = n.text
  const today = ds.today
  const [categories, accounts] = await Promise.all([ds.categories(), ds.accounts()])
  const amounts = parseAmounts(t, true)
  const periods = parsePeriods(t, today, prefer)
  return {
    n,
    t,
    today,
    question: /\?/.test(message) || QUESTION_START.test(t),
    amounts,
    explicitAmounts: amounts.filter((a) => a.explicit),
    periods,
    period: mergeRange(t, periods) ?? periods[0] ?? null,
    category: matchCategory(t, categories),
    account: matchAccount(t, accounts),
    installments: parseInstallments(t),
    percents: parsePercents(t),
    duration: parseDuration(t),
    date: parseDate(t, today),
    categories,
    accounts,
  }
}

function signalsOf(e: Entities): Signals {
  return {
    explicitAmount: e.explicitAmounts.length > 0,
    anyAmount: e.amounts.length > 0,
    periods: e.periods.length,
    hasCategory: Boolean(e.category),
    hasAccount: Boolean(e.account),
    hasInstallments: Boolean(e.installments && e.installments.count >= 2),
    hasPercent: e.percents.length > 0,
    hasDuration: Boolean(e.duration),
    question: e.question,
    words: e.n.tokens.length,
  }
}

/** Palavras da mensagem fora dos trechos reconhecidos (período, categoria, conta). */
function leftoverWords(e: Entities): string[] {
  const spans = [...e.periods, ...(e.category ? [e.category] : []), ...(e.account ? [e.account] : [])]
  return e.n.tokens
    .filter((tk) => !spans.some((s) => tk.start < s.end && tk.end > s.start))
    .map((tk) => tk.norm)
    .filter((w) => !/^(e|em|no|na|nos|nas|de|do|da|com|o|a|os|as|pra|para|pro|mes|entao|ai|tambem|agora|sobre|quanto|quanta|qual|ver)$/.test(w))
}

export type Decision = { intent: IntentId; choices?: Array<{ id: IntentId; score: number }> }

/** Palavras soltas que podem significar coisas diferentes: em vez de adivinhar, perguntamos. */
const AMBIGUOUS_WORDS: Record<string, IntentId[]> = {
  cartao: ['card_invoice', 'card_limit', 'knowledge'],
  cartoes: ['card_invoice', 'card_limit'],
  contas: ['accounts_list', 'bills_due'],
  conta: ['accounts_list', 'bills_due'],
  dinheiro: ['balance', 'savings'],
  pagamentos: ['bills_due', 'expenses_total'],
}

/** Decide a intenção considerando regras, contexto e ambiguidade. */
export function decide(e: Entities, ctx: ConversationContext): Decision {
  const bare = e.t.replace(/^(meu|minha|meus|minhas|o|a|os|as) /, '')
  if (AMBIGUOUS_WORDS[bare] && e.n.tokens.length <= 2) return { intent: 'clarify', choices: AMBIGUOUS_WORDS[bare].map((id) => ({ id, score: 0 })) }

  const ranked = rankIntents(e.t, signalsOf(e)).filter((r) => r.id !== 'knowledge' || searchArticles(e.t, 1).length > 0)
  const top = ranked[0]

  // "Qual a diferença?" — compara os dois últimos resultados.
  if (DIFFERENCE_RE.test(e.t) && !/diferenca entre/.test(e.t) && e.periods.length === 0 && !e.category) return { intent: 'difference' }

  const shortFollowup = /^e\b/.test(e.t) || leftoverWords(e).length === 0
  if (ctx.lastIntent && shortFollowup && (!top || top.score < 7)) {
    if (e.periods.length > 0 && leftoverWords(e).length <= 1 && PERIOD_FOLLOWUP.includes(ctx.lastIntent)) return { intent: 'followup_period' }
    if ((e.category || e.account) && leftoverWords(e).length <= 1 && FILTER_FOLLOWUP.includes(ctx.lastIntent)) return { intent: 'followup_filter' }
  }

  if (!top || top.score < 5) {
    if (searchArticles(e.t, 1).length > 0) return { intent: 'knowledge' }
    // Só uma categoria ou um período, sem contexto: provavelmente quer saber os gastos.
    if (!top && (e.category || e.periods.length > 0) && leftoverWords(e).length <= 1 && e.amounts.length === 0) return { intent: 'expenses_total' }
    return { intent: top && top.score >= 4 ? top.id : 'unknown' }
  }

  const second = ranked[1]
  if (second && top.score - second.score < 0.6 && isConflict(top.id, second.id)) {
    return { intent: 'clarify', choices: [top, second] }
  }
  // Pergunta conceitual ("o que é CDB?") vence consulta fraca.
  if (top.id !== 'knowledge' && ranked.some((r) => r.id === 'knowledge') && top.score < 7 && searchArticles(e.t, 1).length > 0) {
    return { intent: 'knowledge' }
  }
  return { intent: top.id }
}

function applyResult(ctx: ConversationContext, intent: IntentId, r: HandlerResult): ConversationContext {
  const next: ConversationContext = { ...ctx, turns: ctx.turns + 1 }
  const queryLike = !['greeting', 'thanks', 'help', 'identity', 'unknown', 'clarify', 'knowledge', 'navigate'].includes(intent)
  if (queryLike && !DRAFT_INTENTS.includes(intent) && intent !== 'confirm' && intent !== 'cancel' && intent !== 'slot_answer') {
    next.lastIntent = intent
  }
  if (r.memo) {
    if (Array.isArray(r.memo)) {
      next.previous = r.memo[0]
      next.last = r.memo[1]
    } else {
      next.previous = ctx.last
      next.last = r.memo
    }
  }
  if (r.period !== undefined) next.lastPeriod = r.period
  if (r.filters) next.lastFilters = r.filters
  if (r.pendingDrafts !== undefined) next.pendingDrafts = r.pendingDrafts
  next.awaiting = r.awaiting === undefined ? null : r.awaiting
  return next
}

/** Ponto de entrada do assistente. */
export async function respond(message: string, ctx: ConversationContext, ds: DataSource): Promise<{ reply: Reply; ctx: ConversationContext }> {
  const trimmed = message.trim().slice(0, 1000)
  if (!trimmed) {
    const r = await STATIC.help({} as Entities, ctx, ds)
    return { reply: r.reply, ctx }
  }

  let e = await buildEntities(trimmed, ds)

  // Resposta a uma pergunta em aberto (valor, descrição, conta...).
  if (ctx.awaiting) {
    const slot = await answerSlot(e, ctx)
    if (slot) return { reply: slot.reply, ctx: applyResult(ctx, 'slot_answer', slot) }
  }

  const decision = decide(e, ctx)
  let intent = decision.intent

  // Perguntas sobre o que vem pela frente: meses sem ano apontam para o futuro.
  if (['bills_due', 'receivables', 'forecast'].includes(intent) && e.periods.some((p) => p.kind === 'month')) {
    e = await buildEntities(trimmed, ds, 'future')
  }

  let handler: Handler | undefined
  if (intent === 'clarify') handler = clarifyHandler(decision.choices ?? [])
  else if (intent === 'followup_period' || intent === 'followup_filter') {
    const target = ctx.lastIntent!
    const merged: Entities = {
      ...e,
      period: intent === 'followup_period' ? e.period : e.period ?? ctx.lastPeriod,
      category:
        e.category ??
        (intent === 'followup_period' && ctx.lastFilters.categoryId ? syntheticCategory(e, ctx.lastFilters.categoryId) : null),
      account:
        e.account ?? (intent === 'followup_period' && ctx.lastFilters.accountId ? syntheticAccount(e, ctx.lastFilters.accountId) : null),
    }
    if (intent === 'followup_filter' && !e.periods.length && ctx.lastPeriod) merged.periods = []
    e = merged
    intent = target
    handler = ANSWERS[target]
  } else if (DRAFT_INTENTS.includes(intent)) handler = (en, c, d) => registerFlow(intent, en, c, d)
  else handler = ANSWERS[intent] ?? STATIC[intent]

  if (!handler) handler = STATIC.unknown
  try {
    const result = await handler(e, ctx, ds)
    return { reply: result.reply, ctx: applyResult(ctx, intent, result) }
  } catch {
    return {
      reply: {
        intent: 'unknown',
        blocks: [{ type: 'text', text: 'Não consegui consultar seus dados agora. Verifique sua conexão e tente de novo.' }],
      },
      ctx,
    }
  }
}

function syntheticCategory(e: Entities, id: string): CategoryMatch | null {
  const c = e.categories.find((x) => x.id === id)
  return c ? { category: c, via: 'name', keyword: c.name, start: 0, end: 0 } : null
}

function syntheticAccount(e: Entities, id: string): AccountMatch | null {
  const a = e.accounts.find((x) => x.id === id)
  return a ? { account: a, start: 0, end: 0 } : null
}

const CLARIFY_LABEL: Partial<Record<IntentId, { label: string; message: string }>> = {
  card_invoice: { label: 'Fatura do cartão', message: 'Quanto está a fatura do cartão?' },
  card_limit: { label: 'Limite disponível', message: 'Qual o limite disponível do cartão?' },
  balance: { label: 'Saldo das contas', message: 'Qual meu saldo?' },
  savings: { label: 'Resultado do mês', message: 'Quanto sobrou neste mês?' },
  bills_due: { label: 'Contas a pagar', message: 'Quais contas preciso pagar?' },
  debts: { label: 'Dívidas cadastradas', message: 'Quanto estou devendo?' },
  expenses_total: { label: 'Despesas', message: 'Quanto gastei este mês?' },
  income_total: { label: 'Receitas', message: 'Quanto recebi este mês?' },
  register_expense: { label: 'Registrar despesa', message: 'Registrar uma despesa' },
  register_income: { label: 'Registrar receita', message: 'Registrar uma receita' },
  knowledge: { label: 'Como funciona o cartão', message: 'O que é cartão de crédito?' },
  accounts_list: { label: 'Saldo de cada conta', message: 'Quanto tenho em cada conta?' },
}

function clarifyHandler(options: Array<{ id: IntentId }>): Handler {
  return async () => ({
    reply: {
      intent: 'clarify',
      blocks: [{ type: 'text', text: 'Fiquei em dúvida sobre o que você quer saber. Qual destas opções?' }],
      choices: options
        .map((o) => CLARIFY_LABEL[o.id])
        .filter((c): c is { label: string; message: string } => Boolean(c)),
    },
  })
}
