import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ForgotPasswordPage } from './auth/ForgotPasswordPage'
import { LoginPage } from './auth/LoginPage'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { SignupPage } from './auth/SignupPage'
import { ComingSoonPage } from './app/ComingSoonPage'
import { DashboardPage } from './app/DashboardPage'
import { NotFoundPage } from './app/NotFoundPage'
import { SettingsPage } from './app/settings/SettingsPage'
import { ProtectedRoute, PublicOnlyRoute } from './guards'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/cadastro" element={<SignupPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      </Route>
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="movimentacoes" element={<ComingSoonPage area="transactions" />} />
          <Route path="contas" element={<ComingSoonPage area="accounts" />} />
          <Route path="planejamento" element={<ComingSoonPage area="planning" />} />
          <Route path="patrimonio" element={<ComingSoonPage area="wealth" />} />
          <Route path="relatorios" element={<ComingSoonPage area="reports" />} />
          <Route path="configuracoes" element={<Navigate to="/configuracoes/perfil" replace />} />
          <Route path="configuracoes/:section" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
