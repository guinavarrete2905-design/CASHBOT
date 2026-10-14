import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ChartLine, Check, ListOrdered, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/features/profile/api'
import { cn } from '@/lib/utils'
import { useCurrentSpace } from '@/providers/SpaceProvider'

function monthLabel(date = new Date()) {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Indicador sem dados: mostra um traço e explica por quê, em vez de um valor inventado. */
function Indicator({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold text-muted-foreground/60" aria-label="Sem dados">
        —
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Panel({ title, icon, emptyTitle, children, className }: {
  title: string
  icon: LucideIcon
  emptyTitle: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState icon={icon} title={emptyTitle} className="border-0 px-0 py-2">
          {children}
        </EmptyState>
      </CardContent>
    </Card>
  )
}

function Step({ done, title, children }: { done?: boolean; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]',
          done ? 'border-positive bg-positive text-white' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="size-3" /> : null}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {title}
          {done && <span className="sr-only"> (concluído)</span>}
        </p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}

export function DashboardPage() {
  const { data: profile, isPending: profileLoading } = useProfile()
  const { current, spaces } = useCurrentSpace()
  const firstName = profile?.full_name?.trim().split(/\s+/)[0]
  const hasSharedSpace = spaces.some((s) => s.type !== 'personal')

  return (
    <>
      {profileLoading ? (
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <PageHeader
          title={firstName ? `${greeting()}, ${firstName}` : greeting()}
          description={
            <>
              {monthLabel()}
              {current && (
                <>
                  {' · '}
                  <span className="text-foreground">{current.name}</span>
                </>
              )}
            </>
          }
        />
      )}

      <section aria-labelledby="resumo-titulo" className="mb-6">
        <h2 id="resumo-titulo" className="sr-only">
          Resumo do mês
        </h2>
        <Card className="grid grid-cols-1 gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Indicator label="Saldo atual" hint="Aparece quando houver contas cadastradas." />
          <Indicator label="Receitas do mês" hint="Nenhuma receita registrada." />
          <Indicator label="Despesas do mês" hint="Nenhuma despesa registrada." />
          <Indicator label="Saldo projetado" hint="Depende de contas e vencimentos." />
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section aria-label="Primeiros passos" className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Primeiros passos</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4">
                <Step done title="Criar sua conta">
                  Seu espaço pessoal já está pronto.
                </Step>
                <Step title="Revisar as categorias">
                  <Link
                    to="/configuracoes/categorias"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    Ajustar categorias <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Step>
                <Step done={hasSharedSpace} title="Dividir com o casal ou a família (opcional)">
                  <Link
                    to="/configuracoes/espacos"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    {hasSharedSpace ? 'Gerenciar espaços' : 'Criar um espaço compartilhado'}{' '}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Step>
                <Step title="Registrar contas e movimentações">Chega na próxima etapa do CashBot.</Step>
              </ol>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-6 lg:col-span-3">
          <Panel title="Próximos vencimentos" icon={CalendarClock} emptyTitle="Nenhum vencimento por enquanto">
            Contas a pagar e faturas de cartão aparecerão aqui, em ordem de data.
          </Panel>
          <Panel title="Movimentações recentes" icon={ListOrdered} emptyTitle="Nenhuma movimentação ainda">
            As últimas receitas e despesas do espaço aparecerão aqui.
          </Panel>
        </div>

        <Panel
          title="Evolução financeira"
          icon={ChartLine}
          emptyTitle="Sem histórico para mostrar"
          className="lg:col-span-5"
        >
          O gráfico de evolução começa a ser desenhado a partir do primeiro mês com movimentações.
        </Panel>
      </div>
    </>
  )
}
