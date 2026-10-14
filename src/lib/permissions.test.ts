import { describe, expect, it } from 'vitest'
import {
  assignableRoles,
  canChangeRoles,
  canDeleteCategories,
  canDeleteSpace,
  canEditCategories,
  canInviteMembers,
  canLeaveSpace,
  canRemoveMember,
  canRenameSpace,
} from './permissions'

// Estas regras espelham as políticas do banco (supabase/tests/rls_spaces.sql).
describe('regras de permissão dos espaços', () => {
  it('só proprietário e administrador renomeiam', () => {
    expect(canRenameSpace('owner')).toBe(true)
    expect(canRenameSpace('admin')).toBe(true)
    expect(canRenameSpace('member')).toBe(false)
    expect(canRenameSpace(null)).toBe(false)
  })

  it('só o proprietário exclui, e nunca o espaço pessoal', () => {
    expect(canDeleteSpace('owner', 'couple')).toBe(true)
    expect(canDeleteSpace('owner', 'family')).toBe(true)
    expect(canDeleteSpace('owner', 'personal')).toBe(false)
    expect(canDeleteSpace('admin', 'family')).toBe(false)
    expect(canDeleteSpace('member', 'family')).toBe(false)
  })

  it('espaço pessoal não recebe membros', () => {
    expect(canInviteMembers('owner', 'personal')).toBe(false)
    expect(canInviteMembers('owner', 'couple')).toBe(true)
    expect(canInviteMembers('admin', 'family')).toBe(true)
    expect(canInviteMembers('member', 'family')).toBe(false)
  })

  it('administrador só adiciona membros comuns; proprietário adiciona administradores', () => {
    expect(assignableRoles('owner')).toEqual(['member', 'admin'])
    expect(assignableRoles('admin')).toEqual(['member'])
    expect(assignableRoles('member')).toEqual([])
    expect(assignableRoles(undefined)).toEqual([])
  })

  it('só o proprietário troca papéis', () => {
    expect(canChangeRoles('owner')).toBe(true)
    expect(canChangeRoles('admin')).toBe(false)
    expect(canChangeRoles('member')).toBe(false)
  })

  it('ninguém remove o proprietário; administrador remove apenas membros', () => {
    expect(canRemoveMember('owner', 'owner')).toBe(false)
    expect(canRemoveMember('admin', 'owner')).toBe(false)
    expect(canRemoveMember('owner', 'admin')).toBe(true)
    expect(canRemoveMember('owner', 'member')).toBe(true)
    expect(canRemoveMember('admin', 'member')).toBe(true)
    expect(canRemoveMember('admin', 'admin')).toBe(false)
    expect(canRemoveMember('member', 'member')).toBe(false)
  })

  it('o proprietário não pode sair do próprio espaço', () => {
    expect(canLeaveSpace('owner')).toBe(false)
    expect(canLeaveSpace('admin')).toBe(true)
    expect(canLeaveSpace('member')).toBe(true)
  })

  it('membros editam categorias; só proprietário e administrador excluem', () => {
    expect(canEditCategories('member')).toBe(true)
    expect(canEditCategories(null)).toBe(false)
    expect(canDeleteCategories('owner')).toBe(true)
    expect(canDeleteCategories('admin')).toBe(true)
    expect(canDeleteCategories('member')).toBe(false)
  })
})
