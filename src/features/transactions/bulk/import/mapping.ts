import { excelSerialToISO, type XlsxCell } from './xlsx'

/*
  Interpretação de planilhas de extrato e fatura (CSV/XLSX): detecção do cabeçalho e das colunas,
  do formato de data e de número, e leitura das linhas. Tudo determinístico; o usuário confirma ou ajusta
  as escolhas antes de importar. Quando algo é ambíguo, a linha é ignorada com o motivo — nunca adivinhada.
*/

export type Cell = XlsxCell
export type Grid = Cell[][]

export type Roles = {
  date: number | null
  description: number | null
  /** Valor único, com sinal. */
  amount: number | null
  /** Colunas separadas de crédito e débito (alternativa a `amount`). */
  credit: number | null
  debit: number | null
  /** Coluna com C/D, Crédito/Débito, Entrada/Saída. */
  type: number | null
}

export type DateFormat = 'dmy' | 'mdy'
export type NumberFormat = 'br' | 'us'
/** Extrato: negativo = saída. Fatura: positivo = compra (saída). */
export type SignMode = 'negative-is-out' | 'positive-is-out'

export type MappingOptions = {
  headerRow: number | null
  roles: Roles
  dateFormat: DateFormat
  numberFormat: NumberFormat
  signMode: SignMode
}

export type ImportedTx = { date: string; description: string; cents: number; direction: 'out' | 'in'; line: number }
export type SkippedLine = { line: number; reason: string }

export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const HEADER: Record<keyof Roles, RegExp> = {
  date: /^(data|date|dt|data (do )?(lancamento|movimento|mov|compra|transacao|operacao)|data lanc|dia)$/,
  description: /^(descricao|historico|lancamento|lancamentos|estabelecimento|title|titulo|memo|detalhe|detalhes|descricao do lancamento|nome|movimentacao|transacao|description|identificacao|documento descricao)$/,
  amount: /^(valor|amount|valor r|valor em r|valor rs|quantia|montante|valor da transacao|valor do lancamento|value)$/,
  credit: /^(credito|creditos|entrada|entradas|valor credito|credito r|recebimentos)$/,
  debit: /^(debito|debitos|saida|saidas|valor debito|debito r|pagamentos)$/,
  type: /^(tipo|d c|c d|natureza|tipo de lancamento|tipo lancamento|operacao)$/,
}

const SKIP_DESCRIPTION = /^(saldo|s a l d o|saldo anterior|saldo do dia|saldo final|saldo inicial|saldo disponivel|saldo atual|total|subtotal|total da fatura|pagamento minimo|limite)\b/

