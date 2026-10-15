/*
  Leitor de CSV (RFC 4180): aspas, aspas duplicadas, quebras de linha dentro de aspas.
  O separador é detectado entre ";", "," e tabulação (bancos brasileiros costumam usar ";").
*/

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20)
  let best = ';'
  let bestScore = -1
  for (const d of [';', ',', '\t']) {
    const counts = lines.map((l) => countOutsideQuotes(l, d))
    const nonZero = counts.filter((c) => c > 0)
    if (!nonZero.length) continue
    // Preferimos o separador que aparece em mais linhas com a mesma quantidade de colunas.
    const freq = new Map<number, number>()
    for (const c of nonZero) freq.set(c, (freq.get(c) ?? 0) + 1)
    const consistent = Math.max(...freq.values())
    const score = consistent * 10 + nonZero.length
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

function countOutsideQuotes(line: string, d: string): number {
  let inQuotes = false
  let n = 0
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === d && !inQuotes) n++
  }
  return n
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      inQuotes = true
      cell = ''
    } else if (ch === delimiter) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c !== ''))
}
