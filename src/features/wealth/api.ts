import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type AssetType = 'investment' | 'property' | 'vehicle' | 'other'
export type LiabilityType = 'financing' | 'loan' | 'other'

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  investment: 'Investimento',
  property: 'Imóvel',
  vehicle: 'Veículo',
  other: 'Outro bem',
}

export const LIABILITY_TYPE_LABEL: Record<LiabilityType, string> = {
  financing: 'Financiamento',
  loan: 'Empréstimo',
  other: 'Outra dívida',
}

export type Asset = {
  id: string
  name: string
  type: AssetType
  value: number
  notes: string | null
  archived: boolean
  createdBy: string | null
  updatedAt: string
}

export type Liability = {
  id: string
  name: string
  type: LiabilityType
  balance: number
  monthlyPayment: number | null
  notes: string | null
  archived: boolean
  createdBy: string | null
  updatedAt: string
}

export type Snapshot = { month: string; accounts: number; assets: number; liabilities: number; netWorth: number }

const wealthKey = (spaceId: string) => ['wealth', spaceId] as const

export async function fetchAssets(spaceId: string): Promise<Asset[]> {
  const { data, error } = await supabase.from('assets').select('*').eq('space_id', spaceId).order('value', { ascending: false })
  if (error) throw error
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: (a.type in ASSET_TYPE_LABEL ? a.type : 'other') as AssetType,
    value: Number(a.value),
    notes: a.notes,
    archived: a.archived,
    createdBy: a.created_by,
    updatedAt: a.updated_at,
  }))
}

export function useAssets(spaceId: string | undefined) {
  return useQuery({
    queryKey: [...wealthKey(spaceId ?? 'none'), 'assets'],
    enabled: Boolean(spaceId),
    queryFn: () => fetchAssets(spaceId!),
  })
}

export async function fetchLiabilities(spaceId: string): Promise<Liability[]> {
  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .eq('space_id', spaceId)
    .order('balance', { ascending: false })
  if (error) throw error
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    type: (l.type in LIABILITY_TYPE_LABEL ? l.type : 'other') as LiabilityType,
    balance: Number(l.balance),
    monthlyPayment: l.monthly_payment === null ? null : Number(l.monthly_payment),
    notes: l.notes,
    archived: l.archived,
    createdBy: l.created_by,
    updatedAt: l.updated_at,
  }))
}

export function useLiabilities(spaceId: string | undefined) {
  return useQuery({
    queryKey: [...wealthKey(spaceId ?? 'none'), 'liabilities'],
    enabled: Boolean(spaceId),
    queryFn: () => fetchLiabilities(spaceId!),
  })
}

export async function fetchSnapshots(spaceId: string): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .select('*')
    .eq('space_id', spaceId)
    .order('month', { ascending: true })
    .limit(120)
  if (error) throw error
  return (data ?? []).map((s) => ({
    month: s.month.slice(0, 7),
    accounts: Number(s.accounts),
    assets: Number(s.assets),
    liabilities: Number(s.liabilities),
    netWorth: Number(s.net_worth),
  }))
}

export function useSnapshots(spaceId: string | undefined) {
  return useQuery({
    queryKey: [...wealthKey(spaceId ?? 'none'), 'snapshots'],
    enabled: Boolean(spaceId),
    queryFn: () => fetchSnapshots(spaceId!),
  })
}

async function recordSnapshot(spaceId: string) {
  const { error } = await supabase.rpc('record_net_worth_snapshot', { p_space_id: spaceId })
  if (error) throw error
}

/** Atualiza a linha do mês atual no histórico do patrimônio. */
export function useRecordSnapshot(spaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => recordSnapshot(spaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...wealthKey(spaceId), 'snapshots'] }),
  })
}

function useAfterChange(spaceId: string) {
  const queryClient = useQueryClient()
  return async () => {
    // O histórico do mês acompanha cada mudança; uma falha aqui não desfaz a alteração feita.
    await recordSnapshot(spaceId).catch(() => undefined)
    await queryClient.invalidateQueries({ queryKey: wealthKey(spaceId) })
  }
}

export type AssetInput = { name: string; type: AssetType; value: number; notes: string }

export function useSaveAsset(spaceId: string) {
  const after = useAfterChange(spaceId)
  return useMutation({
    mutationFn: async ({ id, ...input }: AssetInput & { id?: string }) => {
      const row = { name: input.name.trim(), type: input.type, value: input.value, notes: input.notes.trim() || null }
      if (id) {
        const { data, error } = await supabase.from('assets').update(row).eq('id', id).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('Você não tem permissão para editar este bem.')
      } else {
        const { error } = await supabase.from('assets').insert({ space_id: spaceId, ...row })
        if (error) throw error
      }
    },
    onSuccess: after,
  })
}

export type LiabilityInput = { name: string; type: LiabilityType; balance: number; monthlyPayment: number | null; notes: string }

export function useSaveLiability(spaceId: string) {
  const after = useAfterChange(spaceId)
  return useMutation({
    mutationFn: async ({ id, ...input }: LiabilityInput & { id?: string }) => {
      const row = {
        name: input.name.trim(),
        type: input.type,
        balance: input.balance,
        monthly_payment: input.monthlyPayment,
        notes: input.notes.trim() || null,
      }
      if (id) {
        const { data, error } = await supabase.from('liabilities').update(row).eq('id', id).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('Você não tem permissão para editar esta dívida.')
      } else {
        const { error } = await supabase.from('liabilities').insert({ space_id: spaceId, ...row })
        if (error) throw error
      }
    },
    onSuccess: after,
  })
}

export function useDeleteWealthItem(spaceId: string) {
  const after = useAfterChange(spaceId)
  return useMutation({
    mutationFn: async ({ table, id }: { table: 'assets' | 'liabilities'; id: string }) => {
      const { data, error } =
        table === 'assets'
          ? await supabase.from('assets').delete().eq('id', id).select('id')
          : await supabase.from('liabilities').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Só quem cadastrou, o proprietário ou um administrador pode excluir.')
      }
    },
    onSuccess: after,
  })
}
