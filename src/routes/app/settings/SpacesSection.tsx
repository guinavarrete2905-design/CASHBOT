import { useState, type FormEvent } from 'react'
import { Ellipsis, Heart, LogOut, Pencil, Trash2, User, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState, FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateSpace, useDeleteSpace, useRemoveMember, useRenameSpace, type Space } from '@/features/spaces/api'
import { toUserMessage } from '@/lib/errors'
import {
  ROLE_LABEL,
  SPACE_TYPE_LABEL,
  canDeleteSpace,
  canInviteMembers,
  canLeaveSpace,
  canRenameSpace,
  type SpaceType,
} from '@/lib/permissions'
import { useUser } from '@/providers/AuthProvider'
import { useCurrentSpace } from '@/providers/SpaceProvider'
import { MembersDialog } from './MembersDialog'
import { SettingsBlock } from './SettingsBlock'

const TYPE_ICON: Record<SpaceType, typeof User> = { personal: User, couple: Heart, family: Users }

function RenameDialog({ space, onClose }: { space: Space; onClose: () => void }) {
  const rename = useRenameSpace()
  const [name, setName] = useState(space.name)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    rename.mutate(
      { spaceId: space.id, name },
      {
        onSuccess: () => {
          toast.success('Espaço renomeado.')
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível renomear o espaço.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear espaço</DialogTitle>
          <DialogDescription className="sr-only">Escolha um novo nome para o espaço.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <FormError message={error} />
          <div className="grid gap-2">
            <Label htmlFor="rename-space">Nome</Label>
            <Input id="rename-space" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={rename.isPending} disabled={!name.trim() || name.trim() === space.name}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Pending =
  | { kind: 'rename'; space: Space }
  | { kind: 'members'; space: Space }
  | { kind: 'delete'; space: Space }
  | { kind: 'leave'; space: Space }
  | null

function SpaceRow({ space, isCurrent, onAction }: {
  space: Space
  isCurrent: boolean
  onAction: (p: Exclude<Pending, null>) => void
}) {
  const Icon = TYPE_ICON[space.type]
  const actions = {
    members: space.type !== 'personal',
    rename: canRenameSpace(space.role),
    leave: canLeaveSpace(space.role),
    delete: canDeleteSpace(space.role, space.type),
  }
  const hasActions = Object.values(actions).some(Boolean)

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {space.name}
          {isCurrent && <span className="ml-2 text-xs font-normal text-muted-foreground">(em uso)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {SPACE_TYPE_LABEL[space.type]} · {ROLE_LABEL[space.role]}
        </p>
      </div>
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações do espaço ${space.name}`}>
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.members && (
              <DropdownMenuItem onSelect={() => onAction({ kind: 'members', space })}>
                <Users aria-hidden="true" />
                {canInviteMembers(space.role, space.type) ? 'Gerenciar membros' : 'Ver membros'}
              </DropdownMenuItem>
            )}
            {actions.rename && (
              <DropdownMenuItem onSelect={() => onAction({ kind: 'rename', space })}>
                <Pencil aria-hidden="true" />
                Renomear
              </DropdownMenuItem>
            )}
            {(actions.leave || actions.delete) && <DropdownMenuSeparator />}
            {actions.leave && (
              <DropdownMenuItem onSelect={() => onAction({ kind: 'leave', space })}>
                <LogOut aria-hidden="true" />
                Sair do espaço
              </DropdownMenuItem>
            )}
            {actions.delete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onAction({ kind: 'delete', space })}
              >
                <Trash2 aria-hidden="true" />
                Excluir espaço
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

function CreateSpaceForm() {
  const create = useCreateSpace()
  const { switchSpace } = useCurrentSpace()
  const [name, setName] = useState('')
  const [type, setType] = useState<'couple' | 'family'>('couple')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    create.mutate(
      { name, type },
      {
        onSuccess: (id) => {
          setName('')
          toast.success('Espaço criado. Você já está usando o novo espaço.')
          if (id) switchSpace(id)
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível criar o espaço.')),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-lg gap-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="grid gap-2">
          <Label htmlFor="space-name">Nome</Label>
          <Input
            id="space-name"
            placeholder="Ex.: Casa, Família Silva"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="space-type">Tipo</Label>
          <NativeSelect id="space-type" value={type} onChange={(e) => setType(e.target.value as 'couple' | 'family')}>
            <option value="couple">Casal</option>
            <option value="family">Família</option>
          </NativeSelect>
        </div>
      </div>
      <div>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          Criar espaço
        </Button>
      </div>
    </form>
  )
}

export function SpacesSection() {
  const user = useUser()
  const { spaces, current, isLoading, error } = useCurrentSpace()
  const deleteSpace = useDeleteSpace()
  const [pending, setPending] = useState<Pending>(null)
  const leaveSpaceId = pending?.kind === 'leave' ? pending.space.id : ''
  const removeMember = useRemoveMember(leaveSpaceId)

  return (
    <>
      <SettingsBlock
        title="Seus espaços"
        description="Cada espaço tem suas próprias categorias e, nas próximas etapas, suas próprias contas e movimentações."
      >
        {isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <ul className="divide-y rounded-lg border bg-surface px-4">
            {spaces.map((space) => (
              <SpaceRow key={space.id} space={space} isCurrent={space.id === current?.id} onAction={setPending} />
            ))}
          </ul>
        )}
      </SettingsBlock>

      <SettingsBlock
        title="Criar espaço compartilhado"
        description="Para organizar as finanças do casal ou da família. Depois de criar, adicione as pessoas pelo e-mail da conta delas no CashBot."
      >
        <CreateSpaceForm />
      </SettingsBlock>

      {pending?.kind === 'rename' && <RenameDialog space={pending.space} onClose={() => setPending(null)} />}
      {pending?.kind === 'members' && <MembersDialog space={pending.space} onClose={() => setPending(null)} />}

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        onOpenChange={(open) => !open && setPending(null)}
        title="Excluir espaço?"
        description={
          <>
            O espaço <strong className="font-medium text-foreground">{pending?.space.name}</strong>, suas categorias e
            a participação de todos os membros serão excluídos definitivamente. Essa ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir espaço"
        onConfirm={async () => {
          if (pending?.kind !== 'delete') return
          try {
            await deleteSpace.mutateAsync(pending.space.id)
            toast.success('Espaço excluído.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível excluir o espaço.'))
            throw err
          }
        }}
      />

      <ConfirmDialog
        open={pending?.kind === 'leave'}
        onOpenChange={(open) => !open && setPending(null)}
        title="Sair do espaço?"
        description={
          <>
            Você deixará de ver os dados de <strong className="font-medium text-foreground">{pending?.space.name}</strong>.
            Para voltar, alguém do espaço precisará adicionar você de novo.
          </>
        }
        confirmLabel="Sair do espaço"
        onConfirm={async () => {
          if (pending?.kind !== 'leave') return
          try {
            await removeMember.mutateAsync(user.id)
            toast.success('Você saiu do espaço.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível sair do espaço.'))
            throw err
          }
        }}
      />
    </>
  )
}
