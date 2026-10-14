import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ForgotPasswordPage } from './auth/ForgotPasswordPage'
import { LoginPage } from './auth/LoginPage'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { SignupPage } from './auth/SignupPage'
import { AccountsPage } from './app/AccountsPage'
import { DashboardPage } from './app/DashboardPage'
import { NotFoundPage } from './app/NotFoundPage'
import { PlanningPage } from './app/PlanningPage'
import { ReportsPage } from './app/ReportsPage'
import { SettingsPage } from './app/settings/SettingsPage'
import { TransactionsPage } from './app/TransactionsPage'
import { WealthPage } from './app/WealthPage'
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
          <Route path="movimentacoes" element={<TransactionsPage />} />
          <Route path="contas" element={<AccountsPage />} />
          <Route path="planejamento" element={<PlanningPage />} />
          <Route path="patrimonio" element={<WealthPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="configuracoes" element={<Navigate to="/configuracoes/perfil" replace />} />
          <Route path="configuracoes/:section" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
