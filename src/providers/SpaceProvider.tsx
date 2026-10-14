import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { usePreferences, useUpdatePreferences } from '@/features/preferences/api'
import { useSpaces, type Space } from '@/features/spaces/api'
import { toUserMessage } from '@/lib/errors'

type SpaceState = {
  spaces: Space[]
  current: Space | null
  isLoading: boolean
  error: unknown
  switchSpace: (spaceId: string) => void
}

const SpaceContext = createContext<SpaceState | null>(null)

/**
 * Espaço financeiro ativo. A escolha é salva em user_preferences.default_space_id,
 * então o mesmo espaço abre em qualquer dispositivo.
 */
export function SpaceProvider({ children }: { children: ReactNode }) {
  const spacesQuery = useSpaces()
  const preferencesQuery = usePreferences()
  const updatePreferences = useUpdatePreferences()

  const spaces = useMemo(() => spacesQuery.data ?? [], [spacesQuery.data])
  const preferredId = preferencesQuery.data?.default_space_id ?? null

  const current = useMemo(() => {
    if (spaces.length === 0) return null
    return (
      spaces.find((s) => s.id === preferredId) ??
      spaces.find((s) => s.type === 'personal') ??
      spaces[0]
    )
  }, [spaces, preferredId])

  const { mutate } = updatePreferences
  const switchSpace = useCallback(
    (spaceId: string) => {
      mutate(
        { default_space_id: spaceId },
        { onError: (err) => toast.error(toUserMessage(err, 'Não foi possível trocar de espaço.')) },
      )
    },
    [mutate],
  )

  const value = useMemo<SpaceState>(
    () => ({
      spaces,
      current,
      isLoading: spacesQuery.isPending || preferencesQuery.isPending,
      error: spacesQuery.error ?? preferencesQuery.error,
      switchSpace,
    }),
    [spaces, current, spacesQuery.isPending, preferencesQuery.isPending, spacesQuery.error, preferencesQuery.error, switchSpace],
  )

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useCurrentSpace() {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useCurrentSpace precisa estar dentro de <SpaceProvider>.')
  return ctx
}
