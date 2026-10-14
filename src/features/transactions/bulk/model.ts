import { buildSeries } from '../series'
import { effectiveStatus, SERIES_LIMITS, seriesAllowed, seriesFuturePending, validateTransaction } from '../validate'
import type { TransactionKind, TransactionStatus } from '../summary'

/*
  Lógica do lançamento em massa (sem React). Cada linha da planilha guarda o texto digitado; aqui ela é
  interpretada e validada com AS MESMAS regras do formulário individual (validateTransaction, situação no
  cartão, buildSeries e limites de repetição). Nada é adivinhado: o que não for claro vira erro na célula.
*/

export type RepeatMode = 'none' | 'installment' | 'recurring'

export type BulkRow = {
  id: string
  /** Data como digitada: DD/MM/AAAA. */
  date: string
  kind: TransactionKind
  description: string
  /** Valor como digitado: 1.250,90. */
  amount: string
  /** '' = sem conta. Em transferências, é a conta de origem. */
  accountId: string
  categoryId: string
  /** Só transferências. */
  transferAccountId: string
  status: TransactionStatus
  repeat: RepeatMode
  count: string
  notes: string
  /** Textos colados que não correspondem a nada conhecido (mostrados como erro, nunca descartados em silêncio). */
  unmatched?: Partial<Record<'kind' | 'account' | 'category' | 'transferAccount' | 'status' | 'repeat', string>>
}

export type Field = 'date' | 'kind' | 'description' | 'amount' | 'account' | 'category' | 'transferAccount' | 'status' | 'repeat' | 'count' | 'notes'

export type AccountRef = { id: string; name: string; type: string; archived: boolean }
export type CategoryRef = { id: string; name: string; kind: 'expense' | 'income'; archived: boolean }
export type BulkContext = { accounts: AccountRef[]; categories: CategoryRef[]; today: string }

export type RowState = 'empty' | 'incomplete' | 'error' | 'valid'

export type ParsedRow = {
  kind: TransactionKind
  description: string
  amount: number
  occurredOn: string
  categoryId: string | null
  accountId: string | null
  transferAccountId: string | null
  status: TransactionStatus
  onCard: boolean
  series: { kind: 'installment' | 'recurring'; count: number } | null
  notes: string
}

export type RowEvaluation = {
  state: RowState
  /** Erros e pendências por célula, em português. */
  errors: Partial<Record<Field, string>>
  parsed: ParsedRow | null
}

export const KIND_LABEL: Record<TransactionKind, string> = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }

/** Rótulos da situação conforme o tipo (paga/a pagar, recebida/a receber, feita/agendada). */
export const STATUS_LABEL: Record<TransactionKind, Record<TransactionStatus, string>> = {
  expense: { paid: 'Paga', pending: 'A pagar' },
  income: { paid: 'Recebida', pending: 'A receber' },
  transfer: { paid: 'Feita', pending: 'Agendada' },
}

export const REPEAT_LABEL: Record<RepeatMode, string> = { none: 'Não', installment: 'Parcelado', recurring: 'Todo mês' }

let seq = 0
export function newRowId(): string {
  seq += 1
  return `r${Date.now().toString(36)}${seq}`
}

export function emptyRow(defaults: Partial<BulkRow> = {}): BulkRow {
  return {
    id: newRowId(),
    date: '',
    kind: 'expense',
    description: '',
    amount: '',
    accountId: '',
    categoryId: '',
    transferAccountId: '',
    status: 'paid',
    repeat: 'none',
    count: '',
    notes: '',
    ...defaults,
  }
}

export function isoToBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ---------------------------------------------------------------------------
// Datas e valores (formato brasileiro, sem adivinhação)
// ---------------------------------------------------------------------------

/** "05/10/2026" → "2026-10-05". Aceita também "2026-10-05". Nunca troca dia e mês. */
export function parseDateBR(input: string): { iso: string } | { error: string } | null {
  const s = input.trim()
  if (!s) return null
  let y: number, m: number, d: number
  let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (match) {
    d = Number(match[1])
    m = Number(match[2])
    y = Number(match[3])
  } else if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) {
    y = Number(match[1])
    m = Number(match[2])
    d = Number(match[3])
  } else {
    return { error: 'Use o formato DD/MM/AAAA.' }
  }
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return { error: 'Data inexistente.' }
  const last = new Date(y, m, 0).getDate()
  if (d > last) return { error: 'Data inexistente.' }
  return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

