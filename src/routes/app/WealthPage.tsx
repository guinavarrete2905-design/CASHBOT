import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Car, Ellipsis, House, Landmark, Package, Pencil, Plus, Receipt, Trash2, TrendingUp, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/features/accounts/api'
import {
  ASSET_TYPE_LABEL,
  LIABILITY_TYPE_LABEL,
  useAssets,
  useDeleteWealthItem,
  useLiabilities,
  useRecordSnapshot,
  useSnapshots,
  type Asset,
  type AssetType,
  type Liability,
} from '@/features/wealth/api'
import { netWorth } from '@/features/wealth/calc'
import { AssetDialog, LiabilityDialog } from '@/features/wealth/dialogs'
import { NetWorthChart } from '@/features/wealth/NetWorthChart'
import { toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useUser } from '@/providers/AuthProvider'
import { useCurrentSpace } from '@/providers/SpaceProvider'

const ASSET_ICON: Record<AssetType, LucideIcon> = {
  investment: TrendingUp,
  property: House,
  vehicle: Car,
  other: Package,
}

function ItemMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações de ${label}`}>
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" />
          Atualizar valor
        </DropdownMenuItem>
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
              <Trash2 aria-hidden="true" />
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Row({ icon: Icon, title, subtitle, value, valueClass, menu }: {
  icon: LucideIcon
  title: string
  subtitle: string
  value: string
  valueClass?: string
  menu: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 py-3 pl-4 pr-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <p className={cn('tabular whitespace-nowrap text-sm font-medium', valueClass)}>{value}</p>
      {menu}
    </li>
  )
}

function updatedLabel(iso: string) {
  return `atualizado em ${new Date(iso).toLocaleDateString('pt-BR')}`
}

export function WealthPage() {
  const user = useUser()
  const { current } = useCurrentSpace()
  const spaceId = current?.id
  const canDeleteAny = current?.role === 'owner' || current?.role === 'admin'

  const accountsQuery = useAccounts(spaceId)
  const assetsQuery = useAssets(spaceId)
  const liabilitiesQuery = useLiabilities(spaceId)
  const snapshotsQuery = useSnapshots(spaceId)
  const record = useRecordSnapshot(spaceId ?? '')
  const remove = useDeleteWealthItem(spaceId ?? '')

  const [assetDialog, setAssetDialog] = useState<{ asset?: Asset } | null>(null)
  const [debtDialog, setDebtDialog] = useState<{ liability?: Liability } | null>(null)
  const [deleting, setDeleting] = useState<{ table: 'assets' | 'liabilities'; id: string; name: string } | null>(null)

  const assets = useMemo(() => (assetsQuery.data ?? []).filter((a) => !a.archived), [assetsQuery.data])
  const liabilities = useMemo(() => (liabilitiesQuery.data ?? []).filter((l) => !l.archived), [liabilitiesQuery.data])
  const accounts = accountsQuery.data ?? []
  const totals = netWorth({ accounts, assets, liabilities })

  // Ao abrir a página, atualiza o mês atual no histórico (os saldos mudam com as movimentações).
  const recordedFor = useRef<string | null>(null)
  const { mutate: recordMutate } = record
  useEffect(() => {
    if (!spaceId || recordedFor.current === spaceId) return
    recordedFor.current = spaceId
    recordMutate()
  }, [spaceId, recordMutate])

  const loading = !spaceId || accountsQuery.isPending || assetsQuery.isPending || liabilitiesQuery.isPending
  const error = accountsQuery.error ?? assetsQuery.error ?? liabilitiesQuery.error
  const snapshots = snapshotsQuery.data ?? []

  return (
    <>
      <PageHeader
        title="Patrimônio"
        description={current ? `O que ${current.name} tem e o que deve.` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDebtDialog({})} disabled={!spaceId}>
              <Plus aria-hidden="true" />
              Dívida
            </Button>
            <Button onClick={() => setAssetDialog({})} disabled={!spaceId}>
              <Plus aria-hidden="true" />
              Bem
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-48" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => { accountsQuery.refetch(); assetsQuery.refetch(); liabilitiesQuery.refetch() }} />
      ) : (
        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <div className="px-5 pb-4 pt-5">
              <p className="text-sm text-muted-foreground">Patrimônio líquido</p>
              <p
                className={cn(
                  'tabular mt-1 font-display text-3xl font-semibold',
                  totals.netWorth < 0 && 'text-negative',
                )}
              >
                {formatMoney(totals.netWorth)}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px border-t bg-border sm:grid-cols-3">
              <div className="bg-card px-5 py-3">
                <p className="text-xs text-muted-foreground">Saldo em contas</p>
                <p className="tabular mt-0.5 text-sm font-medium">{formatMoney(totals.accounts)}</p>
              </div>
              <div className="bg-card px-5 py-3">
                <p className="text-xs text-muted-foreground">Bens e investimentos</p>
                <p className="tabular mt-0.5 text-sm font-medium">{formatMoney(totals.assets)}</p>
              </div>
              <div className="bg-card px-5 py-3">
                <p className="text-xs text-muted-foreground">Dívidas e cartões</p>
                <p className={cn('tabular mt-0.5 text-sm font-medium', totals.liabilities > 0 && 'text-negative')}>
                  {totals.liabilities > 0 ? '−' : ''}
                  {formatMoney(totals.liabilities)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução do patrimônio líquido</CardTitle>
            </CardHeader>
            <CardContent>
              {snapshotsQuery.isPending ? (
                <Skeleton className="h-40" />
              ) : snapshots.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  O CashBot registra o patrimônio de cada mês automaticamente. O gráfico aparece a partir do segundo mês
                  registrado.
                </p>
              ) : (
                <NetWorthChart data={snapshots} />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="bens-titulo" className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="bens-titulo" className="font-sans text-base font-semibold">
                  Bens e investimentos
                </h2>
                <span className="tabular text-sm text-muted-foreground">{formatMoney(totals.assets)}</span>
              </div>
              {assets.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                  <p>Imóveis, veículos e aplicações que não ficam numa conta do CashBot.</p>
                  <Button variant="link" className="mt-1 h-auto px-0" onClick={() => setAssetDialog({})}>
                    Adicionar bem ou investimento
                  </Button>
                </div>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {assets.map((a) => (
                    <Row
                      key={a.id}
                      icon={ASSET_ICON[a.type]}
                      title={a.name}
                      subtitle={`${ASSET_TYPE_LABEL[a.type]} · ${updatedLabel(a.updatedAt)}`}
                      value={formatMoney(a.value)}
                      menu={
                        <ItemMenu
                          label={a.name}
                          onEdit={() => setAssetDialog({ asset: a })}
                          onDelete={
                            canDeleteAny || a.createdBy === user.id
                              ? () => setDeleting({ table: 'assets', id: a.id, name: a.name })
                              : undefined
                          }
                        />
                      }
                    />
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="dividas-titulo" className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="dividas-titulo" className="font-sans text-base font-semibold">
                  Dívidas e financiamentos
                </h2>
                <span className="tabular text-sm text-muted-foreground">{formatMoney(totals.debts)}</span>
              </div>
              {liabilities.length === 0 && totals.cardDebt === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                  <p>Financiamentos, empréstimos e outras dívidas, com o saldo que ainda falta pagar.</p>
                  <Button variant="link" className="mt-1 h-auto px-0" onClick={() => setDebtDialog({})}>
                    Adicionar dívida
                  </Button>
                </div>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {liabilities.map((l) => (
                    <Row
                      key={l.id}
                      icon={l.type === 'financing' ? Landmark : Receipt}
                      title={l.name}
                      subtitle={`${LIABILITY_TYPE_LABEL[l.type]}${l.monthlyPayment ? ` · parcela ${formatMoney(l.monthlyPayment)}` : ''} · ${updatedLabel(l.updatedAt)}`}
                      value={formatMoney(l.balance)}
                      valueClass="text-negative"
                      menu={
                        <ItemMenu
                          label={l.name}
                          onEdit={() => setDebtDialog({ liability: l })}
                          onDelete={
                            canDeleteAny || l.createdBy === user.id
                              ? () => setDeleting({ table: 'liabilities', id: l.id, name: l.name })
                              : undefined
                          }
                        />
                      }
                    />
                  ))}
                  {totals.cardDebt > 0 && (
                    <Row
                      icon={Receipt}
                      title="Cartões de crédito"
                      subtitle="Em aberto, calculado pelas compras lançadas"
                      value={formatMoney(totals.cardDebt)}
                      valueClass="text-negative"
                      menu={<span className="w-9" />}
                    />
                  )}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {assetDialog && spaceId && (
        <AssetDialog key={assetDialog.asset?.id ?? 'new'} spaceId={spaceId} asset={assetDialog.asset} onClose={() => setAssetDialog(null)} />
      )}
      {debtDialog && spaceId && (
        <LiabilityDialog
          key={debtDialog.liability?.id ?? 'new'}
          spaceId={spaceId}
          liability={debtDialog.liability}
          onClose={() => setDebtDialog(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir?"
        description={
          <>
            <strong className="font-medium text-foreground">{deleting?.name}</strong> deixará de contar no patrimônio. Os
            meses já registrados no histórico não mudam.
          </>
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync({ table: deleting.table, id: deleting.id })
            toast.success('Excluído.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível excluir.'))
            throw err
          }
        }}
      />
    </>
  )
}
