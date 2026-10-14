import { effectiveStatus, validateTransaction } from '@/features/transactions/validate'
import { capitalize, normalizeText } from './normalize'
import { extractDescription, findAccountsByName, matchCategory, splitByAmounts, type Span } from './parse'
import { rankIntents } from './intents'
import { money, note, shortDate, text } from './format'
import { STATIC } from './static'
import type { Entities, HandlerResult } from './engine'
import type { AccountData, AccountOption, Awaiting, ConversationContext, DataSource, Draft, IntentId, TxKind } from './types'

/*
  Fluxos guiados de lançamento. O assistente só PREPARA o lançamento (rascunho) e mostra a prévia;
  nada é gravado sem o usuário tocar em CONFIRMAR. A gravação usa o mesmo serviço do formulário
  (useCreateTransaction) com um código único por rascunho, o que impede gravar duas vezes.
*/

export const DRAFT_INTENTS: IntentId[] = ['register_expense', 'register_income', 'register_transfer']

const MAX_ITEMS = 5
const MAX_INSTALLMENTS = 48
const MAX_RECURRING = 60
const isCard = (a: { type: string }) => a.type === 'credit_card'

function accountOptions(accounts: AccountData[], kind: TxKind): AccountOption[] {
  const active = accounts.filter((a) => !a.archived)
  const regular = active.filter((a) => !isCard(a))
  const cards = kind === 'expense' || kind === 'income' ? active.filter(isCard) : []
  return [...regular, ...cards].map((a) => ({ id: a.id, name: a.name, onCard: isCard(a) }))
}

function withAccount(d: Draft, option: AccountOption | null, today: string): Draft {
  const onCard = Boolean(option?.onCard)
  const status = d.occurredOn > today ? 'pending' : 'paid'
  return { ...d, accountId: option?.id ?? null, accountName: option?.id ? option.name : null, onCard, status: effectiveStatus(d.kind, onCard, status) }
}

function previewText(drafts: Draft[], today: string): string {
  if (drafts.length === 1) {
    const d = drafts[0]
    const what = d.kind === 'expense' ? 'despesa' : d.kind === 'income' ? 'receita' : 'transferência'
    return `Preparei a ${what} de **${money(d.amount)}** (${d.description}, ${shortDate(d.occurredOn, today)}). Confira e confirme:`
  }
  return `Preparei ${drafts.length} lançamentos, somando **${money(drafts.reduce((s, d) => s + Math.round(d.amount * 100), 0) / 100)}**. Confira e confirme:`
}

/** Verifica o que falta e pergunta, ou mostra a prévia quando está tudo certo. */
function finalize(drafts: Draft[], e: Entities, accountDecided: boolean): HandlerResult {
  const intent: IntentId = drafts[0].kind === 'expense' ? 'register_expense' : drafts[0].kind === 'income' ? 'register_income' : 'register_transfer'
  const first = drafts[0]

  if (drafts.some((d) => !(d.amount > 0))) {
    return {
      reply: { intent, blocks: [text(`Qual o valor${first.description ? ` de "${first.description}"` : ''}?`)], suggestions: [] },
      awaiting: { slot: 'amount', drafts, accountDecided },
    }
  }
  if (drafts.length === 1 && !first.description.trim()) {
    return {
      reply: { intent, blocks: [text(`Qual a descrição desse lançamento de ${money(first.amount)}?`)], suggestions: ['Mercado', 'Farmácia', 'Combustível'] },
      awaiting: { slot: 'description', drafts, accountDecided },
    }
  }
  if (first.kind === 'transfer') {
    if (!first.accountId) {
      const options = accountOptions(e.accounts, 'transfer').filter((o) => o.id !== first.transferAccountId)
      return transferAsk('transfer-from', drafts, options, 'De qual conta sai o dinheiro?')
    }
    if (!first.transferAccountId) {
      const options = e.accounts.filter((a) => !a.archived && a.id !== first.accountId).map((a) => ({ id: a.id, name: a.name, onCard: isCard(a) }))
      return transferAsk('transfer-to', drafts, options, 'Para qual conta vai o dinheiro?')
    }
  } else if (!accountDecided) {
    const options = accountOptions(e.accounts, first.kind)
    if (options.length === 1) drafts = drafts.map((d) => withAccount(d, options[0], e.today))
    else if (options.length > 1) {
      return {
        reply: {
          intent,
          blocks: [text(first.kind === 'expense' ? 'Em qual conta ou cartão foi esse gasto?' : 'Em qual conta entrou esse dinheiro?')],
          choices: [...options.map((o) => ({ label: o.name, message: o.name })), { label: 'Sem conta', message: 'sem conta' }],
        },
        awaiting: { slot: 'account', drafts, options: [...options, { id: null, name: 'Sem conta', onCard: false }], accountDecided: false },
      }
    }
  }

  // Validação com as mesmas regras do formulário.
  for (const d of drafts) {
    const problem = validateTransaction({
      kind: d.kind,
      amount: d.amount,
      description: d.description,
      occurredOn: d.occurredOn,
      accountId: d.accountId,
      transferAccountId: d.transferAccountId,
    })
    if (problem) return { reply: { intent, blocks: [text(`Não consegui preparar o lançamento: ${problem}`)] } }
  }

  const blocks = [text(previewText(drafts, e.today)), note('Nada foi salvo ainda. Revise os dados e toque em CONFIRMAR para registrar, ou em EDITAR para ajustar no formulário.')]
  return { reply: { intent, blocks, drafts }, pendingDrafts: drafts, awaiting: null }
}

