import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdatePreferences, type ThemePreference } from '@/features/preferences/api'
import { toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useTheme } from '@/providers/ThemeProvider'
import { SettingsBlock } from './SettingsBlock'

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: 'system', label: 'Automático', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
]

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const update = useUpdatePreferences()

  function choose(value: ThemePreference) {
    const previous = theme
    setTheme(value)
    update.mutate(
      { theme: value },
      {
        onError: (err) => {
          setTheme(previous)
          toast.error(toUserMessage(err, 'Não foi possível salvar o tema.'))
        },
      },
    )
  }

  return (
    <SettingsBlock
      title="Tema"
      description="Automático acompanha a configuração do seu aparelho. A escolha vale em todos os dispositivos em que você entrar."
    >
      <div role="radiogroup" aria-label="Tema" className="grid max-w-md grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const selected = theme === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(opt.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary bg-primary/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/60',
              )}
            >
              <opt.icon className={cn('size-5', selected && 'text-primary')} aria-hidden="true" />
              {opt.label}
            </button>
          )
        })}
      </div>
    </SettingsBlock>
  )
}
