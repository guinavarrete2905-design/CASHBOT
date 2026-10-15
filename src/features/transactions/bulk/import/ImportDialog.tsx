import { useMemo, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AccountRef, BulkRow, CategoryRef } from '../model'
import { parseCsv } from './csv'
import { decodeText } from './decode'
import { readRows, suggestOptions, type Grid, type ImportedTx, type MappingOptions, type Roles, type SkippedLine } from './mapping'
import { parseOfx, type OfxResult } from './ofx'
import { importedToRows, type ImportSource } from './toRows'
import { readXlsx, type XlsxSheet } from './xlsx'

/*
  Importação de extrato bancário ou fatura de cartão (CSV, OFX, XLSX) para a planilha de lançamento em massa.
  Nada é gravado aqui: as linhas entram na planilha para revisão, e só são salvas no fluxo normal.
*/

const MAX_BYTES = 10 * 1024 * 1024

type Loaded =
  | { format: 'ofx'; name: string; ofx: OfxResult }
  | { format: 'csv'; name: string; grid: Grid }
  | { format: 'xlsx'; name: string; sheets: XlsxSheet[] }

const ROLE_LABEL: Record<keyof Roles, string> = {
  date: 'Data',
  description: 'Descrição',
  amount: 'Valor (com sinal)',
  credit: 'Crédito (entradas)',
  debit: 'Débito (saídas)',
  type: 'Tipo C/D (opcional)',
}

