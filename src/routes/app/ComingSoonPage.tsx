import { ArrowLeftRight, ChartPie, CreditCard, PiggyBank, Target, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCurrentSpace } from '@/providers/SpaceProvider'

type Area = 'transactions' | 'accounts' | 'planning' | 'wealth' | 'reports'

const CONTENT: Record<Area, { title: string; description: string; icon: LucideIcon; upcoming: string[] }> = {
  transactions: {
    title: 'Movimentações',
    description: 'Receitas, despesas e transferências do espaço.',
    icon: ArrowLeftRight,
    upcoming: ['Lançar receitas e despesas', 'Compras parceladas', 'Pagamentos recorrentes', 'Busca e filtros por período'],
  },
  accounts: {
    title: 'Contas e cartões',
    description: 'Contas bancárias, carteiras e cartões de crédito.',
    icon: CreditCard,
    upcoming: ['Cadastro de contas e saldos iniciais', 'Cartões com fechamento e vencimento', 'Faturas por mês'],
  },
  planning: {
    title: 'Planejamento',
    description: 'Orçamentos, metas e calendário de vencimentos.',
    icon: Target,
    upcoming: ['Orçamento mensal por categoria', 'Metas financeiras', 'Calendário de vencimentos', 'Projeção de saldo'],
  },
  wealth: {
    title: 'Patrimônio',
    description: 'Investimentos, bens, dívidas e financiamentos.',
    icon: PiggyBank,
    upcoming: ['Investimentos', 'Bens', 'Dívidas e financiamentos', 'Evolução do patrimônio líquido'],
  },
  reports: {
    title: 'Relatórios',
    description: 'Análises do seu dinheiro ao longo do tempo.',
    icon: ChartPie,
    upcoming: ['Gastos por categoria', 'Receitas x despesas por mês', 'Comparativo entre períodos'],
  },
}

export function ComingSoonPage({ area }: { area: Area }) {
  const content = CONTENT[area]
  const { current } = useCurrentSpace()

  return (
    <>
      <PageHeader title={content.title} description={content.description} />
      <EmptyState icon={content.icon} title="Esta área ainda está sendo construída">
        <p>
          Quando estiver pronta, os dados aparecerão aqui
          {current ? (
            <>
              {' '}
              para o espaço <strong className="font-medium text-foreground">{current.name}</strong>
            </>
          ) : null}
          . O que vem por aí:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {content.upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </EmptyState>
    </>
  )
}
