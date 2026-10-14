import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute, PublicOnlyRoute } from './guards'

type MockAuth = { session: object | null; loading: boolean; recovering: boolean }
let auth: MockAuth

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => auth,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/entrar" element={<p>tela de entrada</p>} />
        </Route>
        <Route path="/redefinir-senha" element={<p>redefinir senha</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>área logada</p>} />
          <Route path="/configuracoes/perfil" element={<p>perfil</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('proteção de rotas', () => {
  beforeEach(() => {
    auth = { session: null, loading: false, recovering: false }
  })

  it('mostra carregamento enquanto a sessão é lida', () => {
    auth.loading = true
    renderAt('/')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('área logada')).not.toBeInTheDocument()
  })

  it('manda visitantes para a tela de entrada', () => {
    renderAt('/configuracoes/perfil')
    expect(screen.getByText('tela de entrada')).toBeInTheDocument()
    expect(screen.queryByText('perfil')).not.toBeInTheDocument()
  })

  it('libera a área logada para quem tem sessão', () => {
    auth.session = { user: { id: 'u1' } }
    renderAt('/')
    expect(screen.getByText('área logada')).toBeInTheDocument()
  })

  it('leva quem já está logado da entrada para o início', () => {
    auth.session = { user: { id: 'u1' } }
    renderAt('/entrar')
    expect(screen.getByText('área logada')).toBeInTheDocument()
  })

  it('durante a recuperação de senha, obriga a definir a nova senha', () => {
    auth.session = { user: { id: 'u1' } }
    auth.recovering = true
    renderAt('/')
    expect(screen.getByText('redefinir senha')).toBeInTheDocument()
  })
})
