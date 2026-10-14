import { parseMoneyInput } from '@/lib/money'
import { parseISODate, shiftMonth, todayISO, type YearMonth } from '@/lib/dates'
import { capitalize, escapeRe, normalize, type Normalized } from './normalize'

/*
  Extração de entidades (valores, datas, períodos, parcelas, categorias e contas) de mensagens em português.
  Tudo é determinístico: expressões regulares + listas de palavras. Nada é "adivinhado":
  quando algo não é reconhecido com segurança, o campo fica vazio e o assistente pergunta.
*/

export type Span = { start: number; end: number }

export type PeriodKind = 'day' | 'week' | 'month' | 'range' | 'year'

export type Period = {
  from: string
  /** Último dia, inclusive. */
  to: string
  kind: PeriodKind
  /** Para períodos de um mês. */
  month?: YearMonth
  /** Trecho para usar no meio da frase: "em outubro de 2026", "neste mês", "nos últimos 3 meses". */
  label: string
}

export type Amount = Span & { value: number; explicit: boolean }

// ---------------------------------------------------------------------------
// Utilidades de data
// ---------------------------------------------------------------------------

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

export function lastDayOfMonth(ym: YearMonth): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null
  const ym = `${y}-${String(m).padStart(2, '0')}`
  const last = Number(lastDayOfMonth(ym).slice(8))
  if (d > last) return null
  return `${ym}-${String(d).padStart(2, '0')}`
}

export const MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const MONTH_RE = MONTHS.join('|')
const MONTH_LABEL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function monthLabel(ym: YearMonth, today: string): string {
  const [y, m] = ym.split('-').map(Number)
  const name = MONTH_LABEL[m - 1]
  return y === Number(today.slice(0, 4)) ? name : `${name} de ${y}`
}

export function monthPeriod(ym: YearMonth, today: string): Period {
  const current = today.slice(0, 7)
  const label =
    ym === current ? 'neste mês' : ym === shiftMonth(current, -1) ? `no mês passado (${monthLabel(ym, today)})` : `em ${monthLabel(ym, today)}`
  return { from: `${ym}-01`, to: lastDayOfMonth(ym), kind: 'month', month: ym, label }
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  quinze: 15,
  dezoito: 18,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  noventa: 90,
  cem: 100,
}
const NUM_WORD_RE = Object.keys(NUMBER_WORDS).join('|')

function toInt(s: string): number {
  return /^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s] ?? NaN
}

// ---------------------------------------------------------------------------
// Datas ("ontem", "dia 10", "10/03", "5 de outubro", "sexta passada")
// ---------------------------------------------------------------------------

const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

export type DateMatch = Span & { iso: string }

export function parseDate(text: string, today: string): DateMatch | null | 'invalid' {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  let r: RegExpExecArray | null

  if ((r = /\b(depois de amanha|anteontem|ontem|hoje|amanha)\b/.exec(text))) {
    const delta = { 'depois de amanha': 2, anteontem: -2, ontem: -1, hoje: 0, amanha: 1 }[r[1]] ?? 0
    return { iso: addDays(today, delta), start: r.index, end: r.index + r[0].length }
  }
  if ((r = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/.exec(text))) {
    let year = r[3] ? Number(r[3]) : y
    if (r[3] && r[3].length === 2) year += 2000
    const iso = validDate(year, Number(r[2]), Number(r[1]))
    return iso ? { iso, start: r.index, end: r.index + r[0].length } : 'invalid'
  }
  const dm = new RegExp(`\\b(?:dia )?(\\d{1,2}) de (${MONTH_RE})(?: de (\\d{4}))?\\b`).exec(text)
  if (dm) {
    const month = MONTHS.indexOf(dm[2]) + 1
    const year = dm[3] ? Number(dm[3]) : y
    const iso = validDate(year, month, Number(dm[1]))
    return iso ? { iso, start: dm.index, end: dm.index + dm[0].length } : 'invalid'
  }
  if ((r = /\bdia (\d{1,2})\b/.exec(text))) {
    const iso = validDate(y, m, Number(r[1]))
    return iso ? { iso, start: r.index, end: r.index + r[0].length } : 'invalid'
  }
  if ((r = /\b(?:na |no |nesta |neste |nessa |nesse )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?: ?feira)?(?: (passada|passado|retrasada|retrasado))?\b/.exec(text))) {
    const target = WEEKDAYS.indexOf(r[1])
    const todayDow = parseISODate(today).getDay()
    let back = (todayDow - target + 7) % 7
    if (r[2] && back === 0) back = 7
    if (r[2]?.startsWith('retrasad')) back += 7
    return { iso: addDays(today, -back), start: r.index, end: r.index + r[0].length }
  }
  return null
}