function cellText(c: Cell | undefined): string {
  if (c === undefined || c === null) return ''
  return typeof c === 'number' ? String(c) : c.trim()
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

function validISO(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > new Date(y, m, 0).getDate()) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Data de uma célula. Números (XLSX) são lidos como série do Excel. Anos com 2 dígitos viram 20AA. */
export function parseDateCell(c: Cell | undefined, fmt: DateFormat): string | null {
  if (typeof c === 'number') return c > 20000 && c < 80000 ? excelSerialToISO(c) : null
  const s = cellText(c)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s)
  if (m) return validISO(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/.exec(s)
  if (!m) return null
  let y = Number(m[3])
  if (m[3].length === 2) y += 2000
  const a = Number(m[1])
  const b = Number(m[2])
  return fmt === 'dmy' ? validISO(y, b, a) : validISO(y, a, b)
}

/** Formato de data provável da coluna: dia/mês, a menos que algum valor só faça sentido como mês/dia. */
export function detectDateFormat(values: Cell[]): DateFormat {
  let dmyOk = 0
  let mdyOk = 0
  for (const v of values) {
    if (parseDateCell(v, 'dmy')) dmyOk++
    if (parseDateCell(v, 'mdy')) mdyOk++
  }
  return mdyOk > dmyOk ? 'mdy' : 'dmy'
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/** Formato numérico provável da coluna (só células de texto; números do XLSX não têm ambiguidade). */
export function detectNumberFormat(values: Cell[]): NumberFormat {
  let br = 0
  let us = 0
  for (const v of values) {
    if (typeof v === 'number') continue
    const s = v.replace(/[^\d.,]/g, '')
    if (/,\d{1,2}$/.test(s) || /\.\d{3},/.test(s)) br++
    else if (/\.\d{1,2}$/.test(s) || /,\d{3}\./.test(s)) us++
  }
  return us > br ? 'us' : 'br'
}

/**
 * Valor com sinal, em centavos, no formato da coluna (definido pelos outros valores dela e confirmado pelo
 * usuário). Entende "R$ -1.234,56", "(12,34)", "12,34-", "12,34 D", "12,34 C". Null quando vazio ou inválido.
 */
export function parseAmountCell(c: Cell | undefined, fmt: NumberFormat): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? Math.round(c * 100) : null
  let s = cellText(c).replace(/\u00A0/g, ' ')
  if (!s) return null
  let sign = 1
  if (/^\(.*\)$/.test(s)) {
    sign = -1
    s = s.slice(1, -1)
  }
  const suffix = /\s*([DC])$/i.exec(s)
  if (suffix) {
    if (suffix[1].toUpperCase() === 'D') sign = -sign
    s = s.slice(0, suffix.index)
  }
  s = s.replace(/R\$|\s/gi, '')
  if (s.endsWith('-')) {
    sign = -sign
    s = s.slice(0, -1)
  }
  if (s.startsWith('-')) {
    sign = -sign
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s)) return null
  let intPart: string
  let dec = ''
  if (fmt === 'br') {
    if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s)) return null
    ;[intPart, dec = ''] = s.replace(/\./g, '').split(',')
  } else {
    if (!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(s)) return null
    ;[intPart, dec = ''] = s.replace(/,/g, '').split('.')
  }
  if (dec.length > 2) {
    // Mais de 2 casas: arredonda pelos dígitos.
    const third = Number(dec[2])
    let cents = Number(intPart) * 100 + Number(dec.slice(0, 2))
    if (third >= 5) cents += 1
    return sign * cents
  }
  return sign * (Number(intPart) * 100 + Number((dec + '00').slice(0, 2)))
}

// ---------------------------------------------------------------------------
// Cabeçalho e colunas
// ---------------------------------------------------------------------------

function matchRole(text: string): keyof Roles | null {
  const t = norm(text)
  if (!t) return null
  for (const role of Object.keys(HEADER) as Array<keyof Roles>) if (HEADER[role].test(t)) return role
  return null
}

export function findHeaderRow(grid: Grid): number | null {
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const roles = grid[i].map((c) => (typeof c === 'string' ? matchRole(c) : null)).filter(Boolean)
    if (new Set(roles).size >= 2) return i
  }
  return null
}

const EMPTY_ROLES: Roles = { date: null, description: null, amount: null, credit: null, debit: null, type: null }

/** Sugere as colunas a partir do cabeçalho; sem cabeçalho, pelo conteúdo. */
export function detectRoles(grid: Grid, headerRow: number | null): Roles {
  const roles: Roles = { ...EMPTY_ROLES }
  if (headerRow !== null) {
    grid[headerRow].forEach((c, i) => {
      const role = typeof c === 'string' ? matchRole(c) : null
      if (role && roles[role] === null) roles[role] = i
    })
  }
  const data = grid.slice(headerRow === null ? 0 : headerRow + 1, (headerRow ?? -1) + 41)
  const width = Math.max(0, ...grid.map((r) => r.length))
  const share = (col: number, test: (c: Cell) => boolean) => {
    const vals = data.map((r) => r[col]).filter((c) => cellText(c) !== '')
    return vals.length ? vals.filter(test).length / vals.length : 0
  }
  const used = () => new Set(Object.values(roles).filter((v): v is number => v !== null))
  if (roles.date === null) {
    for (let c = 0; c < width; c++) if (!used().has(c) && share(c, (v) => parseDateCell(v, 'dmy') !== null || parseDateCell(v, 'mdy') !== null) > 0.8) {
      roles.date = c
      break
    }
  }
  if (roles.amount === null && roles.credit === null && roles.debit === null) {
    for (let c = width - 1; c >= 0; c--) if (!used().has(c) && share(c, (v) => parseAmountCell(v, 'br') !== null || parseAmountCell(v, 'us') !== null) > 0.8) {
      roles.amount = c
      break
    }
  }
  if (roles.description === null) {
    let best = -1
    let bestLen = 0
    for (let c = 0; c < width; c++) {
      if (used().has(c)) continue
      const vals = data.map((r) => cellText(r[c])).filter((t) => t && !/^[\d.,\-+/ R$()]+$/.test(t))
      const avg = vals.length ? vals.reduce((s, t) => s + t.length, 0) / vals.length : 0
      if (avg > bestLen) {
        best = c
        bestLen = avg
      }
    }
    if (best >= 0) roles.description = best
  }
  return roles
}