function transferAsk(slot: 'transfer-from' | 'transfer-to', drafts: Draft[], options: AccountOption[], question: string): HandlerResult {
  if (options.length === 0) {
    return { reply: { intent: 'register_transfer', blocks: [text('Para transferir, você precisa ter pelo menos duas contas cadastradas.')], links: [{ label: 'Contas e cartões', to: '/contas' }] } }
  }
  return {
    reply: { intent: 'register_transfer', blocks: [text(question)], choices: options.map((o) => ({ label: o.name, message: o.name })) },
    awaiting: { slot, drafts, options },
  }
}

const RECURRING_RE = /\b(todo mes|todos os meses|mensal|mensalmente|por mes)\b(?: (?:durante|por) (\d{1,2}) meses)?|\b(?:durante|por) (\d{1,2}) meses\b/

function blankDraft(kind: TxKind, ds: DataSource, today: string): Draft {
  return {
    id: ds.newId(),
    kind,
    description: '',
    amount: 0,
    occurredOn: today,
    categoryId: null,
    categoryName: null,
    accountId: null,
    accountName: null,
    onCard: false,
    transferAccountId: null,
    transferAccountName: null,
    status: 'paid',
    series: null,
    spaceName: ds.space.name,
  }
}

export async function registerFlow(intent: IntentId, e: Entities, _ctx: ConversationContext, ds: DataSource): Promise<HandlerResult> {
  if (intent === 'register_transfer') return transferFlow(e, ds)
  const kind: TxKind = intent === 'register_income' ? 'income' : 'expense'

  if (e.date === 'invalid') {
    return { reply: { intent, blocks: [text('Essa data não existe. Pode informar de novo? Ex.: "ontem", "dia 5" ou "10/09".')] } }
  }
  const occurredOn = e.date ? e.date.iso : e.today
  const amounts = e.amounts
  if (amounts.length > MAX_ITEMS) return STATIC.bulk_entry(e, _ctx, ds)

  // Trechos que não fazem parte da descrição.
  const global: Span[] = [...e.periods]
  if (e.date) global.push(e.date)
  if (e.installments) global.push(e.installments)
  const recurring = RECURRING_RE.exec(e.t)
  if (recurring) global.push({ start: recurring.index, end: recurring.index + recurring[0].length })
  let accountDecided = false
  let accountOption: AccountOption | null = null
  let ambiguousOptions: AccountOption[] | null = null
  if (e.account) {
    global.push(e.account)
    if ('account' in e.account) {
      const a = e.account.account
      accountOption = { id: a.id, name: a.name, onCard: isCard(a) }
      accountDecided = true
    } else ambiguousOptions = e.account.ambiguous.map((a) => ({ id: a.id, name: a.name, onCard: isCard(a) }))
  }

  const segments = amounts.length ? splitByAmounts(e.t, amounts) : [{ start: 0, end: e.t.length, amount: null }]
  let drafts: Draft[] = segments.map((seg) => {
    const segText = e.t.slice(seg.start, seg.end)
    const cm = matchCategory(segText, e.categories, kind)
    const consumed: Span[] = [{ start: 0, end: seg.start }, { start: seg.end, end: e.t.length + 1 }, ...global]
    if (seg.amount) consumed.push(seg.amount)
    let description = extractDescription(e.n, consumed)
    if (!description && cm) description = cm.via === 'keyword' ? capitalize(cm.keyword) : cm.category.name
    if (!description && segments.length > 1) description = kind === 'expense' ? 'Despesa' : 'Receita'
    const d = blankDraft(kind, ds, e.today)
    return {
      ...d,
      description,
      amount: seg.amount?.value ?? 0,
      occurredOn,
      categoryId: cm?.category.id ?? null,
      categoryName: cm?.category.name ?? null,
      status: occurredOn > e.today ? 'pending' : 'paid',
    }
  })

  // Parcelas e repetição só valem para um lançamento por vez.
  if (drafts.length === 1) {
    const count = e.installments?.count ?? 0
    if (count >= 2 && kind === 'expense') {
      if (count > MAX_INSTALLMENTS) return { reply: { intent, blocks: [text(`O parcelamento pode ter até ${MAX_INSTALLMENTS} parcelas.`)] } }
      drafts[0].series = { kind: 'installment', count }
    } else if (recurring) {
      const n = Number(recurring[2] ?? recurring[3] ?? 12)
      drafts[0].series = { kind: 'recurring', count: Math.min(Math.max(n, 2), MAX_RECURRING) }
    }
  }

  if (accountOption) drafts = drafts.map((d) => withAccount(d, accountOption, e.today))
  if (ambiguousOptions) {
    return {
      reply: { intent, blocks: [text('Qual cartão?')], choices: ambiguousOptions.map((o) => ({ label: o.name, message: o.name })) },
      awaiting: { slot: 'account', drafts, options: ambiguousOptions, accountDecided: false },
    }
  }
  return finalize(drafts, e, accountDecided)
}

