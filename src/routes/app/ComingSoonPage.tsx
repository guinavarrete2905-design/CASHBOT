import { ChartPie, PiggyBank, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/feedback'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCurrentSpace } from '@/providers/SpaceProvider'

type Area = 'wealth' | 'reports'

const CONTENT: Record<Area, { title: string; description: string; icon: LucideIcon; upcoming: string[] }> = {
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
