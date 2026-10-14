import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePreferences, useUpdatePreferences } from '@/features/preferences/api'
import { toUserMessage } from '@/lib/errors'
import { SettingsBlock } from './SettingsBlock'

const CURRENCIES = [
  { code: 'BRL', label: 'Real brasileiro (R$)' },
  { code: 'USD', label: 'Dólar americano (US$)' },
  { code: 'EUR', label: 'Euro (€)' },
]

export function GeneralSection() {
  const prefs = usePreferences()
  const update = useUpdatePreferences()

  if (prefs.isPending) return <Skeleton className="h-20 w-full max-w-md" />
  if (prefs.error) return <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} />

  return (
    <SettingsBlock
      title="Moeda principal"
      description="Usada para exibir valores quando as movimentações forem implementadas."
    >
      <div className="grid max-w-md gap-2">
        <Label htmlFor="currency">Moeda</Label>
        <NativeSelect
          id="currency"
          value={prefs.data?.currency ?? 'BRL'}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate(
              { currency: e.target.value },
              {
                onSuccess: () => toast.success('Moeda atualizada.'),
                onError: (err) => toast.error(toUserMessage(err, 'Não foi possível salvar a moeda.')),
              },
            )
          }
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </SettingsBlock>
  )
}