// ---------------------------------------------------------------------------
// Períodos ("este mês", "em setembro", "últimos 6 meses", "até o fim do mês")
// ---------------------------------------------------------------------------

export type PeriodMatch = Period & Span

function mondayOf(iso: string): string {
  const dow = parseISODate(iso).getDay()
  return addDays(iso, -((dow + 6) % 7))
}

type PeriodRule = { re: RegExp; build: (r: RegExpExecArray, today: string, prefer: 'past' | 'future') => Period | null }

const PERIOD_RULES: PeriodRule[] = [
  {
    re: new RegExp(`\\b(?:nos |nas |dos |das )?ultim[oa]s (\\d{1,3}|${NUM_WORD_RE}) (meses|mes|dias|semanas|anos)\\b`),
    build: (r, today) => {
      const n = toInt(r[1])
      if (!n || n > 120) return null
      const unit = r[2]
      if (unit === 'dias') return { from: addDays(today, -(n - 1)), to: today, kind: 'range', label: `nos últimos ${n} dias` }
      if (unit === 'semanas') return { from: addDays(today, -(n * 7 - 1)), to: today, kind: 'range', label: `nas últimas ${n} semanas` }
      const months = unit === 'anos' ? n * 12 : n
      const cur = today.slice(0, 7)
      const label = unit === 'anos' ? `nos últimos ${n === 1 ? '12 meses' : `${n} anos`}` : `nos últimos ${n} meses`
      return { from: `${shiftMonth(cur, -(months - 1))}-01`, to: lastDayOfMonth(cur), kind: 'range', label }
    },
  },
  {
    re: /\b(?:no |do )?(?:ultimo (trimestre|semestre|ano)|(trimestre|semestre) passado)\b/,
    build: (r, today) => {
      const unit = r[1] ?? r[2]
      const months = unit === 'trimestre' ? 3 : unit === 'semestre' ? 6 : 12
      const cur = today.slice(0, 7)
      return { from: `${shiftMonth(cur, -(months - 1))}-01`, to: lastDayOfMonth(cur), kind: 'range', label: `nos últimos ${months} meses` }
    },
  },
  {
    re: new RegExp(`\\b(?:nos |nas )?proxim[oa]s (\\d{1,3}|${NUM_WORD_RE}) (dias|semanas|meses)\\b`),
    build: (r, today) => {
      const n = toInt(r[1])
      if (!n || n > 366) return null
      if (r[2] === 'meses') {
        const end = shiftMonth(today.slice(0, 7), n)
        return { from: today, to: lastDayOfMonth(end), kind: 'range', label: `nos próximos ${n} meses` }
      }
      const days = r[2] === 'semanas' ? n * 7 : n
      return { from: today, to: addDays(today, days), kind: 'range', label: `nos próximos ${days} dias` }
    },
  },
  {
    re: /\bate o (?:fim|final) do (mes|ano)\b/,
    build: (r, today) =>
      r[1] === 'mes'
        ? { from: today, to: lastDayOfMonth(today.slice(0, 7)), kind: 'range', label: 'até o fim do mês' }
        : { from: today, to: `${today.slice(0, 4)}-12-31`, kind: 'range', label: 'até o fim do ano' },
  },
  {
    re: /\b(?:no |do |o )?(?:mes passado|ultimo mes|mes anterior)\b/,
    build: (_r, today) => monthPeriod(shiftMonth(today.slice(0, 7), -1), today),
  },
  {
    re: /\b(?:no |do |o )?(?:proximo mes|mes que vem)\b/,
    build: (_r, today) => {
      const ym = shiftMonth(today.slice(0, 7), 1)
      return { ...monthPeriod(ym, today), label: `no próximo mês (${monthLabel(ym, today)})` }
    },
  },
  {
    re: new RegExp(`\\b(?:(?:este|esse|neste|nesse|deste|desse|no|do|o) mes(?: atual)?|mes atual)\\b(?! de (?:${MONTH_RE}))`),
    build: (_r, today) => monthPeriod(today.slice(0, 7), today),
  },
  {
    re: /\b(?:(?:esta|essa|nesta|nessa|desta|dessa|na|da) semana|semana atual)\b/,
    build: (_r, today) => {
      const mon = mondayOf(today)
      return { from: mon, to: addDays(mon, 6), kind: 'week', label: 'nesta semana' }
    },
  },
  {
    re: /\b(?:na |da )?(?:semana passada|ultima semana)\b/,
    build: (_r, today) => {
      const mon = addDays(mondayOf(today), -7)
      return { from: mon, to: addDays(mon, 6), kind: 'week', label: 'na semana passada' }
    },
  },
  {
    re: /\b(?:na |da )?(?:proxima semana|semana que vem)\b/,
    build: (_r, today) => {
      const mon = addDays(mondayOf(today), 7)
      return { from: mon, to: addDays(mon, 6), kind: 'week', label: 'na próxima semana' }
    },
  },
  {
    re: /\b(?:no |do )?ano passado\b/,
    build: (_r, today) => {
      const y = Number(today.slice(0, 4)) - 1
      return { from: `${y}-01-01`, to: `${y}-12-31`, kind: 'year', label: `em ${y}` }
    },
  },
  {
    re: /\b(?:(?:este|esse|neste|nesse|deste|desse|no|do) ano|ano atual)\b/,
    build: (_r, today) => {
      const y = today.slice(0, 4)
      return { from: `${y}-01-01`, to: lastDayOfMonth(today.slice(0, 7)), kind: 'year', label: 'neste ano' }
    },
  },
  {
    re: new RegExp(`\\b(?:em |de |no mes de |para |pra )?(${MONTH_RE})(?:(?: de| do ano de)? (\\d{4}))?\\b`),
    build: (r, today, prefer) => {
      const month = MONTHS.indexOf(r[1]) + 1
      const cur = today.slice(0, 7)
      let year = r[2] ? Number(r[2]) : Number(today.slice(0, 4))
      let ym = `${year}-${String(month).padStart(2, '0')}`
      if (!r[2]) {
        // Sem ano: o mais recente que já começou (ou o próximo, em perguntas sobre o futuro).
        if (prefer === 'past' && ym > cur) year -= 1
        if (prefer === 'future' && ym < cur) year += 1
        ym = `${year}-${String(month).padStart(2, '0')}`
      }
      return monthPeriod(ym, today)
    },
  },
  {
    re: /\b(?:em |de |no ano de |durante )((?:19|20)\d{2})\b/,
    build: (r, today) => {
      const y = r[1]
      const isCurrent = y === today.slice(0, 4)
      return {
        from: `${y}-01-01`,
        to: isCurrent ? lastDayOfMonth(today.slice(0, 7)) : `${y}-12-31`,
        kind: 'year',
        label: `em ${y}`,
      }
    },
  },
  {
    re: /\b(hoje|ontem)\b/,
    build: (r, today) => {
      const iso = r[1] === 'hoje' ? today : addDays(today, -1)
      return { from: iso, to: iso, kind: 'day', label: r[1] }
    },
  },
]

