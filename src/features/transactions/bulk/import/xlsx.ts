/*
  Leitor mínimo de XLSX, sem bibliotecas: o arquivo é um ZIP com XMLs dentro.
  - Descompacta com DecompressionStream('deflate-raw'), disponível nos navegadores atuais.
  - Lê as planilhas, os textos compartilhados e os estilos (para reconhecer células de data).
  Devolve, para cada planilha, uma grade de células: texto, número ou data (AAAA-MM-DD).
*/

export type XlsxCell = string | number
export type XlsxSheet = { name: string; rows: XlsxCell[][] }

const MAX_UNCOMPRESSED = 50 * 1024 * 1024

type ZipEntry = { name: string; method: number; compressedSize: number; size: number; offset: number }

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8)
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

function readEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('O arquivo não é um XLSX válido.')
  const count = u16(bytes, eocd + 10)
  let p = u32(bytes, eocd + 16)
  const entries = new Map<string, ZipEntry>()
  const dec = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error('O arquivo XLSX está corrompido.')
    const method = u16(bytes, p + 10)
    const compressedSize = u32(bytes, p + 20)
    const size = u32(bytes, p + 24)
    const nameLen = u16(bytes, p + 28)
    const extraLen = u16(bytes, p + 30)
    const commentLen = u16(bytes, p + 32)
    const offset = u32(bytes, p + 42)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    entries.set(name, { name, method, compressedSize, size, offset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body!.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readFile(bytes: Uint8Array, entries: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const e = entries.get(name)
  if (!e) return null
  if (e.size > MAX_UNCOMPRESSED) throw new Error('A planilha é grande demais para importar.')
  if (u32(bytes, e.offset) !== 0x04034b50) throw new Error('O arquivo XLSX está corrompido.')
  const start = e.offset + 30 + u16(bytes, e.offset + 26) + u16(bytes, e.offset + 28)
  const raw = bytes.subarray(start, start + e.compressedSize)
  let data: Uint8Array
  if (e.method === 0) data = raw
  else if (e.method === 8) data = await inflateRaw(raw)
  else throw new Error('Formato de compressão do XLSX não suportado.')
  return new TextDecoder().decode(data)
}

export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? unescapeXml(m[1]) : null
}

function textRuns(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += unescapeXml(m[1])
  return out
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Formatos de número que representam datas (padrões do Excel 14–22, 45–47 e formatos com d/m/a). */
function dateStyles(stylesXml: string | null): Set<number> {
  const result = new Set<number>()
  if (!stylesXml) return result
  const custom = new Map<number, string>()
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId'))
    const code = attr(m[0], 'formatCode') ?? ''
    custom.set(id, code)
  }
  const isDateFmt = (id: number) => {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true
    const code = custom.get(id)
    if (!code) return false
    const cleaned = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
    return /[dy]/i.test(cleaned) || /m{1,4}[^0#]*[dy]|[dy][^0#]*m/i.test(cleaned)
  }
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? ''
  let i = 0
  for (const m of xfs.matchAll(/<xf\s[^>]*?\/?>/g)) {
    if (isDateFmt(Number(attr(m[0], 'numFmtId') ?? 0))) result.add(i)
    i++
  }
  return result
}

/** Número de série do Excel (sistema 1900) → AAAA-MM-DD. */
export function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null
  const ms = Math.round((Math.floor(serial) - 25569) * 86400000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function parseSheet(xml: string, shared: string[], dates: Set<number>): XlsxCell[][] {
  const rows: XlsxCell[][] = []
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rIndex = Number(attr(rm[0].slice(0, rm[0].indexOf('>') + 1), 'r') ?? rows.length + 1) - 1
    const row: XlsxCell[] = []
    let nextCol = 0
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const open = `<c${cm[1]}>`
      const ref = attr(open, 'r')
      const col = ref ? columnIndex(ref) : nextCol
      nextCol = col + 1
      const t = attr(open, 't')
      const s = Number(attr(open, 's') ?? -1)
      const inner = cm[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      let value: XlsxCell = ''
      if (t === 's') value = shared[Number(v)] ?? ''
      else if (t === 'inlineStr') value = textRuns(inner)
      else if (t === 'str' || t === 'e') value = v !== undefined ? unescapeXml(v) : ''
      else if (t === 'b') value = v === '1' ? 'VERDADEIRO' : 'FALSO'
      else if (v !== undefined && v !== '') {
        const n = Number(v)
        if (Number.isFinite(n)) value = dates.has(s) ? (excelSerialToISO(n) ?? n) : n
        else value = unescapeXml(v)
      }
      row[col] = typeof value === 'string' ? value.trim() : value
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = ''
    rows[rIndex] = row
  }
  return Array.from(rows, (r) => r ?? []).filter((r) => r.some((c) => c !== ''))
}

export async function readXlsx(input: Uint8Array): Promise<XlsxSheet[]> {
  const entries = readEntries(input)
  const workbook = await readFile(input, entries, 'xl/workbook.xml')
  if (!workbook) throw new Error('O arquivo não é um XLSX válido.')
  const rels = (await readFile(input, entries, 'xl/_rels/workbook.xml.rels')) ?? ''
  const relTarget = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = attr(m[0], 'Id')
    const target = attr(m[0], 'Target')
    if (id && target) relTarget.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`)
  }
  const sharedXml = await readFile(input, entries, 'xl/sharedStrings.xml')
  const shared: string[] = []
  if (sharedXml) for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textRuns(m[1]))
  const dates = dateStyles(await readFile(input, entries, 'xl/styles.xml'))

  const sheets: XlsxSheet[] = []
  for (const m of workbook.matchAll(/<sheet\s[^>]*>/g)) {
    const name = attr(m[0], 'name') ?? `Planilha ${sheets.length + 1}`
    const rid = attr(m[0], 'r:id')
    const path = (rid && relTarget.get(rid)) || `xl/worksheets/sheet${sheets.length + 1}.xml`
    const xml = await readFile(input, entries, path)
    if (xml) sheets.push({ name, rows: parseSheet(xml, shared, dates) })
  }
  return sheets
}