export function suggestOptions(grid: Grid, signMode: SignMode): MappingOptions {
  const headerRow = findHeaderRow(grid)
  const roles = detectRoles(grid, headerRow)
  const data = grid.slice(headerRow === null ? 0 : headerRow + 1)
  const dateFormat = roles.date !== null ? detectDateFormat(data.map((r) => r[roles.date!])) : 'dmy'
  const amountCols = [roles.amount, roles.credit, roles.debit].filter((v): v is number => v !== null)
  const numberFormat = detectNumberFormat(data.flatMap((r) => amountCols.map((c) => r[c])))
  return { headerRow, roles, dateFormat, numberFormat, signMode }
}

// ---------------------------------------------------------------------------
// Leitura das linhas
// ---------------------------------------------------------------------------

function directionFromType(c: Cell | undefined): 'out' | 'in' | null {
  const t = norm(cellText(c))
  if (/^(d|deb|debito|saida|s|-|despesa|compra)$/.test(t)) return 'out'
  if (/^(c|cred|credito|entrada|e|\+|receita|deposito)$/.test(t)) return 'in'
  return null
}

export function readRows(grid: Grid, o: MappingOptions): { transactions: ImportedTx[]; skipped: SkippedLine[] } {
  const transactions: ImportedTx[] = []
  const skipped: SkippedLine[] = []
  const start = o.headerRow === null ? 0 : o.headerRow + 1
  const { roles } = o
  if (roles.date === null) return { transactions, skipped: [{ line: 0, reason: 'Escolha a coluna de data.' }] }
  if (roles.amount === null && roles.credit === null && roles.debit === null) {
    return { transactions, skipped: [{ line: 0, reason: 'Escolha a coluna de valor (ou de crédito e débito).' }] }
  }
  for (let i = start; i < grid.length; i++) {
    const row = grid[i]
    const line = i + 1
    const description = roles.description !== null ? cellText(row[roles.description]).replace(/\s+/g, ' ') : ''
    if (description && SKIP_DESCRIPTION.test(norm(description))) {
      skipped.push({ line, reason: 'linha de saldo ou total' })
      continue
    }
    const date = parseDateCell(row[roles.date], o.dateFormat)
    if (!date) {
      if (row.some((c) => cellText(c) !== '')) skipped.push({ line, reason: cellText(row[roles.date]) ? `data “${cellText(row[roles.date])}” não reconhecida` : 'sem data' })
      continue
    }
    let cents: number | null = null
    let direction: 'out' | 'in' | null = null
    if (roles.amount !== null) {
      cents = parseAmountCell(row[roles.amount], o.numberFormat)
      if (cents !== null) {
        const typed = roles.type !== null ? directionFromType(row[roles.type]) : null
        if (typed) direction = typed
        else direction = o.signMode === 'negative-is-out' ? (cents < 0 ? 'out' : 'in') : cents > 0 ? 'out' : 'in'
        cents = Math.abs(cents)
      }
    } else {
      const credit = roles.credit !== null ? parseAmountCell(row[roles.credit], o.numberFormat) : null
      const debit = roles.debit !== null ? parseAmountCell(row[roles.debit], o.numberFormat) : null
      if (debit !== null && debit !== 0) {
        cents = Math.abs(debit)
        direction = 'out'
      } else if (credit !== null && credit !== 0) {
        cents = Math.abs(credit)
        direction = 'in'
      }
    }
    if (cents === null || direction === null) {
      skipped.push({ line, reason: 'valor ausente ou não reconhecido' })
      continue
    }
    if (cents === 0) {
      skipped.push({ line, reason: 'valor zero' })
      continue
    }
    transactions.push({ date, description: description || 'Sem descrição', cents, direction, line })
  }
  return { transactions, skipped }
}
