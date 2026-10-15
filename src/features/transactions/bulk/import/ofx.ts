/*
  Leitor de OFX (versões 1.x em SGML e 2.x em XML), usado por extratos bancários e faturas de cartão.
  Lê cada <STMTTRN>: data (DTPOSTED), valor com sinal (TRNAMT), descrição (MEMO/NAME) e identificador (FITID).
*/

export type OfxTransaction = { date: string; cents: number; description: string; fitid: string | null; type: string | null }

export type OfxResult = {
  /** 'card' quando o arquivo é de cartão de crédito (CREDITCARDMSGSRSV1). */
  source: 'bank' | 'card' | 'unknown'
  transactions: OfxTransaction[]
  skipped: Array<{ line: number; reason: string }>
}

function field(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block)
  return m ? decodeEntities(m[1].trim()) : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/gi, '&')
}

/** "-1234.56", "-1234,56", "+50" → centavos com sinal. */
export function ofxAmountToCents(raw: string): number | null {
  const s = raw.replace(/\s/g, '')
  const m = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/.exec(s)
  if (!m) return null
  const cents = Number(m[2]) * 100 + Number(((m[3] ?? '') + '00').slice(0, 2))
  return m[1] === '-' ? -cents : cents
}

export function parseOfx(text: string): OfxResult {
  const source: OfxResult['source'] = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text) ? 'card' : /<BANKMSGSRSV1>|<STMTRS>/i.test(text) ? 'bank' : 'unknown'
  const transactions: OfxTransaction[] = []
  const skipped: OfxResult['skipped'] = []
  const parts = text.split(/<STMTTRN>/i).slice(1)
  parts.forEach((part, i) => {
    const block = part.split(/<\/STMTTRN>/i)[0]
    const dt = field(block, 'DTPOSTED') ?? field(block, 'DTUSER')
    const amt = field(block, 'TRNAMT')
    const m = dt ? /^(\d{4})(\d{2})(\d{2})/.exec(dt) : null
    const cents = amt ? ofxAmountToCents(amt) : null
    if (!m) {
      skipped.push({ line: i + 1, reason: 'data ausente ou inválida' })
      return
    }
    if (cents === null) {
      skipped.push({ line: i + 1, reason: 'valor ausente ou inválido' })
      return
    }
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (mo < 1 || mo > 12 || d < 1 || d > new Date(y, mo, 0).getDate()) {
      skipped.push({ line: i + 1, reason: 'data inexistente' })
      return
    }
    const memo = field(block, 'MEMO')
    const name = field(block, 'NAME')
    const description = (memo || name || '').replace(/\s+/g, ' ').trim()
    transactions.push({ date: `${m[1]}-${m[2]}-${m[3]}`, cents, description, fitid: field(block, 'FITID'), type: field(block, 'TRNTYPE') })
  })
  return { source, transactions, skipped }
}