async function transferFlow(e: Entities, ds: DataSource): Promise<HandlerResult> {
  if (e.date === 'invalid') return { reply: { intent: 'register_transfer', blocks: [text('Essa data não existe. Pode informar de novo?')] } }
  const named = findAccountsByName(e.t, e.accounts)
  let from: AccountData | null = null
  let to: AccountData | null = null
  for (const m of named) {
    const before = e.t.slice(Math.max(0, m.start - 10), m.start)
    const acc = e.accounts.find((a) => a.id === m.account.id) ?? null
    if (/\b(para|pra|pro|p)\s*(o |a )?$/.test(before)) to = to ?? acc
    else from = from ?? acc
  }
  const d = blankDraft('transfer', ds, e.today)
  const occurredOn = e.date ? e.date.iso : e.today
  const draft: Draft = {
    ...d,
    amount: e.amounts[0]?.value ?? 0,
    occurredOn,
    status: occurredOn > e.today ? 'pending' : 'paid',
    accountId: from?.id ?? null,
    accountName: from?.name ?? null,
    transferAccountId: to?.id ?? null,
    transferAccountName: to?.name ?? null,
  }
  draft.description = transferDescription(draft, e.accounts)
  return finalize([draft], e, true)
}

function transferDescription(d: Draft, accounts: AccountData[]): string {
  const to = accounts.find((a) => a.id === d.transferAccountId)
  if (!to) return 'Transferência'
  return isCard(to) ? `Pagamento da fatura ${to.name}` : `Transferência para ${to.name}`
}

// ---------------------------------------------------------------------------
// Respostas a perguntas em aberto
// ---------------------------------------------------------------------------

function pickOption(e: Entities, options: AccountOption[]): AccountOption | null | undefined {
  const t = e.t
  if (/^(sem conta|nenhuma|nenhum|sem)\b/.test(t)) return options.find((o) => o.id === null) ?? null
  const idx = /^(\d{1,2})$/.exec(t)
  if (idx) return options[Number(idx[1]) - 1]
  const exact = options.find((o) => normalizeText(o.name) === t)
  if (exact) return exact
  const contains = options.filter((o) => o.id && t.includes(normalizeText(o.name)))
  return contains.length === 1 ? contains[0] : undefined
}

