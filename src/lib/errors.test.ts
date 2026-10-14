import { describe, expect, it } from 'vitest'
import { toUserMessage } from './errors'

describe('toUserMessage', () => {
  it('traduz erros comuns de autenticação', () => {
    expect(toUserMessage({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
    expect(toUserMessage({ message: 'User already registered' })).toMatch(/Já existe uma conta/)
    expect(toUserMessage({ message: 'Password should be at least 8 characters.' })).toBe(
      'A senha precisa ter pelo menos 8 caracteres.',
    )
    expect(toUserMessage(new TypeError('Failed to fetch'))).toMatch(/Não foi possível conectar/)
  })

  it('traduz bloqueios de RLS e duplicidade', () => {
    expect(
      toUserMessage({ code: '42501', message: 'new row violates row-level security policy for table "categories"' }),
    ).toBe('Você não tem permissão para fazer isso neste espaço.')
    expect(toUserMessage({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(
      'Já existe um item com esse nome.',
    )
  })

  it('mantém mensagens em português vindas das funções do banco', () => {
    expect(toUserMessage({ code: '42501', message: 'Somente o proprietário pode alterar papéis.' })).toBe(
      'Somente o proprietário pode alterar papéis.',
    )
  })

  it('usa a mensagem padrão para erros desconhecidos', () => {
    expect(toUserMessage({ message: 'something odd' }, 'Padrão')).toBe('Padrão')
    expect(toUserMessage(null, 'Padrão')).toBe('Padrão')
  })
})
