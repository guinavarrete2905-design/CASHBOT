export type SpaceType = 'personal' | 'couple' | 'family'
export type SpaceRole = 'owner' | 'admin' | 'member'

export const SPACE_TYPE_LABEL: Record<SpaceType, string> = {
  personal: 'Pessoal',
  couple: 'Casal',
  family: 'Família',
}

export const ROLE_LABEL: Record<SpaceRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
}

export function isSpaceType(value: string): value is SpaceType {
  return value === 'personal' || value === 'couple' || value === 'family'
}

export function isSpaceRole(value: string | null | undefined): value is SpaceRole {
  return value === 'owner' || value === 'admin' || value === 'member'
}

/*
  Espelho, na interface, das regras aplicadas no banco (RLS e funções).
  Servem só para mostrar ou esconder ações — o banco é quem de fato autoriza.
*/

export function canRenameSpace(role: SpaceRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function canDeleteSpace(role: SpaceRole | null | undefined, type: SpaceType): boolean {
  return role === 'owner' && type !== 'personal'
}

export function canInviteMembers(role: SpaceRole | null | undefined, type: SpaceType): boolean {
  return type !== 'personal' && (role === 'owner' || role === 'admin')
}

/** Papéis que quem convida pode atribuir. */
export function assignableRoles(role: SpaceRole | null | undefined): SpaceRole[] {
  if (role === 'owner') return ['member', 'admin']
  if (role === 'admin') return ['member']
  return []
}

export function canChangeRoles(role: SpaceRole | null | undefined): boolean {
  return role === 'owner'
}

/** Pode remover o membro `target` do espaço? (sair do espaço é tratado à parte) */
export function canRemoveMember(actor: SpaceRole | null | undefined, target: SpaceRole): boolean {
  if (target === 'owner') return false
  if (actor === 'owner') return true
  return actor === 'admin' && target === 'member'
}

export function canLeaveSpace(role: SpaceRole | null | undefined): boolean {
  return role === 'admin' || role === 'member'
}

export function canEditCategories(role: SpaceRole | null | undefined): boolean {
  return isSpaceRole(role)
}

export function canDeleteCategories(role: SpaceRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}
