import { useState, type FormEvent } from 'react'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState, FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAddMember,
  useRemoveMember,
  useSpaceMembers,
  useUpdateMemberRole,
  type Space,
  type SpaceMember,
} from '@/features/spaces/api'
import { toUserMessage } from '@/lib/errors'
import {
  ROLE_LABEL,
  assignableRoles,
  canChangeRoles,
  canInviteMembers,
  canRemoveMember,
  type SpaceRole,
} from '@/lib/permissions'
import { useUser } from '@/providers/AuthProvider'

type AssignableRole = Exclude<SpaceRole, 'owner'>

function AddMemberForm({ space }: { space: Space }) {
  const add = useAddMember(space.id)
  const roles = assignableRoles(space.role)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AssignableRole>('member')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    add.mutate(
      { email, role },
      {
        onSuccess: () => {
          setEmail('')
          setRole('member')
          toast.success('Pessoa adicionada ao espaço.')
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível adicionar essa pessoa.')),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 border-t pt-4">
      <p className="text-sm font-medium">Adicionar pessoa</p>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <div className="grid gap-2">
          <Label htmlFor="member-email">E-mail da conta no CashBot</Label>
          <Input
            id="member-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="member-role">Papel</Label>
          <NativeSelect
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AssignableRole)}
            disabled={roles.length < 2}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A pessoa precisa ter uma conta. Administradores podem renomear o espaço e adicionar membros; membros podem
        consultar e editar categorias.
      </p>
      <div>
        <Button type="submit" loading={add.isPending} disabled={!email.trim()}>
          Adicionar
        </Button>
      </div>
    </form>
  )
}

function MemberRow({ space, member, onRemove }: {
  space: Space
  member: SpaceMember
  onRemove: (m: SpaceMember) => void
}) {
  const user = useUser()
  const updateRole = useUpdateMemberRole(space.id)
  const isSelf = member.userId === user.id
  const name = member.fullName.trim() || 'Sem nome'
  const editableRole = canChangeRoles(space.role) && member.role !== 'owner'
  const removable = !isSelf && canRemoveMember(space.role, member.role)

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {name}
          {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
        </p>
        {!editableRole && <p className="text-xs text-muted-foreground">{ROLE_LABEL[member.role]}</p>}
      </div>
      {editableRole && (
        <div className="w-36">
          <label htmlFor={`role-${member.userId}`} className="sr-only">
            Papel de {name}
          </label>
          <NativeSelect
            id={`role-${member.userId}`}
            value={member.role}
            disabled={updateRole.isPending}
            className="h-9"
            onChange={(e) =>
              updateRole.mutate(
                { userId: member.userId, role: e.target.value as AssignableRole },
                {
                  onSuccess: () => toast.success('Papel atualizado.'),
                  onError: (err) => toast.error(toUserMessage(err, 'Não foi possível alterar o papel.')),
                },
              )
            }
          >
            <option value="admin">{ROLE_LABEL.admin}</option>
            <option value="member">{ROLE_LABEL.member}</option>
          </NativeSelect>
        </div>
      )}
      {removable && (
        <Button variant="ghost" size="icon" onClick={() => onRemove(member)} aria-label={`Remover ${name} do espaço`}>
          <UserMinus aria-hidden="true" />
        </Button>
      )}
    </li>
  )
}

export function MembersDialog({ space, onClose }: { space: Space; onClose: () => void }) {
  const members = useSpaceMembers(space.id)
  const remove = useRemoveMember(space.id)
  const [removing, setRemoving] = useState<SpaceMember | null>(null)

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Membros de {space.name}</DialogTitle>
            <DialogDescription>Somente as pessoas listadas aqui veem os dados deste espaço.</DialogDescription>
          </DialogHeader>

          {members.isPending ? (
            <div className="grid gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : members.error ? (
            <ErrorState error={members.error} onRetry={() => members.refetch()} />
          ) : (
            <ul className="divide-y">
              {(members.data ?? []).map((m) => (
                <MemberRow key={m.userId} space={space} member={m} onRemove={setRemoving} />
              ))}
            </ul>
          )}

          {canInviteMembers(space.role, space.type) && <AddMemberForm space={space} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover pessoa do espaço?"
        description={
          <>
            <strong className="font-medium text-foreground">{removing?.fullName.trim() || 'Essa pessoa'}</strong>{' '}
            deixará de ver os dados de {space.name}.
          </>
        }
        confirmLabel="Remover"
        onConfirm={async () => {
          if (!removing) return
          try {
            await remove.mutateAsync(removing.userId)
            toast.success('Pessoa removida do espaço.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível remover essa pessoa.'))
            throw err
          }
        }}
      />
    </>
  )
}
