import { formatMoney } from '@/lib/money'
import type { Period } from './parse'
import type { Block, Link } from './types'

export const money = (v: number) => formatMoney(v)

/** "2026-10-14" → "14/10" (ou "14/10/2025" quando é de outro ano). */
export function shortDate(iso: string, today: string): string {
  const [y, m, d] = iso.split('-')
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`
}

export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export const text = (t: string): Block => ({ type: 'text', text: t })
export const note = (t: string): Block => ({ type: 'note', text: t })
export const list = (items: string[]): Block => ({ type: 'list', items })

/** Link para Movimentações já no mês do período, quando for um mês. */
export function transactionsLink(period: Period | null): Link {
  return { label: 'Ver movimentações', to: period?.kind === 'month' && period.month ? `/movimentacoes?mes=${period.month}` : '/movimentacoes' }
}

export const LINKS = {
  transactions: { label: 'Movimentações', to: '/movimentacoes' },
  accounts: { label: 'Contas e cartões', to: '/contas' },
  planning: { label: 'Planejamento', to: '/planejamento' },
  reports: { label: 'Relatórios', to: '/relatorios' },
  wealth: { label: 'Patrimônio', to: '/patrimonio' },
  spaces: { label: 'Configurações › Espaços', to: '/configuracoes/espacos' },
  categories: { label: 'Configurações › Categorias', to: '/configuracoes/categorias' },
} satisfies Record<string, Link>

/** Texto simples de uma resposta (para o histórico salvo no banco). */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'text' || b.type === 'note') return b.text.replace(/\*\*/g, '')
      if (b.type === 'list') return b.items.map((i) => `• ${i.replace(/\*\*/g, '')}`).join('\n')
      return b.items.map((i) => `${i.label}: ${i.value}`).join('\n')
    })
    .join('\n\n')
    .slice(0, 4000)
}