/** Trata a mensagem como resposta à pergunta em aberto. Devolve null quando é um assunto novo. */
export async function answerSlot(e: Entities, ctx: ConversationContext, _ds: DataSource): Promise<HandlerResult | null> {
  const aw = ctx.awaiting as Awaiting
  const words = e.n.tokens.length

  if (aw.slot === 'clear-history') {
    if (/^(sim|pode|confirm\w*|apag\w*|quero|isso)\b/.test(e.t)) {
      return { reply: { intent: 'clear_history', blocks: [], effect: { type: 'clear-history' } }, awaiting: null, pendingDrafts: [] }
    }
    if (/^(nao|cancel\w*|deixa)\b/.test(e.t)) return { reply: { intent: 'clear_history', blocks: [text('Certo, mantive o histórico.')] }, awaiting: null }
    return null
  }

  if (/^(cancel\w*|deixa( pra la)?|esquece|desist\w*|nao quero)\b/.test(e.t) && words <= 4) {
    return { reply: { intent: 'cancel', blocks: [text('Cancelado. Nada foi registrado.')] }, awaiting: null, pendingDrafts: [] }
  }

  // Uma pergunta nova e clara encerra a pergunta em aberto.
  const top = rankIntents(e.t, {
    explicitAmount: e.explicitAmounts.length > 0,
    anyAmount: e.amounts.length > 0,
    periods: e.periods.length,
    hasCategory: Boolean(e.category),
    hasAccount: Boolean(e.account),
    hasInstallments: false,
    hasPercent: e.percents.length > 0,
    hasDuration: Boolean(e.duration),
    question: e.question,
    words,
  })[0]
  const isNewTopic = top && top.score >= 7 && words > 2

  const drafts = aw.drafts
  switch (aw.slot) {
    case 'amount': {
      const value = e.amounts[0]?.value
      if (!value) {
        if (isNewTopic) return null
        return { reply: { intent: 'slot_answer', blocks: [text('Não reconheci o valor. Escreva só o número, por exemplo: 150,90')] }, awaiting: aw }
      }
      const next = drafts.map((d, i) => (i === drafts.findIndex((x) => !(x.amount > 0)) ? { ...d, amount: value } : d))
      return finalize(next, e, Boolean(aw.accountDecided))
    }
    case 'description': {
      if (isNewTopic) return null
      const description = capitalize(e.n.original.trim().replace(/\s+/g, ' ').slice(0, 140))
      if (!description) return { reply: { intent: 'slot_answer', blocks: [text('Qual a descrição?')] }, awaiting: aw }
      const cm = drafts[0].categoryId ? null : matchCategory(e.t, e.categories, drafts[0].kind === 'income' ? 'income' : 'expense')
      const next = drafts.map((d) => ({ ...d, description, categoryId: d.categoryId ?? cm?.category.id ?? null, categoryName: d.categoryName ?? cm?.category.name ?? null }))
      return finalize(next, e, Boolean(aw.accountDecided))
    }
    case 'account': {
      const option = pickOption(e, aw.options ?? [])
      if (option === undefined) {
        if (isNewTopic || words > 4) return null
        return {
          reply: { intent: 'slot_answer', blocks: [text('Não encontrei essa conta. Escolha uma das opções:')], choices: (aw.options ?? []).map((o) => ({ label: o.name, message: o.name })) },
          awaiting: aw,
        }
      }
      const next = drafts.map((d) => withAccount(d, option, e.today))
      return finalize(next, e, true)
    }
    case 'transfer-from':
    case 'transfer-to': {
      const option = pickOption(e, aw.options ?? [])
      if (!option || !option.id) {
        if (isNewTopic || words > 4) return null
        return {
          reply: { intent: 'slot_answer', blocks: [text('Escolha uma das contas:')], choices: (aw.options ?? []).map((o) => ({ label: o.name, message: o.name })) },
          awaiting: aw,
        }
      }
      const d = drafts[0]
      const updated: Draft =
        aw.slot === 'transfer-from' ? { ...d, accountId: option.id, accountName: option.name } : { ...d, transferAccountId: option.id, transferAccountName: option.name }
      updated.description = transferDescription(updated, e.accounts)
      return finalize([updated], e, true)
    }
  }
  return null
}
