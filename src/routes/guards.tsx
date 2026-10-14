import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullScreenLoader } from '@/components/feedback'
import { useAuth } from '@/providers/AuthProvider'

/** Só deixa passar quem está logado; os demais vão para a tela de entrada. */
export function ProtectedRoute() {
  const { session, loading, recovering } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!session) {
    return <Navigate to="/entrar" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  if (recovering) return <Navigate to="/redefinir-senha" replace />
  return <Outlet />
}

/** Telas de entrada/cadastro: quem já está logado vai direto para o início. */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
