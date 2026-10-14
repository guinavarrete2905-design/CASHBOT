import { createContext, lazy, Suspense, useCallback, useContext, useState, type ReactNode } from 'react'
import { MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
  Ponto de entrada leve do Assistente Financeiro. O painel (e toda a lógica, regras e base de
  conhecimento) só é baixado na primeira vez que o usuário abre o assistente.
*/

const AssistantPanel = lazy(() => import('./AssistantPanel'))

type AssistantState = { open: boolean; toggle: () => void; close: () => void }
const AssistantContext = createContext<AssistantState | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // Depois de aberto uma vez, o painel fica montado para manter a conversa ao fechar e reabrir.
  const [mounted, setMounted] = useState(false)
  const toggle = useCallback(() => {
    setMounted(true)
    setOpen((v) => !v)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  return (
    <AssistantContext.Provider value={{ open, toggle, close }}>
      {children}
      {mounted && (
        <Suspense
          fallback={
            open ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 text-sm text-muted-foreground lg:left-auto lg:w-[420px] lg:border-l">
                Abrindo o assistente…
              </div>
            ) : null
          }
        >
          <AssistantPanel open={open} onClose={close} />
        </Suspense>
      )}
    </AssistantContext.Provider>
  )
}

function useAssistant() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant precisa estar dentro de AssistantProvider')
  return ctx
}

/** Botão discreto: item no menu lateral (desktop) ou ícone no topo (celular). */
export function AssistantButton({ compact = false }: { compact?: boolean }) {
  const { open, toggle } = useAssistant()
  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Abrir o Assistente Financeiro"
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessagesSquare className="size-5" aria-hidden="true" />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        open ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
    >
      <MessagesSquare className={cn('size-[18px]', open && 'text-primary')} aria-hidden="true" />
      Assistente Financeiro
    </button>
  )
}
