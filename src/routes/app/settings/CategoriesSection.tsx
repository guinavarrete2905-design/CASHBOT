import { useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Ellipsis, Pencil, Tags, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, ErrorState, FormError } from '@/components/feedback'
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
import {
  KIND_LABEL,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type Category,
  type CategoryKind,
} from '@/features/categories/api'
import { toUserMessage } from '@/lib/errors'
import { canDeleteCategories, canEditCategories } from '@/lib/permissions'
import { useCurrentSpace } from '@/providers/SpaceProvider'
import { SettingsBlock } from './SettingsBlock'

function RenameCategoryDialog({ category, spaceId, onClose }: { category: Category; spaceId: string; onClose: () => void }) {
  const update = useUpdateCategory(spaceId)
  const [name, setName] = useState(category.name)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    update.mutate(
      { id: category.id, name },
      {
        onSuccess: () => {
          toast.success('Categoria renomeada.')
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível renomear a categoria.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear categoria</DialogTitle>
          <DialogDescription className="sr-only">Escolha um novo nome para a categoria.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <FormError message={error} />
          <div className="grid gap-2">
            <Label htmlFor="rename-category">Nome</Label>
            <Input
              id="rename-category"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!name.trim() || name.trim() === category.name}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CategoryList({ kind, categories, canEdit, canDelete, onRename, onToggleArchive, onDelete }: {
  kind: CategoryKind
  categories: Category[]
  canEdit: boolean
  canDelete: boolean
  onRename: (c: Category) => void
  onToggleArchive: (c: Category) => void
  onDelete: (c: Category) => void
}) {
  const items = categories.filter((c) => c.kind === kind)

  return (
    <div className="min-w-0">
      <h3 className="mb-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {KIND_LABEL[kind]} <span className="tabular">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Nenhuma categoria.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-surface">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1 pl-4 pr-1">
              <span className={c.archived ? 'min-w-0 flex-1 truncate text-sm text-muted-foreground line-through' : 'min-w-0 flex-1 truncate text-sm'}>
                {c.name}
              </span>
              {c.archived && <span className="text-xs text-muted-foreground">Arquivada</span>}
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Ações da categoria ${c.name}`}>
                      <Ellipsis aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onRename(c)}>
                      <Pencil aria-hidden="true" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onToggleArchive(c)}>
                      {c.archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                      {c.archived ? 'Reativar' : 'Arquivar'}
                    </DropdownMenuItem>
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => onDelete(c)}
                        >
                          <Trash2 aria-hidden="true" />
                          Excluir
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddCategoryForm({ spaceId }: { spaceId: string }) {
  const create = useCreateCategory(spaceId)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    create.mutate(
      { name, kind },
      {
        onSuccess: () => {
          setName('')
          toast.success('Categoria criada.')
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível criar a categoria.')),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-lg gap-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="grid gap-2">
          <Label htmlFor="category-name">Nome</Label>
          <Input
            id="category-name"
            placeholder="Ex.: Pets, Assinaturas"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category-kind">Tipo</Label>
          <NativeSelect id="category-kind" value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </NativeSelect>
        </div>
      </div>
      <div>
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          Adicionar categoria
        </Button>
      </div>
    </form>
  )
}

export function CategoriesSection() {
  const { current, isLoading: spaceLoading } = useCurrentSpace()
  const spaceId = current?.id
  const categories = useCategories(spaceId)
  const update = useUpdateCategory(spaceId ?? '')
  const remove = useDeleteCategory(spaceId ?? '')
  const [renaming, setRenaming] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  if (spaceLoading || (spaceId && categories.isPending)) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (!current || !spaceId) {
    return (
      <EmptyState icon={Tags} title="Nenhum espaço selecionado">
        Escolha um espaço no seletor para ver as categorias.
      </EmptyState>
    )
  }
  if (categories.error) return <ErrorState error={categories.error} onRetry={() => categories.refetch()} />

  const canEdit = canEditCategories(current.role)
  const canDelete = canDeleteCategories(current.role)
  const list = categories.data ?? []

  function toggleArchive(c: Category) {
    update.mutate(
      { id: c.id, archived: !c.archived },
      {
        onSuccess: () => toast.success(c.archived ? 'Categoria reativada.' : 'Categoria arquivada.'),
        onError: (err) => toast.error(toUserMessage(err, 'Não foi possível atualizar a categoria.')),
      },
    )
  }

  return (
    <>
      <SettingsBlock
        title={`Categorias de ${current.name}`}
        description="Arquive as que não usa: elas somem das listas de escolha, mas continuam no histórico."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {(['expense', 'income'] as const).map((kind) => (
            <CategoryList
              key={kind}
              kind={kind}
              categories={list}
              canEdit={canEdit}
              canDelete={canDelete}
              onRename={setRenaming}
              onToggleArchive={toggleArchive}
              onDelete={setDeleting}
            />
          ))}
        </div>
      </SettingsBlock>

      {canEdit && (
        <SettingsBlock title="Nova categoria">
          <AddCategoryForm spaceId={spaceId} />
        </SettingsBlock>
      )}

      {renaming && <RenameCategoryDialog category={renaming} spaceId={spaceId} onClose={() => setRenaming(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir categoria?"
        description={
          <>
            A categoria <strong className="font-medium text-foreground">{deleting?.name}</strong> será excluída
            definitivamente. Se quiser apenas escondê-la, use Arquivar.
          </>
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success('Categoria excluída.')
          } catch (err) {
            toast.error(toUserMessage(err, 'Não foi possível excluir a categoria.'))
            throw err
          }
        }}
      />
    </>
  )
}
