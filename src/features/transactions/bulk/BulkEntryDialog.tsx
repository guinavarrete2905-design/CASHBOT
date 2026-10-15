import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDownToLine, CalendarDays, Copy, FileUp, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAccounts } from '@/features/accounts/api'
import { useCategories } from '@/features/categories/api'
import { todayISO } from '@/lib/dates'
import { toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { fetchExistingForDuplicates, useCreateBatch } from './api'
import { ImportDialog } from './import/ImportDialog'
import {
  applyPaste,
  buildBatch,
  emptyRow,
  evaluateRow,
  findDuplicates,
  formatAmountBR,
  isoToBR,
  KIND_LABEL,
  parseAmountBR,
  parseDateBR,
  REPEAT_LABEL,
  splitPaste,
  STATUS_LABEL,
  summarize,
  type BulkContext,
  type BulkRow,
  type DuplicateHint,
  type Field,
  type PasteColumn,
  type RowEvaluation,
} from './model'

/*
  Lançamento em massa: planilha editável dentro de Movimentações.
  Desktop: tabela com colunas. Celular: um cartão por linha. As regras são as do formulário individual
  (ver model.ts) e a gravação é transacional e idempotente (create_transactions_batch).
*/

const INITIAL_ROWS = 5
const MAX_ROWS = 500

type Col = Field
/** Colunas na ordem da tela (e da colagem). */
const COLUMNS: Array<{ col: Col; label: string; width: string; fill?: boolean }> = [
  { col: 'date', label: 'Data', width: 'w-[8.5rem]', fill: true },
  { col: 'kind', label: 'Tipo', width: 'w-[8.5rem]' },
  { col: 'description', label: 'Descrição', width: 'min-w-[12rem]' },
  { col: 'amount', label: 'Valor (R$)', width: 'w-[8rem]' },
  { col: 'account', label: 'Conta', width: 'w-[10rem]', fill: true },
  { col: 'category', label: 'Categoria / destino', width: 'w-[10.5rem]', fill: true },
  { col: 'status', label: 'Situação', width: 'w-[7.5rem]', fill: true },
  { col: 'repeat', label: 'Repetição', width: 'w-[10rem]' },
  { col: 'notes', label: 'Observações', width: 'min-w-[9rem]' },
]

const PASTE_TARGET: Record<Col, PasteColumn> = {
  date: 'date',
  kind: 'kind',
  description: 'description',
  amount: 'amount',
  account: 'account',
  category: 'category',
  transferAccount: 'category',
  status: 'status',
  repeat: 'repeat',
  count: 'repeat',
  notes: 'notes',
}

const cellBase =
  'h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm transition-colors placeholder:text-muted-foreground/60 hover:border-input focus-visible:border-ring focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'
const cellError = 'border-negative/70 bg-negative/5 hover:border-negative'
const selectBase = cn(cellBase, 'appearance-none pr-6')

function rowDefaults(rows: BulkRow[]): Partial<BulkRow> {
  const last = rows[rows.length - 1]
  return { date: last?.date || isoToBR(todayISO()) }
}

function stateLabel(ev: RowEvaluation) {
  if (ev.state === 'valid') return { text: 'Válida', className: 'text-positive' }
  if (ev.state === 'incomplete') return { text: 'Incompleta', className: 'text-muted-foreground' }
  if (ev.state === 'error') return { text: 'Com erro', className: 'text-negative' }
  return { text: 'Em branco', className: 'text-muted-foreground/60' }
}

export function BulkEntryDialog({ spaceId, spaceName, onClose }: { spaceId: string; spaceName: string; onClose: () => void }) {
  const accountsQuery = useAccounts(spaceId)
  const categoriesQuery = useCategories(spaceId)
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const ctx: BulkContext = useMemo(
    () => ({
      today: todayISO(),
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, archived: a.archived })),
      categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, archived: c.archived })),
    }),
    [accounts, categories],
  )

  const [rows, setRows] = useState<BulkRow[]>(() => {
    const first: BulkRow[] = []
    for (let i = 0; i < INITIAL_ROWS; i++) first.push(emptyRow({ date: isoToBR(todayISO()) }))
    return first
  })
  const [activeRow, setActiveRow] = useState(0)
  const [showIssues, setShowIssues] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [review, setReview] = useState<null | { loading: boolean; duplicates: DuplicateHint[]; error: string | null }>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const batchRef = useRef<{ key: string; id: string } | null>(null)
  const create = useCreateBatch(spaceId)

  const evaluations = useMemo(() => rows.map((r) => evaluateRow(r, ctx)), [rows, ctx])
  const summary = useMemo(() => summarize(rows, ctx), [rows, ctx])
  const dirty = rows.some((r) => evaluateRow(r, ctx).state !== 'empty')
  const issues = evaluations
    .map((ev, i) => ({ ev, i }))
    .filter(({ ev }) => ev.state === 'error' || ev.state === 'incomplete')

  // Fechar a aba com dados não salvos pede confirmação ao navegador.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const accountOptions = useMemo(() => {
    const active = accounts.filter((a) => !a.archived)
    return { regular: active.filter((a) => a.type !== 'credit_card'), cards: active.filter((a) => a.type === 'credit_card') }
  }, [accounts])

  // -------------------------------------------------------------------------
  // Edição
  // -------------------------------------------------------------------------

  const update = useCallback((index: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }, [])

  function changeKind(index: number, kind: BulkRow['kind']) {
    const row = rows[index]
    const keepCategory = categories.some((c) => c.id === row.categoryId && c.kind === kind)
    const unmatched = { ...(row.unmatched ?? {}) }
    delete unmatched.kind
    delete unmatched.category
    delete unmatched.transferAccount
    update(index, {
      kind,
      categoryId: kind === 'transfer' || !keepCategory ? '' : row.categoryId,
      transferAccountId: kind === 'transfer' ? row.transferAccountId : '',
      repeat: kind === 'transfer' && row.repeat === 'installment' ? 'none' : row.repeat,
      unmatched: Object.keys(unmatched).length ? unmatched : undefined,
    })
  }

  function clearUnmatched(index: number, key: keyof NonNullable<BulkRow['unmatched']>): BulkRow['unmatched'] {
    const u = { ...(rows[index].unmatched ?? {}) }
    delete u[key]
    return Object.keys(u).length ? u : undefined
  }

  function addRows(n: number) {
    setRows((prev) => {
      if (prev.length >= MAX_ROWS) {
        toast.error(`A planilha aceita até ${MAX_ROWS} linhas por vez.`)
        return prev
      }
      const next = [...prev]
      for (let i = 0; i < n && next.length < MAX_ROWS; i++) next.push(emptyRow(rowDefaults(next)))
      return next
    })
  }

  function duplicateRow(index: number) {
    setRows((prev) => {
      if (prev.length >= MAX_ROWS) return prev
      const copy = { ...prev[index], id: emptyRow().id }
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]
    })
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length === 1 ? [emptyRow(rowDefaults([]))] : prev.filter((_, i) => i !== index)))
  }

  /** Repete o valor da linha selecionada nas linhas de baixo (preenchimento determinístico). */
  function fillDown(col: Col) {
    const source = rows[activeRow]
    if (!source) return
    let changed = 0
    const next = rows.map((r, i) => {
      if (i <= activeRow) return r
      if (col === 'date') {
        changed++
        return { ...r, date: source.date }
      }
      if (col === 'account') {
        changed++
        const unmatched = { ...(r.unmatched ?? {}) }
        delete unmatched.account
        return { ...r, accountId: source.accountId, unmatched: Object.keys(unmatched).length ? unmatched : undefined }
      }
      if (col === 'status') {
        changed++
        return { ...r, status: source.status }
      }
      if (col === 'category' && r.kind === source.kind) {
        changed++
        return source.kind === 'transfer' ? { ...r, transferAccountId: source.transferAccountId } : { ...r, categoryId: source.categoryId }
      }
      return r
    })
    setRows(next)
    const name = COLUMNS.find((c) => c.col === col)?.label ?? ''
    toast.success(changed ? `${name}: valor da linha ${activeRow + 1} repetido em ${changed} ${changed === 1 ? 'linha' : 'linhas'} abaixo.` : 'Não há linhas abaixo para preencher.')
  }

  // -------------------------------------------------------------------------
  // Teclado e colagem
  // -------------------------------------------------------------------------

  function focusCell(row: number, col: Col) {
    requestAnimationFrame(() => {
      // A tabela (desktop) e os cartões (celular) existem juntos; foca o que está visível.
      const all = tableRef.current?.querySelectorAll<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`) ?? []
      const el = Array.from(all).find((x) => x.offsetParent !== null)
      el?.focus()
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>, row: number, col: Col) {
    const el = e.currentTarget
    const isText = el instanceof HTMLInputElement && el.type === 'text'
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (row === rows.length - 1) addRows(1)
      focusCell(row + 1, col)
    } else if (isText && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const target = e.key === 'ArrowDown' ? row + 1 : row - 1
      if (target < 0 || target >= rows.length) return
      e.preventDefault()
      focusCell(target, col)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLElement>, row: number, col: Col) {
    const grid = splitPaste(e.clipboardData.getData('text/plain'))
    if (!grid) return // valor simples: colagem normal do campo
    e.preventDefault()
    if (row + grid.length > MAX_ROWS) {
      toast.error(`A planilha aceita até ${MAX_ROWS} linhas por vez.`)
      return
    }
    const result = applyPaste(rows, row, PASTE_TARGET[col], grid, ctx)
    setRows(result.rows)
    toast.success(`${result.changed} ${result.changed === 1 ? 'linha colada' : 'linhas coladas'}. Confira as células destacadas.`)
    if (result.ignoredColumns > 0) toast.warning(`${result.ignoredColumns} coluna(s) a mais foram ignoradas (depois de Observações).`)
  }

  // -------------------------------------------------------------------------
  // Revisão e gravação
  // -------------------------------------------------------------------------

  async function openReview() {
    setShowIssues(true)
    if (issues.length > 0 || summary.valid === 0) return
    setReview({ loading: true, duplicates: [], error: null })
    try {
      const dates = evaluations.flatMap((ev) => (ev.parsed ? [ev.parsed.occurredOn] : [])).sort()
      const existing = await fetchExistingForDuplicates(spaceId, dates[0], dates[dates.length - 1])
      setReview({ loading: false, duplicates: findDuplicates(rows, ctx, existing), error: null })
    } catch {
      // Sem a consulta, a revisão continua: só o alerta de duplicados já gravados fica indisponível.
      setReview({ loading: false, duplicates: findDuplicates(rows, ctx, []), error: 'Não foi possível verificar duplicados já gravados.' })
    }
  }

  async function save() {
    const batch = buildBatch(rows, ctx, () => crypto.randomUUID())
    if (!batch.length) return
    // Mesmo conteúdo = mesmo lote: reenviar depois de uma falha de rede não duplica.
    const key = JSON.stringify(batch.map((b) => ({ ...b, series_id: null })))
    if (!batchRef.current || batchRef.current.key !== key) batchRef.current = { key, id: crypto.randomUUID() }
    try {
      const result = await create.mutateAsync({ batchId: batchRef.current.id, rows: batch })
      if (result.alreadySaved) toast.success(`Esse lote já tinha sido salvo (${result.inserted} movimentações). Nada foi duplicado.`)
      else toast.success(`${result.inserted} ${result.inserted === 1 ? 'movimentação criada' : 'movimentações criadas'}.`)
      setReview(null)
      onClose()
    } catch (err) {
      setReview((r) => (r ? { ...r, error: toUserMessage(err, 'Não foi possível salvar. Nada foi gravado; você pode tentar de novo.') } : r))
    }
  }

  function requestClose() {
    if (create.isPending) return
    if (dirty) setConfirmLeave(true)
    else onClose()
  }

  // -------------------------------------------------------------------------
  // Células
  // -------------------------------------------------------------------------

  function cell(row: BulkRow, index: number, col: Col, ev: RowEvaluation): ReactNode {
    const err = (f: Field) => ev.errors[f]
    const common = (f: Field) => ({
      'data-row': index,
      'data-col': col,
      'aria-invalid': Boolean(err(f)) || undefined,
      title: err(f),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => handleKeyDown(e, index, col),
      onPaste: (e: ClipboardEvent<HTMLElement>) => handlePaste(e, index, col),
      onFocus: () => setActiveRow(index),
    })
    const label = (text: string) => `${text}, linha ${index + 1}`
    switch (col) {
      case 'date':
        return (
          <div className="relative flex items-center">
            <input
              {...common('date')}
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              aria-label={label('Data')}
              value={row.date}
              maxLength={10}
              onChange={(e) => update(index, { date: e.target.value })}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (/^\d{8}$/.test(v)) update(index, { date: `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}` })
              }}
              className={cn(cellBase, 'pr-7 tabular-nums', err('date') && showIssues && cellError)}
            />
            <label className="absolute right-1 inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Escolher no calendário, linha {index + 1}</span>
              <input
                type="date"
                tabIndex={-1}
                className="absolute inset-0 cursor-pointer opacity-0"
                value={(() => {
                  const p = parseDateBR(row.date)
                  return p && 'iso' in p ? p.iso : ''
                })()}
                onChange={(e) => e.target.value && update(index, { date: isoToBR(e.target.value) })}
                onClick={(e) => {
                  try {
                    ;(e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
                  } catch {
                    /* navegador sem showPicker: o campo nativo abre sozinho */
                  }
                }}
              />
            </label>
          </div>
        )
      case 'kind':
        return (
          <select
            {...common('kind')}
            aria-label={label('Tipo')}
            value={row.kind}
            onChange={(e) => changeKind(index, e.target.value as BulkRow['kind'])}
            className={cn(selectBase, err('kind') && showIssues && cellError)}
          >
            {(['expense', 'income', 'transfer'] as const).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        )
      case 'description':
        return (
          <input
            {...common('description')}
            type="text"
            aria-label={label('Descrição')}
            placeholder={row.kind === 'transfer' ? 'Ex.: Pagamento da fatura' : 'Ex.: Mercado'}
            maxLength={140}
            value={row.description}
            onChange={(e) => update(index, { description: e.target.value })}
            className={cn(cellBase, err('description') && showIssues && cellError)}
          />
        )
      case 'amount':
        return (
          <input
            {...common('amount')}
            type="text"
            inputMode="decimal"
            aria-label={label('Valor em reais')}
            placeholder="0,00"
            value={row.amount}
            onChange={(e) => update(index, { amount: e.target.value })}
            onBlur={(e) => {
              const a = parseAmountBR(e.target.value)
              if (a && 'cents' in a) update(index, { amount: formatAmountBR(a.cents) })
            }}
            className={cn(cellBase, 'text-right tabular-nums', err('amount') && (showIssues || row.amount) && cellError)}
          />
        )
      case 'account':
        return (
          <select
            {...common('account')}
            aria-label={label(row.kind === 'transfer' ? 'Conta de origem' : 'Conta')}
            value={row.unmatched?.account ? '__unmatched' : row.accountId}
            onChange={(e) => update(index, { accountId: e.target.value, unmatched: clearUnmatched(index, 'account') })}
            className={cn(selectBase, err('account') && showIssues && cellError)}
          >
            {row.unmatched?.account && <option value="__unmatched">“{row.unmatched.account}” (não encontrada)</option>}
            <option value="">{row.kind === 'transfer' ? 'Origem…' : 'Sem conta'}</option>
            {accountOptions.regular.length > 0 && (
              <optgroup label="Contas">
                {accountOptions.regular.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {accountOptions.cards.length > 0 && (
              <optgroup label="Cartões">
                {accountOptions.cards.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )
      case 'category':
        if (row.kind === 'transfer') {
          return (
            <select
              {...common('transferAccount')}
              aria-label={label('Conta de destino')}
              value={row.unmatched?.transferAccount ? '__unmatched' : row.transferAccountId}
              onChange={(e) => update(index, { transferAccountId: e.target.value, unmatched: clearUnmatched(index, 'transferAccount') })}
              className={cn(selectBase, err('transferAccount') && showIssues && cellError)}
            >
              {row.unmatched?.transferAccount && <option value="__unmatched">“{row.unmatched.transferAccount}” (não encontrada)</option>}
              <option value="">Destino…</option>
              {[...accountOptions.regular, ...accountOptions.cards]
                .filter((a) => a.id !== row.accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          )
        }
        return (
          <select
            {...common('category')}
            aria-label={label('Categoria')}
            value={row.unmatched?.category ? '__unmatched' : row.categoryId}
            onChange={(e) => update(index, { categoryId: e.target.value, unmatched: clearUnmatched(index, 'category') })}
            className={cn(selectBase, err('category') && showIssues && cellError)}
          >
            {row.unmatched?.category && <option value="__unmatched">“{row.unmatched.category}” (não encontrada)</option>}
            <option value="">Sem categoria</option>
            {categories
              .filter((c) => c.kind === row.kind && !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        )
      case 'status': {
        const onCard = row.kind !== 'transfer' && accounts.some((a) => a.id === row.accountId && a.type === 'credit_card')
        return (
          <select
            {...common('status')}
            aria-label={label('Situação')}
            value={onCard ? 'paid' : row.status}
            disabled={onCard}
            title={onCard ? 'Compras no cartão entram na fatura; a situação é a da fatura.' : err('status')}
            onChange={(e) => update(index, { status: e.target.value as BulkRow['status'], unmatched: clearUnmatched(index, 'status') })}
            className={cn(selectBase, err('status') && showIssues && cellError)}
          >
            {onCard ? (
              <option value="paid">Na fatura</option>
            ) : (
              (['paid', 'pending'] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[row.kind][s]}
                </option>
              ))
            )}
          </select>
        )
      }
      case 'repeat':
        return (
          <div className="flex items-center gap-1">
            <select
              {...common('repeat')}
              aria-label={label('Repetição')}
              value={row.repeat}
              onChange={(e) => {
                const repeat = e.target.value as BulkRow['repeat']
                update(index, { repeat, count: repeat === 'none' ? '' : row.count || (repeat === 'recurring' ? '12' : '2'), unmatched: clearUnmatched(index, 'repeat') })
              }}
              className={cn(selectBase, 'flex-1', err('repeat') && showIssues && cellError)}
            >
              {(['none', 'installment', 'recurring'] as const)
                .filter((r) => !(row.kind === 'transfer' && r === 'installment'))
                .map((r) => (
                  <option key={r} value={r}>
                    {REPEAT_LABEL[r]}
                  </option>
                ))}
            </select>
            {row.repeat !== 'none' && (
              <input
                data-row={index}
                data-col="count"
                type="text"
                inputMode="numeric"
                aria-label={label(row.repeat === 'installment' ? 'Número de parcelas' : 'Número de meses')}
                aria-invalid={Boolean(err('count')) || undefined}
                title={err('count') ?? (row.repeat === 'installment' ? 'Parcelas (2 a 48)' : 'Meses (2 a 60)')}
                placeholder={row.repeat === 'installment' ? 'x' : 'meses'}
                value={row.count}
                maxLength={2}
                onChange={(e) => update(index, { count: e.target.value.replace(/\D/g, '') })}
                onKeyDown={(e) => handleKeyDown(e, index, 'count')}
                onFocus={() => setActiveRow(index)}
                className={cn(cellBase, 'w-12 shrink-0 text-center tabular-nums', err('count') && showIssues && cellError)}
              />
            )}
          </div>
        )
      case 'notes':
        return (
          <input
            {...common('notes')}
            type="text"
            aria-label={label('Observações')}
            maxLength={500}
            value={row.notes}
            onChange={(e) => update(index, { notes: e.target.value })}
            className={cn(cellBase, err('notes') && cellError)}
          />
        )
      default:
        return null
    }
  }

  function rowActions(index: number) {
    return (
      <div className="flex items-center justify-end gap-0.5">
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => duplicateRow(index)} aria-label={`Duplicar linha ${index + 1}`} title="Duplicar linha">
          <Copy className="!size-3.5" aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-7 hover:text-negative" onClick={() => removeRow(index)} aria-label={`Excluir linha ${index + 1}`} title="Excluir linha">
          <Trash2 className="!size-3.5" aria-hidden="true" />
        </Button>
      </div>
    )
  }

  const loading = accountsQuery.isLoading || categoriesQuery.isLoading
  const blocked = issues.length > 0
  const canReview = summary.valid > 0

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="left-0 top-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-[1400px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
        >
          <DialogHeader className="border-b px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:pt-5">
            <DialogTitle>Lançamento em massa</DialogTitle>
            <DialogDescription>
              Espaço <span className="font-medium text-foreground">{spaceName}</span> · preencha as linhas ou cole de uma planilha (Data, Tipo, Descrição, Valor, Conta, Categoria…).
            </DialogDescription>
          </DialogHeader>

          <div ref={tableRef} className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando contas e categorias…</p>
            ) : (
              <>
                {/* Desktop: tabela */}
                <table className="hidden w-full min-w-[1180px] border-separate border-spacing-0 text-sm md:table">
                  <thead className="sticky top-0 z-10 bg-popover">
                    <tr>
                      <th scope="col" className="w-10 border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                        #
                      </th>
                      {COLUMNS.map((c) => (
                        <th key={c.col} scope="col" className={cn('border-b px-1 py-2 text-left text-xs font-medium text-muted-foreground', c.width)}>
                          <span className="inline-flex items-center gap-1 px-1">
                            {c.label}
                            {c.fill && (
                              <button
                                type="button"
                                onClick={() => fillDown(c.col)}
                                className="rounded p-0.5 text-muted-foreground/70 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title={`Repetir a ${c.label.toLowerCase()} da linha ${activeRow + 1} nas linhas abaixo`}
                                aria-label={`Repetir ${c.label.toLowerCase()} da linha ${activeRow + 1} nas linhas abaixo`}
                              >
                                <ArrowDownToLine className="size-3" aria-hidden="true" />
                              </button>
                            )}
                          </span>
                        </th>
                      ))}
                      <th scope="col" className="w-20 border-b px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const ev = evaluations[i]
                      const st = stateLabel(ev)
                      return (
                        <tr key={row.id} className={cn('group', i === activeRow && 'bg-secondary/40')}>
                          <td className="border-b border-border/60 px-2 py-1 align-middle">
                            <span className={cn('text-xs tabular-nums', st.className)} title={st.text}>
                              {i + 1}
                            </span>
                          </td>
                          {COLUMNS.map((c) => (
                            <td key={c.col} className="border-b border-border/60 px-1 py-1 align-middle">
                              {cell(row, i, c.col, ev)}
                            </td>
                          ))}
                          <td className="border-b border-border/60 px-1 py-1 align-middle">{rowActions(i)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Celular: um cartão por linha */}
                <ol className="grid gap-3 p-4 md:hidden">
                  {rows.map((row, i) => {
                    const ev = evaluations[i]
                    const st = stateLabel(ev)
                    const field = (labelText: string, col: Col, span = false) => (
                      <div className={cn('grid gap-0.5', span && 'col-span-2')}>
                        <span className="text-[11px] text-muted-foreground">{labelText}</span>
                        <div className="rounded-md border border-input bg-surface">{cell(row, i, col, ev)}</div>
                      </div>
                    )
                    return (
                      <li key={row.id} className="rounded-lg border bg-card p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">
                            Linha {i + 1} <span className={cn('ml-1 text-xs font-normal', st.className)}>· {st.text}</span>
                          </p>
                          {rowActions(i)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {field('Data', 'date')}
                          {field('Tipo', 'kind')}
                          {field('Descrição', 'description', true)}
                          {field('Valor (R$)', 'amount')}
                          {field('Situação', 'status')}
                          {field(row.kind === 'transfer' ? 'Origem' : 'Conta', 'account')}
                          {field(row.kind === 'transfer' ? 'Destino' : 'Categoria', 'category')}
                          {field('Repetição', 'repeat', true)}
                          {field('Observações', 'notes', true)}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}

            <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6 md:pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => addRows(1)}>
                <Plus aria-hidden="true" />
                Adicionar linha
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => addRows(10)}>
                Adicionar 10 linhas
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(true)} disabled={loading}>
                <FileUp aria-hidden="true" />
                Importar arquivo (CSV, OFX, XLSX)
              </Button>
            </div>

            {showIssues && issues.length > 0 && (
              <div className="mx-4 mb-4 rounded-md border border-negative/30 bg-negative/5 p-3 text-sm sm:mx-6" role="alert">
                <p className="mb-1.5 flex items-center gap-1.5 font-medium text-negative">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Corrija ou remova estas linhas antes de revisar:
                </p>
                <ul className="grid gap-0.5 text-[13px]">
                  {issues.slice(0, 12).map(({ ev, i }) => (
                    <li key={rows[i].id}>
                      <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => focusCell(i, (Object.keys(ev.errors)[0] as Col) ?? 'date')}>
                        Linha {i + 1} — {Object.values(ev.errors)[0]}
                        {Object.keys(ev.errors).length > 1 && ` (+${Object.keys(ev.errors).length - 1})`}
                      </button>
                    </li>
                  ))}
                  {issues.length > 12 && <li className="text-muted-foreground">E mais {issues.length - 12} linhas.</li>}
                </ul>
              </div>
            )}
          </div>

          {/* Resumo + ações */}
          <div className="flex flex-col gap-3 border-t bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-4">
            <div className="grid gap-1 text-xs text-muted-foreground" aria-live="polite">
              <p>
                <span className="font-medium text-foreground">{summary.valid}</span> {summary.valid === 1 ? 'válida' : 'válidas'}
                {summary.incomplete > 0 && <> · {summary.incomplete} incompleta{summary.incomplete > 1 && 's'}</>}
                {summary.errors > 0 && <span className="text-negative"> · {summary.errors} com erro</span>}
              </p>
              <p className="tabular-nums">
                Receitas <span className="text-positive">{formatMoney(summary.income)}</span> · Despesas <span className="text-negative">{formatMoney(summary.expense)}</span> · Resultado{' '}
                <span className="text-foreground">{formatMoney(summary.result)}</span> · Transferências {formatMoney(summary.transfer)}
              </p>
              {(summary.futureInstallments > 0 || summary.futureRecurrences > 0) && (
                <p>Valores como informados nas linhas: parcelado conta o total da compra; “todo mês”, o valor de um mês.</p>
              )}
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <Button type="button" variant="ghost" onClick={requestClose} className="flex-1 sm:flex-none">
                Cancelar
              </Button>
              <Button type="button" onClick={() => void openReview()} disabled={!canReview || loading} className="flex-1 sm:flex-none">
                Revisar lançamentos
              </Button>
            </div>
          </div>
          {showIssues && blocked && <span className="sr-only">Há linhas com erro ou incompletas.</span>}
        </DialogContent>
      </Dialog>

      {/* Conferência antes de gravar */}
      <Dialog open={Boolean(review)} onOpenChange={(open) => !open && !create.isPending && setReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar lançamentos</DialogTitle>
            <DialogDescription>
              Confira antes de salvar no espaço <span className="font-medium text-foreground">{spaceName}</span>.
            </DialogDescription>
          </DialogHeader>
          {review?.loading ? (
            <p className="text-sm text-muted-foreground">Verificando possíveis duplicados…</p>
          ) : (
            <div className="grid gap-4 text-sm">
              <dl className="divide-y rounded-md border">
                {[
                  ['Linhas', String(summary.valid)],
                  ['Movimentações que serão criadas', String(summary.generated)],
                  ...(summary.futureInstallments > 0 ? [['Parcelas futuras', String(summary.futureInstallments)]] : []),
                  ...(summary.futureRecurrences > 0 ? [['Repetições mensais futuras', String(summary.futureRecurrences)]] : []),
                  ['Receitas', formatMoney(summary.generatedIncome)],
                  ['Despesas', formatMoney(summary.generatedExpense)],
                  ['Transferências', formatMoney(summary.generatedTransfer)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {summary.futureRecurrences > 0 && (
                <p className="text-xs text-muted-foreground">Os totais acima somam todas as movimentações que serão criadas, inclusive os meses futuros das repetições.</p>
              )}

              {review && review.duplicates.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                  <p className="mb-1 flex items-center gap-1.5 font-medium">
                    <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
                    Possíveis duplicados
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">Mesma data, valor, descrição e conta. Pode ser legítimo — revise e decida.</p>
                  <ul className="grid gap-1.5">
                    {review.duplicates.map((d) => {
                      const r = rows[d.rowIndex]
                      return (
                        <li key={`${d.rowIndex}-${d.kind}`} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                          <span>
                            Linha {d.rowIndex + 1} ({r?.description}, {r?.amount}) —{' '}
                            {d.kind === 'sheet' ? `igual à linha ${(d.withRow ?? 0) + 1}` : 'já existe uma movimentação igual'}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => {
                              removeRow(d.rowIndex)
                              setReview(null)
                              toast.success(`Linha ${d.rowIndex + 1} removida. Revise de novo quando quiser.`)
                            }}
                          >
                            Remover linha
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">Se estiver tudo certo, pode salvar assim mesmo.</p>
                </div>
              )}
              {review?.error && (
                <p className="rounded-md border border-negative/30 bg-negative/5 p-2 text-[13px] text-negative" role="alert">
                  {review.error}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setReview(null)} disabled={create.isPending}>
                  Voltar e editar
                </Button>
                <Button type="button" onClick={() => void save()} loading={create.isPending} disabled={create.isPending}>
                  {create.isPending ? 'Salvando…' : `Salvar ${summary.generated} ${summary.generated === 1 ? 'movimentação' : 'movimentações'}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {importOpen && (
        <ImportDialog
          accounts={ctx.accounts}
          categories={ctx.categories}
          maxRows={MAX_ROWS - rows.filter((r) => evaluateRow(r, ctx).state !== 'empty').length}
          onClose={() => setImportOpen(false)}
          onImport={(imported, fileName) => {
            // Linhas em branco dão lugar às importadas.
            const kept = rows.filter((r) => evaluateRow(r, ctx).state !== 'empty')
            setRows([...kept, ...imported])
            setImportOpen(false)
            setShowIssues(true)
            toast.success(`${imported.length} ${imported.length === 1 ? 'linha importada' : 'linhas importadas'} de ${fileName}. Revise antes de salvar.`)
          }}
        />
      )}

      {/* Sair sem salvar */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>Você possui movimentações não salvas. Deseja realmente sair?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmLeave(false)
                onClose()
              }}
            >
              Sair sem salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
