/*
  Normalização de texto do Assistente Financeiro.
  O texto é quebrado em "tokens" que guardam a forma original (para montar descrições com acento)
  e a forma normalizada (minúscula, sem acento) usada nas regras.
*/

export type Token = {
  /** Como o usuário escreveu (sem pontuação de borda). */
  raw: string
  /** Minúsculo e sem acentos. */
  norm: string
  /** Posição do token no texto normalizado (`joined`). */
  start: number
  end: number
}

export type Normalized = {
  original: string
  tokens: Token[]
  /** Tokens normalizados unidos por um espaço. As expressões regulares rodam aqui. */
  text: string
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Minúsculas, sem acento, sem pontuação solta e com espaços simples. */
export function normalizeText(s: string): string {
  return normalize(s).text
}

// Pontuação que faz parte de valores e datas fica dentro do token: 1.250,90 · 10/03 · R$ · 15% · 10x.
// Vírgula seguida de espaço e ponto e vírgula viram tokens próprios (separam itens de uma lista).
const TOKEN_RE = /[\p{L}\p{N}$%]+(?:[.,/:\-][\p{L}\p{N}$%]+)*|;|,(?=\s)/gu

/** Abreviações comuns em mensagens ("qto", "vc", "hj"). */
const ABBREVIATIONS: Record<string, string> = {
  qto: 'quanto',
  qnto: 'quanto',
  qnt: 'quanto',
  qta: 'quanta',
  qtos: 'quantos',
  qtas: 'quantas',
  vc: 'voce',
  vcs: 'voces',
  hj: 'hoje',
  tb: 'tambem',
  tbm: 'tambem',
  pq: 'porque',
  q: 'que',
  oq: 'o que',
  msm: 'mesmo',
  td: 'tudo',
  mto: 'muito',
  mt: 'muito',
}

export function normalize(original: string): Normalized {
  const tokens: Token[] = []
  let text = ''
  // "R$150" vira "R$ 150"; "150reais" vira "150 reais".
  const prepared = original
    .slice(0, 1000)
    .replace(/(r\$)(?=\d)/gi, '$1 ')
    .replace(/(\d)(reais|real|mil|k)\b/gi, '$1 $2')
  for (const match of prepared.matchAll(TOKEN_RE)) {
    const raw = match[0]
    const lower = stripAccents(raw.toLowerCase())
    const norm = ABBREVIATIONS[lower] ?? lower
    if (text) text += ' '
    const start = text.length
    text += norm
    tokens.push({ raw, norm, start, end: text.length })
  }
  return { original, tokens, text }
}

/** Índices dos tokens que um trecho [start, end) do texto normalizado cobre. */
export function tokensInRange(n: Normalized, start: number, end: number): number[] {
  const out: number[] = []
  n.tokens.forEach((t, i) => {
    if (t.start < end && t.end > start) out.push(i)
  })
  return out
}

/** Distância de edição (Levenshtein) com limite: devolve limit + 1 quando passa do limite. */
export function editDistance(a: string, b: string, limit = 2): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > limit) return limit + 1
    prev = cur
  }
  return prev[b.length]
}

/**
 * Corrige erros de digitação comuns trocando palavras parecidas por termos conhecidos
 * (só palavras com 5+ letras e no máximo 1 letra de diferença; 2 a partir de 10 letras).
 */
export function correctTypos(text: string, vocabulary: ReadonlySet<string>): string {
  return text
    .split(' ')
    .map((word) => {
      if (word.length < 5 || vocabulary.has(word) || /\d/.test(word)) return word
      const limit = word.length >= 10 ? 2 : 1
      let best: string | null = null
      let bestDist = limit + 1
      for (const v of vocabulary) {
        if (Math.abs(v.length - word.length) > limit || v[0] !== word[0]) continue
        const d = editDistance(word, v, limit)
        if (d < bestDist) {
          best = v
          bestDist = d
        }
      }
      return best ?? word
    })
    .join(' ')
}

/** Testa uma palavra ou expressão inteira (com fronteira de palavra) no texto normalizado. */
export function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(?:^| )${escapeRe(phrase)}(?= |$)`).test(text)
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Primeira letra maiúscula. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