/**
 * Valor em reais, calculado em centavos (sem ponto flutuante).
 * Aceita 1.250,90 · 1250,90 · 1250 · R$ 12 · 1250.90 · 1,250.90.
 * "1.234" ou "1,234" (um separador seguido de três dígitos) é ambíguo: vira erro, não um palpite.
 */
export function parseAmountBR(input: string): { cents: number } | { error: string } | null {
  const s = input.replace(/\s| /g, '').replace(/^R\$/i, '')
  if (!s) return null
  if (s.startsWith('-')) return { error: 'O valor deve ser maior que zero.' }
  let intPart: string
  let decPart = ''
  let m: RegExpExecArray | null
  if ((m = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(s)) && (m[2] !== undefined || (s.match(/\./g) ?? []).length > 1)) {
    intPart = m[1].replace(/\./g, '')
    decPart = m[2] ?? ''
  } else if ((m = /^(\d{1,3}(?:,\d{3})+)\.(\d{1,2})$/.exec(s))) {
    intPart = m[1].replace(/,/g, '')
    decPart = m[2]
  } else if (/^\d{1,3}[.,]\d{3}$/.test(s)) {
    return { error: `Valor ambíguo: escreva ${s.replace(/[.,]/, '.')},00 para milhar ou use vírgula para centavos.` }
  } else if ((m = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(s))) {
    intPart = m[1]
    decPart = m[2] ?? ''
  } else {
    return { error: 'Valor inválido. Exemplo: 1.250,90' }
  }
  const cents = Number(intPart) * 100 + Number((decPart + '00').slice(0, 2))
  if (!Number.isSafeInteger(cents)) return { error: 'Valor inválido.' }
  return { cents }
}

export function formatAmountBR(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
}

// ---------------------------------------------------------------------------
// Avaliação de uma linha
// ---------------------------------------------------------------------------

function isBlank(row: BulkRow): boolean {
  return !row.description.trim() && !row.amount.trim() && !row.notes.trim() && !row.unmatched
}

