import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Check, ExternalLink, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useCategories } from '@/features/categories/api'
import { useCreateTransaction } from '@/features/transactions/api'
import { TransactionDialog, type TransactionPrefill } from '@/features/transactions/TransactionDialog'
import { seriesFuturePending } from '@/features/transactions/validate'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCurrentSpace } from '@/providers/SpaceProvider'
import { respond } from './engine'
import { blocksToText, money, shortDate } from './format'
import { saveMessages, useAssistantHistory, useClearHistory } from './history'
import { createSupabaseDataSource } from './queries'
import { STARTER_SUGGESTIONS } from './static'
import { EMPTY_CONTEXT, type Block, type ConversationContext, type Draft, type Reply } from './types'

/*
  Interface do Assistente Financeiro (carregada sob demanda).
  Painel lateral no computador e tela cheia no celular. Abrir o painel não dispara nenhuma consulta
  além do histórico; as consultas acontecem só quando o usuário envia uma mensagem.
*/

type DraftState = 'pending' | 'saving' | 'saved' | 'cancelled' | 'edited' | 'duplicate' | 'error'

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; reply?: Reply; text?: string }

let seq = 0
const nextId = () => `m${Date.now()}-${++seq}`

/** Negrito simples: **texto**. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return (
        <p className="leading-relaxed">
          <RichText text={block.text} />
        </p>
      )
    case 'note':
      return (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <RichText text={block.text} />
        </p>
      )
    case 'list':
      return (
        <ul className="grid gap-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span aria-hidden="true" className="mt-[0.6em] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ul>
      )
    case 'facts':
      return (
        <dl className="divide-y rounded-md border bg-background/60">
          {block.items.map((f, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-[13px]">
              <dt className="min-w-0 text-muted-foreground">{f.label}</dt>
              <dd
                className={cn(
                  'shrink-0 text-right font-medium tabular-nums',
                  f.tone === 'positive' && 'text-positive',
                  f.tone === 'negative' && 'text-negative',
                  f.tone === 'muted' && 'text-muted-foreground',
                )}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )
  }
}

const KIND_LABEL: Record<Draft['kind'], string> = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }

function DraftCard({
  draft,
  state,
  onConfirm,
  onEdit,
  onCancel,
  today,
}: {
  draft: Draft
  state: DraftState
  onConfirm: () => void
  onEdit: () => void
  onCancel: () => void
  today: string
}) {
  const rows: Array<[string, ReactNode]> = [
    ['Descrição', draft.description],
    ['Valor', <span className="font-semibold tabular-nums">{money(draft.amount)}</span>],
    ['Data', shortDate(draft.occurredOn, today)],
  ]
  if (draft.kind === 'transfer') {
    rows.push(['De', draft.accountName ?? '—'], ['Para', draft.transferAccountName ?? '—'])
  } else {
    rows.push(['Categoria', draft.categoryName ?? 'Sem categoria'], [draft.onCard ? 'Cartão' : 'Conta', draft.accountName ?? 'Sem conta'])
  }
  if (draft.series) {
    rows.push([
      draft.series.kind === 'installment' ? 'Parcelamento' : 'Repetição',
      draft.series.kind === 'installment'
        ? `${draft.series.count}x (cerca de ${money(Math.round((draft.amount / draft.series.count) * 100) / 100)})`
        : `Todo mês, ${draft.series.count} vezes`,
    ])
  }
  rows.push(['Situação', draft.status === 'pending' ? (draft.kind === 'income' ? 'A receber' : 'A pagar') : draft.kind === 'income' ? 'Recebida' : 'Paga'])
  rows.push(['Espaço', draft.spaceName])

  const locked = state !== 'pending' && state !== 'error' && state !== 'saving'
  const status: Partial<Record<DraftState, { text: string; className: string }>> = {
    saved: { text: 'Registrado', className: 'text-positive' },
    cancelled: { text: 'Cancelado — nada foi salvo', className: 'text-muted-foreground' },
    edited: { text: 'Aberto no formulário', className: 'text-muted-foreground' },
    duplicate: { text: 'Já tinha sido registrado', className: 'text-muted-foreground' },
    error: { text: 'Não foi possível salvar. Tente de novo.', className: 'text-negative' },
  }

  return (
    <div className={cn('rounded-lg border bg-surface p-3 shadow-sm', locked && 'opacity-80')} aria-label={`Prévia: ${KIND_LABEL[draft.kind]}`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABEL[draft.kind]}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {status[state] && <p className={cn('mt-2 text-xs font-medium', status[state]!.className)}>{status[state]!.text}</p>}
      {!locked && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" onClick={onConfirm} loading={state === 'saving'} aria-label="Confirmar e salvar o lançamento">
            {state !== 'saving' && <Check aria-hidden="true" />}
            Confirmar
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit} disabled={state === 'saving'}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={state === 'saving'}>
            Cancelar
          </Button>
        </div>
      )}
      {state === 'saving' && <span className="sr-only">Salvando…</span>}
    </div>
  )
}

export default function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current } = useCurrentSpace()
  const spaceId = current?.id
  const qc = useQueryClient()
  const history = useAssistantHistory(open ? spaceId : undefined)
  const categories = useCategories(spaceId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [ctx, setCtx] = useState<ConversationContext>(EMPTY_CONTEXT)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftStates, setDraftStates] = useState<Record<string, DraftState>>({})
  const [editing, setEditing] = useState<Draft | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const create = useCreateTransaction(spaceId ?? '')
  const clear = useClearHistory(spaceId ?? '')

  const ds = useMemo(
    () => (current ? createSupabaseDataSource({ id: current.id, name: current.name, type: current.type }, qc) : null),
    [current, qc],
  )
  const today = ds?.today ?? ''

  // Trocar de espaço começa uma conversa nova (o contexto é por espaço).
  useEffect(() => {
    setMessages([])
    setCtx(EMPTY_CONTEXT)
    setDraftStates({})
  }, [spaceId])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !editing && !confirmClear) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, editing, confirmClear])

  const allDrafts = useMemo(() => {
    const map = new Map<string, Draft>()
    for (const m of messages) if (m.role === 'assistant') for (const d of m.reply?.drafts ?? []) map.set(d.id, d)
    return map
  }, [messages])

  function push(...items: ChatMessage[]) {
    setMessages((prev) => [...prev, ...items])
  }

  function persist(items: Array<{ role: 'user' | 'assistant'; content: string }>) {
    if (!spaceId) return
    saveMessages(spaceId, items).catch(() => {
      // O histórico é um complemento: falhar ao salvá-lo não deve atrapalhar a conversa.
    })
  }

  async function confirmDrafts(ids: string[]) {
    const results: string[] = []
    for (const id of ids) {
      const d = allDrafts.get(id)
      const state = draftStates[id] ?? 'pending'
      if (!d || (state !== 'pending' && state !== 'error')) continue
      setDraftStates((s) => ({ ...s, [id]: 'saving' }))
      try {
        await create.mutateAsync({
          kind: d.kind,
          description: d.description,
          amount: d.amount,
          occurredOn: d.occurredOn,
          categoryId: d.categoryId,
          accountId: d.accountId,
          transferAccountId: d.transferAccountId,
          status: d.status,
          notes: '',
          series: d.series ? { kind: d.series.kind, count: d.series.count, futurePending: seriesFuturePending(d.kind, d.onCard) } : undefined,
          // Código único do rascunho: o banco recusa um segundo registro com o mesmo código.
          externalRef: `assistente:${d.id}`,
        })
        setDraftStates((s) => ({ ...s, [id]: 'saved' }))
        results.push(`✓ ${d.description}: ${money(d.amount)}${d.series ? ` (${d.series.count}x)` : ''}`)
      } catch (err) {
        const code = (err as { code?: string })?.code
        if (code === '23505') {
          setDraftStates((s) => ({ ...s, [id]: 'duplicate' }))
          results.push(`${d.description}: já tinha sido registrado, nada foi duplicado.`)
        } else {
          setDraftStates((s) => ({ ...s, [id]: 'error' }))
          results.push(`✗ ${d.description}: ${toUserMessage(err, 'não foi possível salvar.')}`)
        }
      }
    }
    setCtx((c) => ({ ...c, pendingDrafts: c.pendingDrafts.filter((d) => !ids.includes(d.id)) }))
    if (results.length) {
      const reply: Reply = {
        intent: 'confirm',
        blocks: [{ type: 'text', text: results.length === 1 && results[0].startsWith('✓') ? 'Pronto, registrei:' : 'Resultado:' }, { type: 'list', items: results }],
        links: [{ label: 'Ver movimentações', to: '/movimentacoes' }],
      }
      push({ id: nextId(), role: 'assistant', reply })
      persist([{ role: 'assistant', content: blocksToText(reply.blocks) }])
    }
  }

  function cancelDrafts(ids: string[], announce: boolean) {
    setDraftStates((s) => ({ ...s, ...Object.fromEntries(ids.filter((id) => (s[id] ?? 'pending') === 'pending').map((id) => [id, 'cancelled' as const])) }))
    setCtx((c) => ({ ...c, pendingDrafts: c.pendingDrafts.filter((d) => !ids.includes(d.id)) }))
    if (announce) push({ id: nextId(), role: 'assistant', reply: { intent: 'cancel', blocks: [{ type: 'text', text: 'Cancelado. Nada foi registrado.' }] } })
  }

  async function send(raw: string) {
    const message = raw.trim()
    if (!message || busy || !ds) return
    setInput('')
    push({ id: nextId(), role: 'user', text: message })
    setBusy(true)
    try {
      const { reply, ctx: next } = await respond(message, ctx, ds)
      setCtx(next)
      if (reply.effect?.type === 'confirm') {
        persist([{ role: 'user', content: message }])
        await confirmDrafts(reply.effect.draftIds)
        return
      }
      if (reply.effect?.type === 'cancel') cancelDrafts(reply.effect.draftIds, false)
      if (reply.effect?.type === 'clear-history') {
        await clear.mutateAsync()
        setMessages([])
        setCtx(EMPTY_CONTEXT)
        toast.success('Histórico apagado.')
        return
      }
      // Um rascunho novo substitui os anteriores que ainda não foram confirmados.
      if (reply.drafts?.length) {
        const stale = ctx.pendingDrafts.map((d) => d.id)
        if (stale.length) cancelDrafts(stale, false)
      }
      push({ id: nextId(), role: 'assistant', reply })
      persist([
        { role: 'user', content: message },
        { role: 'assistant', content: blocksToText(reply.blocks) },
      ])
    } catch (err) {
      push({ id: nextId(), role: 'assistant', text: toUserMessage(err, 'Algo deu errado. Tente de novo.') })
    } finally {
      setBusy(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  const prefill: TransactionPrefill | undefined = editing
    ? {
        kind: editing.kind,
        amount: editing.amount,
        description: editing.description,
        occurredOn: editing.occurredOn,
        accountId: editing.accountId,
        transferAccountId: editing.transferAccountId,
        categoryId: editing.categoryId,
        status: editing.status,
        repeat: editing.series ?? undefined,
      }
    : undefined

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const suggestions =
    messages.length === 0 ? STARTER_SUGGESTIONS : lastAssistant?.role === 'assistant' && !busy ? (lastAssistant.reply?.suggestions ?? []) : []
  const stored = history.data ?? []

  return (
    <>
      <section
        role="dialog"
        aria-modal="false"
        aria-label="Assistente Financeiro"
        className={cn(
          open ? 'flex' : 'hidden',
          'fixed inset-0 z-50 flex-col bg-background lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[420px] lg:border-l lg:shadow-xl',
          'pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] lg:pb-0 lg:pt-0',
        )}
      >
        <header className="flex items-center gap-2 border-b bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold leading-tight">Assistente Financeiro</h2>
            <p className="truncate text-xs text-muted-foreground">Espaço {current?.name ?? '—'} · responde com base nos seus dados</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais opções do assistente">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setConfirmClear(true)} disabled={!spaceId}>
                <Trash2 aria-hidden="true" className="size-4" />
                Apagar histórico
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar o assistente">
            <X aria-hidden="true" />
          </Button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={busy}>
          {stored.length > 0 && messages.length === 0 && (
            <div className="mb-4 grid gap-2">
              <p className="text-center text-xs text-muted-foreground">Conversas anteriores</p>
              {stored.map((m) => (
                <div key={m.id} className={cn('max-w-[88%] whitespace-pre-line rounded-lg px-3 py-2 text-[13px] opacity-75', m.role === 'user' ? 'ml-auto bg-primary/10' : 'bg-muted')}>
                  {m.content}
                </div>
              ))}
              <hr className="my-2" />
            </div>
          )}

          {messages.length === 0 && (
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p className="text-foreground">Olá! Pergunte sobre seus gastos, saldos, faturas e metas, ou registre uma movimentação.</p>
              <p className="text-xs">Eu sempre mostro uma prévia e só salvo depois da sua confirmação.</p>
            </div>
          )}

          <ol className="grid gap-3">
            {messages.map((m) =>
              m.role === 'user' ? (
                <li key={m.id} className="ml-auto max-w-[85%] whitespace-pre-line rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {m.text}
                </li>
              ) : (
                <li key={m.id} className="grid max-w-[95%] gap-2 text-sm">
                  {m.text && <p>{m.text}</p>}
                  {m.reply && m.reply.blocks.length > 0 && (
                    <div className="grid gap-2 rounded-lg rounded-bl-sm bg-muted px-3 py-2.5">
                      {m.reply.blocks.map((b, i) => (
                        <BlockView key={i} block={b} />
                      ))}
                    </div>
                  )}
                  {m.reply?.drafts?.map((d) => (
                    <DraftCard
                      key={d.id}
                      draft={d}
                      today={today}
                      state={draftStates[d.id] ?? 'pending'}
                      onConfirm={() => void confirmDrafts([d.id])}
                      onEdit={() => {
                        setEditing(d)
                        cancelDrafts([d.id], false)
                        setDraftStates((s) => ({ ...s, [d.id]: 'edited' }))
                      }}
                      onCancel={() => cancelDrafts([d.id], true)}
                    />
                  ))}
                  {m.reply?.drafts && m.reply.drafts.length > 1 && m.reply.drafts.some((d) => (draftStates[d.id] ?? 'pending') === 'pending') && (
                    <Button size="sm" variant="secondary" onClick={() => void confirmDrafts(m.reply!.drafts!.map((d) => d.id))}>
                      Confirmar todos
                    </Button>
                  )}
                  {m.reply?.choices && m.reply.choices.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.reply.choices.map((c) => (
                        <Button key={c.label} size="sm" variant="outline" disabled={busy} onClick={() => void send(c.message)}>
                          {c.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  {m.reply?.links && m.reply.links.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {m.reply.links.map((l) =>
                        /^https?:/.test(l.to) ? (
                          <a key={l.to} href={l.to} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">
                            {l.label}
                            <ExternalLink aria-hidden="true" className="size-3" />
                            <span className="sr-only">(abre em nova aba)</span>
                          </a>
                        ) : (
                          <Link
                            key={l.to}
                            to={l.to}
                            onClick={() => {
                              if (window.matchMedia('(max-width: 1023px)').matches) onClose()
                            }}
                            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {l.label} →
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </li>
              ),
            )}
            {busy && (
              <li className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                <span className="ml-1">Consultando…</span>
              </li>
            )}
          </ol>
        </div>

        <div className="border-t bg-surface px-3 pb-3 pt-2">
          {suggestions.length > 0 && (
            <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Sugestões">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(s)}
                  className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <label htmlFor="assistant-input" className="sr-only">
              Mensagem para o Assistente Financeiro
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ou registre: “gastei 50 no mercado”"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="icon" className="h-10 w-10" disabled={!input.trim() || busy || !ds} aria-label="Enviar mensagem">
              <ArrowUp aria-hidden="true" />
            </Button>
          </form>
        </div>
      </section>

      {editing && spaceId && (
        <TransactionDialog
          spaceId={spaceId}
          categories={categories.data ?? []}
          prefill={prefill}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Apagar histórico do assistente?"
        description="As mensagens desta conversa neste espaço serão apagadas. Suas movimentações não são afetadas."
        confirmLabel="Apagar histórico"
        onConfirm={async () => {
          try {
            await clear.mutateAsync()
            setMessages([])
            setCtx(EMPTY_CONTEXT)
            toast.success('Histórico apagado.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível apagar o histórico.'))
            throw err
          }
        }}
      />
    </>
  )
}
