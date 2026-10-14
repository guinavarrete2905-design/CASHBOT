import { ArrowLeftRight, ChartPie, CreditCard, House, PiggyBank, Settings, Target, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  /** Rótulo curto para a barra inferior do celular. */
  short: string
  icon: LucideIcon
  /** Aparece direto na barra inferior do celular (os demais ficam em "Mais"). */
  primaryOnMobile: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', short: 'Início', icon: House, primaryOnMobile: true },
  { to: '/movimentacoes', label: 'Movimentações', short: 'Movimentos', icon: ArrowLeftRight, primaryOnMobile: true },
  { to: '/contas', label: 'Contas e cartões', short: 'Contas', icon: CreditCard, primaryOnMobile: true },
  { to: '/planejamento', label: 'Planejamento', short: 'Planejar', icon: Target, primaryOnMobile: true },
  { to: '/patrimonio', label: 'Patrimônio', short: 'Patrimônio', icon: PiggyBank, primaryOnMobile: false },
  { to: '/relatorios', label: 'Relatórios', short: 'Relatórios', icon: ChartPie, primaryOnMobile: false },
  { to: '/configuracoes', label: 'Configurações', short: 'Ajustes', icon: Settings, primaryOnMobile: false },
]