export function evaluateRow(row: BulkRow, ctx: BulkContext): RowEvaluation {
  if (isBlank(row)) return { state: 'empty', errors: {}, parsed: null }
  const errors: Partial<Record<Field, string>> = {}
  let missing = false

  // Textos colados sem correspondência.
  const u = row.unmatched ?? {}
  if (u.kind) errors.kind = `Tipo “${u.kind}” não reconhecido. Use Despesa, Receita ou Transferência.`
  if (u.status) errors.status = `Situação “${u.status}” não reconhecida.`
  if (u.repeat) errors.repeat = `Repetição “${u.repeat}” não reconhecida. Use Não, Parcelado ou Todo mês.`

  // Data
  const date = parseDateBR(row.date)
  let occurredOn = ''
  if (!date) {
    errors.date = 'Informe a data.'
    missing = true
  } else if ('error' in date) errors.date = date.error
  else occurredOn = date.iso

  // Descrição
  const description = row.description.trim()
  if (!description) {
    errors.description = 'Informe a descrição.'
    missing = true
  } else if (description.length > 140) errors.description = 'A descrição pode ter até 140 caracteres.'

  // Valor
  const amount = parseAmountBR(row.amount)
  let cents = 0
  if (!amount) {
    errors.amount = 'Informe o valor.'
    missing = true
  } else if ('error' in amount) errors.amount = amount.error
  else if (amount.cents <= 0) errors.amount = 'O valor deve ser maior que zero.'
  else cents = amount.cents

  // Conta (origem)
  const account = row.accountId ? ctx.accounts.find((a) => a.id === row.accountId) : undefined
  if (u.account) errors.account = `Conta “${u.account}” não encontrada neste espaço.`
  else if (row.accountId && !account) errors.account = 'Conta não encontrada neste espaço.'
  else if (account?.archived) errors.account = `A conta ${account.name} está arquivada.`
  const onCard = account?.type === 'credit_card'

  // Categoria ou conta de destino
  let categoryId: string | null = null
  let transferAccountId: string | null = null
  if (row.kind === 'transfer') {
    if (!row.accountId && !u.account) {
      errors.account = 'Escolha a conta de origem.'
      missing = true
    }
    const dest = row.transferAccountId ? ctx.accounts.find((a) => a.id === row.transferAccountId) : undefined
    if (u.transferAccount) errors.transferAccount = `Conta “${u.transferAccount}” não encontrada neste espaço.`
    else if (!row.transferAccountId) {
      errors.transferAccount = 'Escolha a conta de destino.'
      missing = true
    } else if (!dest) errors.transferAccount = 'Conta não encontrada neste espaço.'
    else if (dest.archived) errors.transferAccount = `A conta ${dest.name} está arquivada.`
    else if (row.transferAccountId === row.accountId) errors.transferAccount = 'A conta de origem e a de destino precisam ser diferentes.'
    transferAccountId = row.transferAccountId || null
  } else {
    if (u.category) errors.category = `Categoria “${u.category}” não encontrada para ${row.kind === 'expense' ? 'despesas' : 'receitas'}.`
    else if (row.categoryId) {
      const cat = ctx.categories.find((c) => c.id === row.categoryId)
      if (!cat) errors.category = 'Categoria não encontrada neste espaço.'
      else if (cat.kind !== row.kind) errors.category = `${cat.name} é uma categoria de ${cat.kind === 'expense' ? 'despesa' : 'receita'}.`
      else if (cat.archived) errors.category = `A categoria ${cat.name} está arquivada.`
      else categoryId = cat.id
    }
  }

  // Repetição
  let series: ParsedRow['series'] = null
  if (row.repeat !== 'none') {
    const limits = SERIES_LIMITS[row.repeat]
    if (!seriesAllowed(row.kind, row.repeat)) errors.repeat = 'Transferência não pode ser parcelada.'
    const count = Number(row.count.trim())
    if (!row.count.trim()) {
      errors.count = row.repeat === 'installment' ? 'Informe o número de parcelas.' : 'Informe por quantos meses.'
      missing = true
    } else if (!Number.isInteger(count) || count < limits.min || count > limits.max) {
      errors.count = row.repeat === 'installment' ? `Parcelas: de ${limits.min} a ${limits.max}.` : `Meses: de ${limits.min} a ${limits.max}.`
    } else series = { kind: row.repeat, count }
  }

  if (row.notes.length > 500) errors.notes = 'As observações podem ter até 500 caracteres.'

  const hasErrors = Object.keys(errors).length > 0
  // Erros que não são só "falta preencher".
  const onlyMissing =
    missing &&
    Object.entries(errors).every(([, msg]) => /^(Informe|Escolha)/.test(msg ?? ''))
  if (hasErrors) return { state: onlyMissing ? 'incomplete' : 'error', errors, parsed: null }

  const parsed: ParsedRow = {
    kind: row.kind,
    description,
    amount: cents / 100,
    occurredOn,
    categoryId,
    accountId: row.accountId || null,
    transferAccountId,
    status: effectiveStatus(row.kind, onCard, row.status),
    onCard,
    series,
    notes: row.notes.trim(),
  }
  // Conferência final com a mesma função do formulário individual.
  const problem = validateTransaction({
    kind: parsed.kind,
    amount: parsed.amount,
    description: parsed.description,
    occurredOn: parsed.occurredOn,
    accountId: parsed.accountId,
    transferAccountId: parsed.transferAccountId,
  })
  if (problem) return { state: 'error', errors: { description: problem }, parsed: null }
  return { state: 'valid', errors: {}, parsed }
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export type BulkSummary = {
  valid: number
  incomplete: number
  errors: number
  /** Valores como informados nas linhas (parcelado = total da compra; todo mês = valor de um mês). */
  income: number
  expense: number
  transfer: number
  result: number
  /** Quantas movimentações serão criadas, contando cada parcela e cada mês. */
  generated: number
  futureInstallments: number
  futureRecurrences: number
  /** Totais considerando todas as repetições (todo mês × meses). */
  generatedIncome: number
  generatedExpense: number
  generatedTransfer: number
}

export function summarize(rows: BulkRow[], ctx: BulkContext): BulkSummary {
  const s = { valid: 0, incomplete: 0, errors: 0, income: 0, expense: 0, transfer: 0, generated: 0, futureInstallments: 0, futureRecurrences: 0, gi: 0, ge: 0, gt: 0 }
  for (const row of rows) {
    const ev = evaluateRow(row, ctx)
    if (ev.state === 'incomplete') s.incomplete++
    else if (ev.state === 'error') s.errors++
    if (ev.state !== 'valid' || !ev.parsed) continue
    const p = ev.parsed
    s.valid++
    const c = Math.round(p.amount * 100)
    const n = p.series?.count ?? 1
    const generatedCents = p.series?.kind === 'recurring' ? c * n : c
    if (p.kind === 'income') {
      s.income += c
      s.gi += generatedCents
    } else if (p.kind === 'expense') {
      s.expense += c
      s.ge += generatedCents
    } else {
      s.transfer += c
      s.gt += generatedCents
    }
    s.generated += n
    if (p.series?.kind === 'installment') s.futureInstallments += n - 1
    if (p.series?.kind === 'recurring') s.futureRecurrences += n - 1
  }
  return {
    valid: s.valid,
    incomplete: s.incomplete,
    errors: s.errors,
    income: s.income / 100,
    expense: s.expense / 100,
    transfer: s.transfer / 100,
    result: (s.income - s.expense) / 100,
    generated: s.generated,
    futureInstallments: s.futureInstallments,
    futureRecurrences: s.futureRecurrences,
    generatedIncome: s.gi / 100,
    generatedExpense: s.ge / 100,
    generatedTransfer: s.gt / 100,
  }
}

// ---------------------------------------------------------------------------
// Linhas para gravar (mesma geração de séries do formulário)
// ---------------------------------------------------------------------------

export type BatchRow = {
  kind: TransactionKind
  description: string
  amount: number
  occurred_on: string
  category_id: string | null
  account_id: string | null
  transfer_account_id: string | null
  status: TransactionStatus
  notes: string | null
  series_id: string | null
  series_kind: 'installment' | 'recurring' | null
  series_index: number | null
  series_total: number | null
  /** Posição dentro do lote (vira external_ref = lote:<id>:<ref>). */
  ref: string
}

export function buildBatch(rows: BulkRow[], ctx: BulkContext, newId: () => string): BatchRow[] {
  const out: BatchRow[] = []
  rows.forEach((row, i) => {
    const ev = evaluateRow(row, ctx)
    if (ev.state !== 'valid' || !ev.parsed) return
    const p = ev.parsed
    const base = {
      kind: p.kind,
      description: p.description,
      category_id: p.kind === 'transfer' ? null : p.categoryId,
      account_id: p.accountId,
      transfer_account_id: p.kind === 'transfer' ? p.transferAccountId : null,
      notes: p.notes || null,
    }
    if (!p.series) {
      out.push({ ...base, amount: p.amount, occurred_on: p.occurredOn, status: p.status, series_id: null, series_kind: null, series_index: null, series_total: null, ref: `${i + 1}` })
      return
    }
    const seriesId = newId()
    const items = buildSeries({
      kind: p.series.kind,
      amount: p.amount,
      count: p.series.count,
      start: p.occurredOn,
      status: p.status,
      futurePending: seriesFuturePending(p.kind, p.onCard),
      today: ctx.today,
    })
    for (const item of items) {
      out.push({
        ...base,
        amount: item.amount,
        occurred_on: item.occurredOn,
        status: item.status,
        series_id: seriesId,
        series_kind: p.series.kind,
        series_index: item.index,
        series_total: p.series.count,
        ref: `${i + 1}:${item.index}`,
      })
    }
  })
  return out
}

// ---------------------------------------------------------------------------
// Possíveis duplicados (alerta, nunca bloqueio)
// ---------------------------------------------------------------------------

export type ExistingTx = { occurred_on: string; amount: number; description: string; account_id: string | null }

export type DuplicateHint = { rowIndex: number; kind: 'sheet' | 'existing'; withRow?: number }

function normText(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function dupKey(date: string, amount: number, description: string, accountId: string | null) {
  return `${date}|${Math.round(amount * 100)}|${normText(description)}|${accountId ?? ''}`
}

/** Mesma data + mesmo valor + mesma descrição + mesma conta, dentro da planilha ou já gravado. */
export function findDuplicates(rows: BulkRow[], ctx: BulkContext, existing: ExistingTx[]): DuplicateHint[] {
  const hints: DuplicateHint[] = []
  const seen = new Map<string, number>()
  const existingKeys = new Set(existing.map((t) => dupKey(t.occurred_on, Number(t.amount), t.description, t.account_id)))
  rows.forEach((row, i) => {
    const ev = evaluateRow(row, ctx)
    if (ev.state !== 'valid' || !ev.parsed) return
    const p = ev.parsed
    // Para séries, compara a primeira ocorrência (é o que foi digitado).
    const firstAmount = p.series?.kind === 'installment' ? buildSeries({ kind: 'installment', amount: p.amount, count: p.series.count, start: p.occurredOn, status: p.status, today: ctx.today })[0].amount : p.amount
    const key = dupKey(p.occurredOn, firstAmount, p.description, p.accountId)
    if (seen.has(key)) hints.push({ rowIndex: i, kind: 'sheet', withRow: seen.get(key)! })
    else seen.set(key, i)
    if (existingKeys.has(key)) hints.push({ rowIndex: i, kind: 'existing' })
  })
  return hints
}

// ---------------------------------------------------------------------------
// Colar da planilha (Excel, Google Planilhas: colunas separadas por tabulação)
// ---------------------------------------------------------------------------

/** Ordem das colunas para colagem (igual à da tela). Em transferências, "categoria" é a conta de destino. */
export const PASTE_COLUMNS = ['date', 'kind', 'description', 'amount', 'account', 'category', 'status', 'repeat', 'notes'] as const
export type PasteColumn = (typeof PASTE_COLUMNS)[number]

const HEADER_WORDS = /^(data|tipo|descri[cç][aã]o|valor|conta|categoria|situa[cç][aã]o|repeti[cç][aã]o|observa[cç][oõ]es|destino)$/i

function parseKind(s: string): TransactionKind | null {
  const t = normText(s)
  if (/^(despesa|despesas|saida|gasto|debito|d)$/.test(t)) return 'expense'
  if (/^(receita|receitas|entrada|ganho|credito|r)$/.test(t)) return 'income'
  if (/^(transferencia|transferencias|transf|t)$/.test(t)) return 'transfer'
  return null
}

function parseStatus(s: string): TransactionStatus | null {
  const t = normText(s)
  if (/^(paga|pago|recebida|recebido|feita|feito|sim|ok|realizada|concluida)$/.test(t)) return 'paid'
  if (/^(a pagar|a receber|agendada|agendado|pendente|nao|em aberto|aberto|prevista)$/.test(t)) return 'pending'
  return null
}

function parseRepeat(s: string): { mode: RepeatMode; count: string } | null {
  const t = normText(s)
  if (!t || /^(nao|nenhuma|-|unica|avulsa)$/.test(t)) return { mode: 'none', count: '' }
  const n = /(\d{1,3})/.exec(t)?.[1] ?? ''
  if (/parcel|\d+ ?x\b|vezes/.test(t)) return { mode: 'installment', count: n }
  if (/todo mes|mensal|recorrente|meses/.test(t)) return { mode: 'recurring', count: n }
  return null
}

function findByName<T extends { name: string; archived: boolean }>(items: T[], name: string): T | undefined {
  const n = normText(name)
  const active = items.filter((x) => !x.archived)
  return active.find((x) => normText(x.name) === n)
}

/** Aplica uma célula colada a uma linha (sem adivinhar: o que não casar fica em `unmatched`). */
function applyCell(row: BulkRow, column: PasteColumn, raw: string, ctx: BulkContext): BulkRow {
  const value = raw.trim()
  const unmatched = { ...(row.unmatched ?? {}) }
  const next: BulkRow = { ...row }
  const clear = (k: keyof NonNullable<BulkRow['unmatched']>) => delete unmatched[k]
  switch (column) {
    case 'date':
      next.date = value
      break
    case 'kind': {
      clear('kind')
      if (!value) break
      const k = parseKind(value)
      if (k) next.kind = k
      else unmatched.kind = value
      break
    }
    case 'description':
      next.description = value.slice(0, 140)
      break
    case 'amount': {
      // Mostra já formatado quando não há ambiguidade; senão mantém o texto e a célula acusa o erro.
      const a = parseAmountBR(value)
      next.amount = a && 'cents' in a ? formatAmountBR(a.cents) : value
      break
    }
    case 'account': {
      clear('account')
      next.accountId = ''
      if (!value) break
      const a = findByName(ctx.accounts, value)
      if (a) next.accountId = a.id
      else unmatched.account = value
      break
    }
    case 'category': {
      clear('category')
      clear('transferAccount')
      next.categoryId = ''
      next.transferAccountId = ''
      if (!value) break
      if (next.kind === 'transfer') {
        const a = findByName(ctx.accounts, value)
        if (a) next.transferAccountId = a.id
        else unmatched.transferAccount = value
      } else {
        const c = findByName(
          ctx.categories.filter((x) => x.kind === next.kind),
          value,
        )
        if (c) next.categoryId = c.id
        else unmatched.category = value
      }
      break
    }
    case 'status': {
      clear('status')
      if (!value) break
      const st = parseStatus(value)
      if (st) next.status = st
      else unmatched.status = value
      break
    }
    case 'repeat': {
      clear('repeat')
      const r = parseRepeat(value)
      if (r) {
        next.repeat = r.mode
        next.count = r.count
      } else unmatched.repeat = value
      break
    }
    case 'notes':
      next.notes = value.slice(0, 500)
      break
  }
  next.unmatched = Object.keys(unmatched).length ? unmatched : undefined
  return next
}

/** Divide o texto colado em linhas e colunas. Devolve null quando é um valor simples (colagem normal). */
export function splitPaste(text: string): string[][] | null {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (!normalized.includes('\t') && !normalized.includes('\n')) return null
  const lines = normalized.split('\n').map((l) => l.split('\t'))
  // Ignora a linha de cabeçalho, se vier junto.
  if (lines.length && lines[0].filter((c) => c.trim()).every((c) => HEADER_WORDS.test(c.trim()))) lines.shift()
  return lines
}

/**
 * Distribui células coladas a partir da linha `startRow` e da coluna `startColumn`, criando linhas novas
 * quando necessário. Colunas extras além de "Observações" são ignoradas (e contadas no retorno).
 */
export function applyPaste(
  rows: BulkRow[],
  startRow: number,
  startColumn: PasteColumn,
  grid: string[][],
  ctx: BulkContext,
): { rows: BulkRow[]; changed: number; ignoredColumns: number } {
  const next = [...rows]
  const startCol = PASTE_COLUMNS.indexOf(startColumn)
  let ignoredColumns = 0
  grid.forEach((cells, r) => {
    const index = startRow + r
    while (next.length <= index) next.push(emptyRow({ date: next[next.length - 1]?.date ?? '' }))
    let row = next[index]
    // O tipo define como ler a coluna de categoria/destino: aplica primeiro.
    const kindPos = PASTE_COLUMNS.indexOf('kind') - startCol
    if (kindPos >= 0 && kindPos < cells.length) row = applyCell(row, 'kind', cells[kindPos], ctx)
    cells.forEach((cell, c) => {
      const col = PASTE_COLUMNS[startCol + c]
      if (!col) {
        if (cell.trim()) ignoredColumns = Math.max(ignoredColumns, startCol + c - PASTE_COLUMNS.length + 1)
        return
      }
      if (col !== 'kind') row = applyCell(row, col, cell, ctx)
    })
    next[index] = row
  })
  return { rows: next, changed: grid.length, ignoredColumns }
}