/** Todos os períodos mencionados, na ordem em que aparecem, sem sobreposição. */
export function parsePeriods(text: string, today: string, prefer: 'past' | 'future' = 'past'): PeriodMatch[] {
  const found: PeriodMatch[] = []
  const taken: Span[] = []
  const overlaps = (s: Span) => taken.some((t) => s.start < t.end && s.end > t.start)
  for (const rule of PERIOD_RULES) {
    const re = new RegExp(rule.re.source, 'g')
    let r: RegExpExecArray | null
    while ((r = re.exec(text))) {
      const span = { start: r.index, end: r.index + r[0].length }
      if (overlaps(span)) continue
      const period = rule.build(r, today, prefer)
      if (!period) continue
      taken.push(span)
      found.push({ ...period, ...span })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

/** Junta "de agosto a outubro" / "entre agosto e outubro" num único intervalo. */
export function mergeRange(text: string, periods: PeriodMatch[]): PeriodMatch | null {
  if (periods.length !== 2) return null
  const [a, b] = periods
  const between = text.slice(a.end, b.start).trim()
  const before = text.slice(Math.max(0, a.start - 7), a.start)
  const isRange = /^(a|ate|ao)$/.test(between) || (/^e$/.test(between) && /entre\s*$/.test(before))
  if (!isRange || a.from > b.from) return null
  return { from: a.from, to: b.to, kind: 'range', label: `de ${stripPrep(a.label)} a ${stripPrep(b.label)}`, start: a.start, end: b.end }
}

/** Rótulo sem a preposição inicial, para usar depois de "com": "no mês passado" → "o mês passado". */
export function bareLabel(label: string): string {
  return label
    .replace(/^neste /, 'este ')
    .replace(/^nesta /, 'esta ')
    .replace(/^nos /, 'os ')
    .replace(/^nas /, 'as ')
    .replace(/^no /, 'o ')
    .replace(/^na /, 'a ')
    .replace(/^em /, '')
}

function stripPrep(label: string) {
  return label.replace(/^(em|no|na|neste|nesta) /, '')
}

// ---------------------------------------------------------------------------
// Parcelas ("10x", "em 10 parcelas", "em dez vezes")
// ---------------------------------------------------------------------------

export function parseInstallments(text: string): (Span & { count: number }) | null {
  const rules = [
    /\b(\d{1,3}) ?x\b(?: sem juros| com juros)?/,
    new RegExp(`\\b(?:em |parcelad[oa] em )(\\d{1,3}|${NUM_WORD_RE}) ?(?:parcelas|vezes|prestacoes|x)?(?: sem juros| com juros)?\\b`),
    new RegExp(`\\b(\\d{1,3}|${NUM_WORD_RE}) (?:parcelas|prestacoes)(?: sem juros| com juros)?\\b`),
  ]
  for (const re of rules) {
    const r = re.exec(text)
    if (!r) continue
    // "em 10" sem a palavra parcelas/vezes só vale depois de "parcelado".
    if (re === rules[1] && !/parcelad|parcelas|vezes|prestacoes|x\b/.test(r[0])) continue
    const count = toInt(r[1])
    if (!Number.isFinite(count)) continue
    return { count, start: r.index, end: r.index + r[0].length }
  }
  return null
}

// ---------------------------------------------------------------------------
// Valores ("R$ 150", "1.250,90", "3 mil", "1,5k", "150 reais")
// ---------------------------------------------------------------------------

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,3})?`

function toValue(num: string, multiplier?: string): number | null {
  if (multiplier === 'mil' || multiplier === 'k') {
    const base = Number(num.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(base) ? Math.round(base * 1000 * 100) / 100 : null
  }
  return parseMoneyInput(num)
}

/** Trechos que parecem números mas não são valores: datas, parcelas, períodos, porcentagens e prazos. */
function nonMoneySpans(text: string): Span[] {
  const spans: Span[] = []
  const add = (re: RegExp) => {
    const g = new RegExp(re.source, 'g')
    let r: RegExpExecArray | null
    while ((r = g.exec(text))) spans.push({ start: r.index, end: r.index + r[0].length })
  }
  add(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)
  add(new RegExp(`\\bdia \\d{1,2}\\b|\\b\\d{1,2} de (?:${MONTH_RE})\\b`))
  add(/\b\d{1,3} ?x\b/)
  add(/\b\d{1,3} (?:parcelas|prestacoes|vezes|meses|mes|dias|semanas|anos|ano|pessoas|itens|movimentacoes|lancamentos|maiores|primeiras|primeiros)\b/)
  add(/\b(?:ultim[oa]s|proxim[oa]s|top|em|parcelado em) \d{1,3}(?![\d]|[.,]\d)(?! ?(?:reais|real|mil|k)\b)/)
  add(/\b\d+(?:[.,]\d+)? ?(?:%|por cento)/)
  add(/\b(?:em|ano|no ano de|desde|durante) (?:19|20)\d{2}\b/)
  add(new RegExp(`\\b(?:${MONTH_RE})(?: de)? (?:19|20)\\d{2}\\b`))
  return spans
}

/**
 * Valores em dinheiro na ordem em que aparecem.
 * `allowBare`: aceita números soltos ("gastei 150 no mercado") — só em pedidos de lançamento e cálculos.
 */
export function parseAmounts(text: string, allowBare = false): Amount[] {
  const out: Amount[] = []
  const blocked = nonMoneySpans(text)
  const free = (s: Span) =>
    !blocked.some((b) => s.start < b.end && s.end > b.start) && !out.some((o) => s.start < o.end && s.end > o.start)
  const explicit = [
    new RegExp(`r\\$ ?(${NUM})(?: (mil|k)\\b)?`, 'g'),
    new RegExp(`\\b(${NUM}) (mil|k)\\b(?: reais| real)?`, 'g'),
    new RegExp(`\\b(${NUM}) (?:reais|real|conto|contos|pila|pilas)\\b`, 'g'),
  ]
  for (const re of explicit) {
    let r: RegExpExecArray | null
    while ((r = re.exec(text))) {
      const span = { start: r.index, end: r.index + r[0].length }
      if (out.some((o) => span.start < o.end && span.end > o.start)) continue
      const value = toValue(r[1], r[2])
      if (value !== null && value > 0) out.push({ value, explicit: true, ...span })
    }
  }
  const words = new RegExp(`\\b(${NUM_WORD_RE}) (reais|mil reais|mil)\\b`, 'g')
  let w: RegExpExecArray | null
  while ((w = words.exec(text))) {
    const span = { start: w.index, end: w.index + w[0].length }
    if (!free(span)) continue
    const base = NUMBER_WORDS[w[1]]
    out.push({ value: w[2].startsWith('mil') ? base * 1000 : base, explicit: true, ...span })
  }
  if (allowBare) {
    const bare = new RegExp(`(?:^| )(${NUM})(?= |$)`, 'g')
    let r: RegExpExecArray | null
    while ((r = bare.exec(text))) {
      const start = r.index + (r[0].startsWith(' ') ? 1 : 0)
      const span = { start, end: start + r[1].length }
      if (!free(span)) continue
      const value = parseMoneyInput(r[1])
      if (value !== null && value > 0) out.push({ value, explicit: false, ...span })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

// ---------------------------------------------------------------------------
// Porcentagens ("15%", "2,5 por cento")
// ---------------------------------------------------------------------------

export function parsePercents(text: string): Array<Span & { value: number }> {
  const out: Array<Span & { value: number }> = []
  const re = /\b(\d+(?:[.,]\d+)?) ?(?:%|por cento)/g
  let r: RegExpExecArray | null
  while ((r = re.exec(text))) out.push({ value: Number(r[1].replace(',', '.')), start: r.index, end: r.index + r[0].length })
  return out
}

/** Prazos ("12 meses", "2 anos") — usados nas calculadoras. */
export function parseDuration(text: string): (Span & { months: number }) | null {
  const r = new RegExp(`\\b(\\d{1,3}|${NUM_WORD_RE}) (meses|mes|anos|ano)\\b`).exec(text)
  if (!r) return null
  const n = toInt(r[1])
  if (!n) return null
  return { months: r[2].startsWith('ano') ? n * 12 : n, start: r.index, end: r.index + r[0].length }
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export type CategoryLike = { id: string; name: string; kind: 'expense' | 'income'; archived?: boolean }

/**
 * Palavras que indicam cada categoria padrão do CashBot (nomes normalizados).
 * Se o espaço renomeou ou excluiu a categoria, a palavra simplesmente não é usada.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  alimentacao: [
    'supermercado', 'mercado', 'padaria', 'restaurante', 'lanche', 'lanchonete', 'ifood', 'comida', 'almoco', 'jantar',
    'cafe da manha', 'cafeteria', 'acougue', 'feira', 'hortifruti', 'pizza', 'hamburguer', 'delivery', 'marmita',
    'sorvete', 'refeicao', 'mercearia', 'sacolao', 'atacadao', 'doceria', 'salgado',
  ],
  moradia: ['aluguel', 'condominio', 'iptu', 'reforma', 'diarista', 'faxina', 'manutencao da casa', 'material de construcao', 'mudanca'],
  transporte: [
    'combustivel', 'gasolina', 'etanol', 'diesel', 'posto', 'estacionamento', 'uber', 'taxi', 'onibus', 'metro',
    'pedagio', 'mecanico', 'oficina', 'ipva', 'licenciamento', 'lavagem do carro', 'lava jato', 'trem', 'bilhete unico',
    'passagem de onibus', 'pneu', 'troca de oleo', 'seguro do carro', 'multa de transito', 'patinete', 'bicicleta',
  ],
  saude: [
    'farmacia', 'remedio', 'remedios', 'medicamento', 'medico', 'consulta', 'dentista', 'exame', 'exames', 'plano de saude',
    'hospital', 'academia', 'psicologo', 'terapia', 'fisioterapia', 'otica', 'oculos', 'vacina', 'laboratorio',
  ],
  educacao: [
    'escola', 'faculdade', 'curso', 'livro', 'livros', 'mensalidade escolar', 'material escolar', 'apostila', 'ingles',
    'pos graduacao', 'universidade', 'matricula', 'aula', 'aulas',
  ],
  lazer: [
    'cinema', 'teatro', 'show', 'viagem', 'passeio', 'hotel', 'pousada', 'bar', 'cerveja', 'festa', 'balada', 'ingresso',
    'parque', 'jogo', 'videogame', 'praia', 'clube', 'boliche', 'karaoke',
  ],
  compras: [
    'roupa', 'roupas', 'sapato', 'sapatos', 'tenis', 'celular', 'eletronico', 'eletronicos', 'presente', 'shopping',
    'notebook', 'computador', 'perfume', 'maquiagem', 'amazon', 'mercado livre', 'shopee', 'magalu', 'televisao',
    'geladeira', 'fogao', 'moveis', 'movel', 'sofa', 'brinquedo', 'loja', 'calca', 'camiseta', 'bolsa',
  ],
  'contas e servicos': [
    'conta de luz', 'luz', 'energia', 'conta de agua', 'agua e esgoto', 'internet', 'telefone', 'conta de celular',
    'plano de celular', 'gas', 'netflix', 'spotify', 'streaming', 'assinatura', 'assinaturas', 'tv a cabo', 'seguro',
    'tarifa', 'tarifa bancaria', 'anuidade', 'disney', 'prime video', 'youtube premium', 'icloud', 'contador',
  ],
  salario: ['salario', 'holerite', 'adiantamento', 'decimo terceiro', '13o', 'ferias', 'ordenado', 'pro labore', 'vale alimentacao'],
  rendimentos: ['rendimento', 'rendimentos', 'juros recebidos', 'dividendos', 'dividendo', 'proventos', 'rendeu', 'cashback'],
  'outras receitas': ['freela', 'freelance', 'bico', 'venda', 'vendi', 'reembolso', 'pix recebido', 'mesada', 'heranca', 'premio'],
}

const KEYWORD_INDEX: Array<{ phrase: string; canonical: string }> = Object.entries(CATEGORY_KEYWORDS)
  .flatMap(([canonical, phrases]) => phrases.map((phrase) => ({ phrase, canonical })))
  .sort((a, b) => b.phrase.length - a.phrase.length)

export type CategoryMatch = Span & { category: CategoryLike; via: 'name' | 'keyword'; keyword: string }

function norm(s: string) {
  return normalize(s).text
}

/**
 * Categoria mencionada. Primeiro procura o nome de uma categoria do espaço (vale para categorias criadas
 * pelo usuário); depois as palavras-chave. `kind` restringe a despesas ou receitas.
 */
export function matchCategory(text: string, categories: CategoryLike[], kind?: 'expense' | 'income'): CategoryMatch | null {
  const usable = categories.filter((c) => !c.archived && (!kind || c.kind === kind))
  const byName = usable
    .map((c) => ({ c, n: norm(c.name) }))
    .filter((x) => x.n.length >= 3)
    .sort((a, b) => b.n.length - a.n.length)
  for (const { c, n } of byName) {
    const variants = [n, n.endsWith('s') ? n.slice(0, -1) : `${n}s`]
    for (const v of variants) {
      const r = new RegExp(`(?:^| )(${escapeRe(v)})(?= |$)`).exec(text)
      if (r) {
        const start = r.index + (r[0].startsWith(' ') ? 1 : 0)
        return { category: c, via: 'name', keyword: v, start, end: start + v.length }
      }
    }
  }
  for (const { phrase, canonical } of KEYWORD_INDEX) {
    const r = new RegExp(`(?:^| )(${escapeRe(phrase)})(?= |$)`).exec(text)
    if (!r) continue
    const category = usable.find((c) => norm(c.name) === canonical)
    if (!category) continue
    const start = r.index + (r[0].startsWith(' ') ? 1 : 0)
    return { category, via: 'keyword', keyword: phrase, start, end: start + phrase.length }
  }
  return null
}

// ---------------------------------------------------------------------------
// Contas e cartões
// ---------------------------------------------------------------------------

export type AccountLike = { id: string; name: string; type: string; archived?: boolean }

export type AccountMatch = Span & { account: AccountLike } | (Span & { ambiguous: AccountLike[] })

const GENERIC_ACCOUNT: Array<{ re: RegExp; types: string[] }> = [
  { re: /\b(?:no |do |pelo |com o |com )?cartao(?: de credito)?\b|\bno credito\b/, types: ['credit_card'] },
  { re: /\b(?:em |no |com |do )?(?:dinheiro vivo|dinheiro|especie|carteira)\b/, types: ['wallet'] },
  { re: /\b(?:na |da |para a |pra )?poupanca\b/, types: ['savings'] },
  { re: /\b(?:na |da )?conta corrente\b/, types: ['checking'] },
]

/** Todas as contas citadas pelo nome, na ordem em que aparecem. */
export function findAccountsByName(text: string, accounts: AccountLike[]): Array<Span & { account: AccountLike }> {
  const out: Array<Span & { account: AccountLike }> = []
  const named = accounts
    .filter((a) => !a.archived)
    .map((a) => ({ a, n: norm(a.name) }))
    .filter((x) => x.n.length >= 2)
    .sort((a, b) => b.n.length - a.n.length)
  for (const { a, n } of named) {
    const re = new RegExp(`(?:^| )(${escapeRe(n)})(?= |$)`, 'g')
    let r: RegExpExecArray | null
    while ((r = re.exec(text))) {
      const start = r.index + (r[0].startsWith(' ') ? 1 : 0)
      const span = { start, end: start + n.length }
      if (out.some((o) => span.start < o.end && span.end > o.start)) continue
      out.push({ account: a, ...span })
    }
  }
  return out.sort((x, y) => x.start - y.start)
}

/**
 * Conta ou cartão mencionado. Nome tem prioridade; termos genéricos ("cartão", "dinheiro")
 * só valem quando `generic` é verdadeiro e apontam para uma única conta daquele tipo.
 */
export function matchAccount(text: string, accounts: AccountLike[], generic = true): AccountMatch | null {
  const byName = findAccountsByName(text, accounts)
  if (byName.length > 0) return byName[0]
  if (!generic) return null
  for (const g of GENERIC_ACCOUNT) {
    const r = g.re.exec(text)
    if (!r) continue
    const candidates = accounts.filter((a) => !a.archived && g.types.includes(a.type))
    const span = { start: r.index, end: r.index + r[0].length }
    if (candidates.length === 1) return { account: candidates[0], ...span }
    if (candidates.length > 1) return { ambiguous: candidates, ...span }
  }
  return null
}

// ---------------------------------------------------------------------------
// Descrição (o que sobra depois de tirar valores, datas, contas e verbos)
// ---------------------------------------------------------------------------

const FILLER = new Set(
  (
    'gastei gasto gastos gastar paguei pagar pago paga comprei compra comprar recebi receber recebido ganhei ganho lanca lancar ' +
    'lance lancamento registra registrar registre adiciona adicionar adicione anota anotar anote coloca colocar coloque inclui ' +
    'incluir inclua cria criar crie nova novo despesa receita entrada saida saiu entrou reais real r$ mil k valor parcelas ' +
    'parcela parcelado parcelada vezes x sem juros com juros foi fiz tive deu custou ai la aqui hoje ontem anteontem ' +
    'por favor favor pf pfv quero queria preciso gostaria pode voce poderia vou ia acabei'
  ).split(' '),
)
const EDGE = new Set(', ; de do da dos das no na nos nas em com por pra para pro pelo pela o a os as um uma uns umas e que meu minha meus minhas'.split(' '))

export function extractDescription(n: Normalized, consumed: Span[]): string {
  const isConsumed = (i: number) => consumed.some((s) => n.tokens[i].start < s.end && n.tokens[i].end > s.start)
  const kept: Array<{ raw: string; norm: string } | null> = []
  n.tokens.forEach((t, i) => {
    if (isConsumed(i)) {
      // Preposição logo antes de um trecho removido ("no [nubank]", "de [R$ 80]") também sai.
      while (kept.length && kept[kept.length - 1] && EDGE.has(kept[kept.length - 1]!.norm)) kept.pop()
      if (kept.length && kept[kept.length - 1] !== null) kept.push(null)
      return
    }
    if (FILLER.has(t.norm)) return
    kept.push({ raw: t.raw, norm: t.norm })
  })
  const words = kept.filter((k): k is { raw: string; norm: string } => k !== null)
  while (words.length && EDGE.has(words[0].norm)) words.shift()
  while (words.length && EDGE.has(words[words.length - 1].norm)) words.pop()
  const text = words.map((w) => w.raw).join(' ').slice(0, 140).trim()
  return capitalize(text)
}

/** Divide "R$ 80 de combustível e R$ 45 de estacionamento" em um trecho por valor. */
export function splitByAmounts(text: string, amounts: Amount[]): Array<Span & { amount: Amount }> {
  if (amounts.length <= 1) return amounts.map((a) => ({ start: 0, end: text.length, amount: a }))
  const cuts: number[] = []
  for (let i = 0; i < amounts.length - 1; i++) {
    const between = text.slice(amounts[i].end, amounts[i + 1].start)
    const sep = /(?:,|;| e | mais | tambem | alem de )/.exec(` ${between} `)
    cuts.push(sep ? amounts[i].end + Math.max(0, sep.index - 1) : amounts[i + 1].start)
  }
  return amounts.map((amount, i) => ({ start: i === 0 ? 0 : cuts[i - 1], end: i < cuts.length ? cuts[i] : text.length, amount }))
}