function columnName(i: number) {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function ImportDialog({
  accounts,
  categories,
  maxRows,
  onImport,
  onClose,
}: {
  accounts: AccountRef[]
  categories: CategoryRef[]
  maxRows: number
  onImport: (rows: BulkRow[], fileName: string) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [source, setSource] = useState<ImportSource>('statement')
  const [accountId, setAccountId] = useState('')
  const [sheetIndex, setSheetIndex] = useState(0)
  const [options, setOptions] = useState<MappingOptions | null>(null)
  const [invert, setInvert] = useState(false)

  const active = accounts.filter((a) => !a.archived)
  const accountChoices = active.filter((a) => (source === 'card' ? a.type === 'credit_card' : a.type !== 'credit_card'))

  const grid: Grid | null = loaded?.format === 'csv' ? loaded.grid : loaded?.format === 'xlsx' ? (loaded.sheets[sheetIndex]?.rows ?? []) : null
  const signFor = (s: ImportSource) => (s === 'card' ? 'positive-is-out' : 'negative-is-out') as MappingOptions['signMode']

  function chooseSource(next: ImportSource) {
    setSource(next)
    setAccountId('')
    if (options) setOptions({ ...options, signMode: signFor(next) })
  }

  async function handleFile(file: File) {
    setError(null)
    setLoaded(null)
    setOptions(null)
    setSheetIndex(0)
    if (file.size > MAX_BYTES) {
      setError('O arquivo tem mais de 10 MB.')
      return
    }
    setReading(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const name = file.name
      const lower = name.toLowerCase()
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
      if (lower.endsWith('.xls') && !isZip) {
        setError('O formato .xls antigo não é suportado. No Excel, use "Salvar como" .xlsx ou CSV.')
        return
      }
      if (isZip || lower.endsWith('.xlsx')) {
        const sheets = (await readXlsx(bytes)).filter((s) => s.rows.length > 0)
        if (!sheets.length) throw new Error('A planilha está vazia.')
        setLoaded({ format: 'xlsx', name, sheets })
        setOptions(suggestOptions(sheets[0].rows, signFor(source)))
        return
      }
      const text = decodeText(bytes)
      if (/<OFX>/i.test(text) || lower.endsWith('.ofx') || lower.endsWith('.qfx')) {
        const ofx = parseOfx(text)
        if (!ofx.transactions.length && !ofx.skipped.length) throw new Error('Não encontrei movimentações neste arquivo OFX.')
        setLoaded({ format: 'ofx', name, ofx })
        if (ofx.source !== 'unknown') chooseSource(ofx.source === 'card' ? 'card' : 'statement')
        return
      }
      const csv = parseCsv(text)
      if (!csv.length) throw new Error('O arquivo está vazio.')
      setLoaded({ format: 'csv', name, grid: csv })
      setOptions(suggestOptions(csv, signFor(source)))
    } catch (e) {
      setError(e instanceof Error && /[ãçéêíóú]|arquivo|planilha/i.test(e.message) ? e.message : 'Não foi possível ler o arquivo. Confira se é CSV, OFX ou XLSX.')
    } finally {
      setReading(false)
    }
  }

  const result = useMemo((): { transactions: ImportedTx[]; skipped: SkippedLine[] } | null => {
    if (!loaded) return null
    let r: { transactions: ImportedTx[]; skipped: SkippedLine[] }
    if (loaded.format === 'ofx') {
      r = {
        transactions: loaded.ofx.transactions
          .filter((t) => t.cents !== 0)
          .map((t, i) => ({ date: t.date, description: t.description || 'Sem descrição', cents: Math.abs(t.cents), direction: t.cents < 0 ? ('out' as const) : ('in' as const), line: i + 1 })),
        skipped: [...loaded.ofx.skipped, ...loaded.ofx.transactions.filter((t) => t.cents === 0).map((_, i) => ({ line: i + 1, reason: 'valor zero' }))],
      }
    } else {
      if (!grid || !options) return null
      r = readRows(grid, options)
    }
    if (invert) r = { ...r, transactions: r.transactions.map((t) => ({ ...t, direction: t.direction === 'out' ? ('in' as const) : ('out' as const) })) }
    return r
  }, [loaded, grid, options, invert])

  const headerCells = grid && options?.headerRow !== null && options?.headerRow !== undefined ? grid[options.headerRow] : null
  const width = grid ? Math.max(0, ...grid.slice(0, 50).map((r) => r.length)) : 0
  const colLabel = (i: number) => {
    const h = headerCells?.[i]
    return `${columnName(i)}${h !== undefined && h !== '' ? ` · ${String(h).slice(0, 24)}` : ''}`
  }

  function setRole(role: keyof Roles, value: string) {
    if (!options) return
    const v = value === '' ? null : Number(value)
    const roles = { ...options.roles, [role]: v }
    if (role === 'amount' && v !== null) {
      roles.credit = null
      roles.debit = null
    }
    if ((role === 'credit' || role === 'debit') && v !== null) roles.amount = null
    setOptions({ ...options, roles })
  }

  const count = result?.transactions.length ?? 0
  const tooMany = count > maxRows
  const canImport = Boolean(loaded && accountId && count > 0 && !tooMany)

  function confirm() {
    if (!result || !loaded || !canImport) return
    onImport(importedToRows(result.transactions, { source, accountId, categories, fileName: loaded.name }), loaded.name)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar extrato ou fatura</DialogTitle>
          <DialogDescription>CSV, OFX ou XLSX. As movimentações entram na planilha para você revisar; nada é salvo antes disso.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {/* Arquivo */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,.ofx,.qfx,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
                e.target.value = ''
              }}
            />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} loading={reading}>
              {!reading && <FileUp aria-hidden="true" />}
              {loaded ? 'Trocar arquivo' : 'Escolher arquivo'}
            </Button>
            {loaded && (
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {loaded.name} · {loaded.format.toUpperCase()}
              </p>
            )}
          </div>
          {error && (
            <p className="rounded-md border border-negative/30 bg-negative/5 p-2 text-sm text-negative" role="alert">
              {error}
            </p>
          )}

          {/* Origem e conta */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Este arquivo é</Label>
              <Segmented<ImportSource>
                label="Tipo de arquivo"
                value={source}
                onChange={chooseSource}
                options={[
                  { value: 'statement', label: 'Extrato da conta' },
                  { value: 'card', label: 'Fatura do cartão' },
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="import-account">{source === 'card' ? 'Cartão' : 'Conta'}</Label>
              <NativeSelect id="import-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Escolha…</option>
                {accountChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
              {accountChoices.length === 0 && (
                <p className="text-xs text-muted-foreground">{source === 'card' ? 'Nenhum cartão cadastrado neste espaço.' : 'Nenhuma conta cadastrada neste espaço.'} Cadastre em Contas e cartões.</p>
              )}
            </div>
          </div>

          {/* Colunas (CSV/XLSX) */}
          {grid && options && (
            <fieldset className="grid gap-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Colunas do arquivo</legend>
              {loaded?.format === 'xlsx' && loaded.sheets.length > 1 && (
                <div className="grid gap-1.5 sm:max-w-xs">
                  <Label htmlFor="import-sheet">Aba</Label>
                  <NativeSelect
                    id="import-sheet"
                    value={String(sheetIndex)}
                    onChange={(e) => {
                      const i = Number(e.target.value)
                      setSheetIndex(i)
                      setOptions(suggestOptions(loaded.sheets[i].rows, signFor(source)))
                    }}
                  >
                    {loaded.sheets.map((s, i) => (
                      <option key={s.name} value={i}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="import-header">Linha do cabeçalho</Label>
                  <NativeSelect
                    id="import-header"
                    value={options.headerRow === null ? '' : String(options.headerRow)}
                    onChange={(e) => setOptions({ ...options, headerRow: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">Sem cabeçalho</option>
                    {grid.slice(0, 20).map((r, i) => (
                      <option key={i} value={i}>
                        Linha {i + 1}: {r.filter((c) => c !== '').slice(0, 3).join(' · ').slice(0, 40)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {(Object.keys(ROLE_LABEL) as Array<keyof Roles>).map((role) => (
                  <div key={role} className="grid gap-1.5">
                    <Label htmlFor={`import-role-${role}`}>{ROLE_LABEL[role]}</Label>
                    <NativeSelect id={`import-role-${role}`} value={options.roles[role] === null ? '' : String(options.roles[role])} onChange={(e) => setRole(role, e.target.value)}>
                      <option value="">—</option>
                      {Array.from({ length: width }, (_, i) => (
                        <option key={i} value={i}>
                          {colLabel(i)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
                <div className="grid gap-1.5">
                  <Label htmlFor="import-date-format">Formato da data</Label>
                  <NativeSelect id="import-date-format" value={options.dateFormat} onChange={(e) => setOptions({ ...options, dateFormat: e.target.value as MappingOptions['dateFormat'] })}>
                    <option value="dmy">DD/MM/AAAA</option>
                    <option value="mdy">MM/DD/AAAA</option>
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="import-number-format">Formato dos valores</Label>
                  <NativeSelect id="import-number-format" value={options.numberFormat} onChange={(e) => setOptions({ ...options, numberFormat: e.target.value as MappingOptions['numberFormat'] })}>
                    <option value="br">1.234,56</option>
                    <option value="us">1,234.56</option>
                  </NativeSelect>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {source === 'card' ? 'Na fatura, valor positivo é compra (saída) e negativo é pagamento ou estorno.' : 'No extrato, valor negativo é saída e positivo é entrada.'} Datas com ano de 2 dígitos são lidas como 20AA.
              </p>
            </fieldset>
          )}

          {/* Prévia */}
          {result && (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">{count}</span> {count === 1 ? 'movimentação encontrada' : 'movimentações encontradas'}
                  {result.skipped.length > 0 && <span className="text-muted-foreground"> · {result.skipped.length} linha(s) ignorada(s)</span>}
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
                  Inverter entradas e saídas
                </label>
              </div>
              {count > 0 && (
                <div className="max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0 bg-popover text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Data</th>
                        <th className="px-2 py-1.5 font-medium">Descrição</th>
                        <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.transactions.slice(0, 50).map((t, i) => (
                        <tr key={i} className="border-t">
                          <td className="whitespace-nowrap px-2 py-1 tabular-nums">{t.date.split('-').reverse().join('/')}</td>
                          <td className="max-w-[18rem] truncate px-2 py-1">{t.description}</td>
                          <td className={cn('whitespace-nowrap px-2 py-1 text-right tabular-nums', t.direction === 'out' ? 'text-negative' : 'text-positive')}>
                            {t.direction === 'out' ? '−' : '+'}
                            {formatMoney(t.cents / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {count > 50 && <p className="border-t px-2 py-1 text-xs text-muted-foreground">E mais {count - 50}.</p>}
                </div>
              )}
              {result.skipped.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Ver linhas ignoradas</summary>
                  <ul className="mt-1 grid gap-0.5">
                    {result.skipped.slice(0, 20).map((s, i) => (
                      <li key={i}>{s.line ? `Linha ${s.line}: ` : ''}{s.reason}</li>
                    ))}
                    {result.skipped.length > 20 && <li>E mais {result.skipped.length - 20}.</li>}
                  </ul>
                </details>
              )}
              {tooMany && <p className="text-sm text-negative">O arquivo tem {count} movimentações; a planilha aceita até {maxRows} por vez.</p>}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirm} disabled={!canImport}>
              {count > 0 ? `Adicionar ${count} à planilha` : 'Adicionar à planilha'}
            </Button>
          </div>
          {loaded && !accountId && count > 0 && <p className="-mt-3 text-right text-xs text-muted-foreground">{source === 'card' ? 'Escolha o cartão' : 'Escolha a conta'} para continuar.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
