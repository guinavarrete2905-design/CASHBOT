import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown, Heart, Plus, User, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SPACE_TYPE_LABEL, type SpaceType } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useCurrentSpace } from '@/providers/SpaceProvider'

const TYPE_ICON: Record<SpaceType, typeof User> = { personal: User, couple: Heart, family: Users }

export function SpaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { spaces, current, isLoading, switchSpace } = useCurrentSpace()
  const navigate = useNavigate()

  if (isLoading) return <Skeleton className={cn('h-10', compact ? 'w-32' : 'w-full')} />
  if (!current) return null

  const Icon = TYPE_ICON[current.type]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex h-10 min-w-0 items-center gap-2 rounded-md border bg-surface px-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'max-w-[11rem]' : 'w-full',
        )}
        aria-label={`Espaço atual: ${current.name}. Trocar de espaço`}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Espaços</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.id} onValueChange={switchSpace}>
          {spaces.map((space) => (
            <DropdownMenuRadioItem key={space.id} value={space.id}>
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
              <span className="ml-3 text-xs text-muted-foreground">{SPACE_TYPE_LABEL[space.type]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/configuracoes/espacos')}>
          <Plus aria-hidden="true" />
          Criar ou gerenciar espaços
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
