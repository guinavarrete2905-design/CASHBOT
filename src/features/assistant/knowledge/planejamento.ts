import type { ArticleContent } from './index'
import { REF } from './refs'

const content: Record<string, ArticleContent> = {
  'metas-financeiras': {
    summary: 'Uma meta financeira é um objetivo com valor e prazo definidos. Com os dois, dá para saber quanto guardar por mês.',
    details: [
      'Metas claras funcionam melhor: em vez de "juntar dinheiro", algo como "juntar o valor da viagem até dezembro". Valor dividido pelos meses restantes dá a parcela mensal.',
      'Priorize: reserva de emergência costuma vir antes de metas de consumo. Acompanhe o progresso e ajuste a parcela se a renda mudar.',
    ],
    examples: ['Exemplo ilustrativo: para juntar R$ 6.000 em 12 meses, a parcela é de R$ 500 por mês, sem contar rendimentos.'],
    relatedQuestions: ['Como estão minhas metas?', 'Quanto preciso guardar por mês para minha meta?', 'Em quanto tempo junto 10 mil guardando 500 por mês?'],
    references: [REF.bcb],
  },
  'reserva-emergencia': {
    summary: 'Reserva de emergência é um valor guardado para imprevistos — perda de renda, problemas de saúde, consertos — sem precisar recorrer a dívidas.',
    details: [
      'Uma referência comum é ter o equivalente a alguns meses de despesas essenciais: menos para quem tem renda estável, mais para autônomos ou quem tem renda variável. O tamanho certo depende da sua situação.',
      'A reserva deve ficar em aplicações de baixo risco e liquidez imediata, para poder ser usada a qualquer momento sem perda. Rentabilidade é secundária aqui.',
      'Depois de usar, a prioridade é recompor.',
    ],
    examples: ['Exemplo ilustrativo: quem tem despesas essenciais de R$ 3.000 por mês e busca de 6 meses de reserva tem como alvo R$ 18.000.'],
    relatedQuestions: ['Quanto deveria ter de reserva de emergência?', 'O que é liquidez?', 'O que é renda fixa?'],
    references: [REF.bcb, REF.cvm],
  },
  'planejamento-compras': {
    summary: 'Planejar uma compra é decidir quando e como pagar: juntar antes, pagar à vista com desconto ou parcelar.',
    details: [
      'Antes de parcelar, compare: se há desconto à vista, o "sem juros" pode embutir custo. Se o dinheiro já está guardado, pagar à vista com desconto costuma ser melhor; se não está, parcelar sem juros pode fazer sentido desde que a parcela caiba no orçamento.',
      'Somar todas as parcelas em andamento evita comprometer meses futuros.',
    ],
    examples: ['Exemplo ilustrativo: um produto de R$ 1.000 em 10x sem juros ou R$ 900 à vista — o desconto de 10% à vista significa que o parcelado custa mais.'],
    relatedQuestions: ['O que são parcelamentos?', 'Comprei um celular de 2.400 em 10x', 'Como criar metas?'],
    references: [REF.bcb, REF.consumidor],
  },
  'planejamento-familiar': {
    summary: 'O planejamento familiar organiza o dinheiro da casa considerando todos os membros: despesas compartilhadas, filhos, metas comuns.',
    details: [
      'Conversas regulares sobre dinheiro ajudam a alinhar prioridades. Envolver os filhos, de acordo com a idade, ensina o valor do dinheiro (mesada com regras simples, metas pequenas).',
      'Despesas com filhos mudam com o tempo — escola, saúde, atividades —, por isso vale revisar o orçamento a cada fase.',
    ],
    examples: ['Exemplo ilustrativo: um espaço "Família" no CashBot reúne as despesas da casa e permite que cada membro lance o que gastou.'],
    relatedQuestions: ['Como organizar as finanças do casal?', 'O que é orçamento doméstico?', 'Como estão minhas metas?'],
    references: [REF.bcb],
  },
  'financas-casal': {
    summary: 'Organizar as finanças do casal é combinar como dividir as despesas comuns, como tratar o dinheiro individual e quais metas são compartilhadas.',
    details: [
      'Modelos comuns: tudo junto; divisão proporcional à renda; ou uma parte comum para as contas da casa e o restante individual. Não há modelo certo — o importante é ser combinado e revisto.',
      'Transparência sobre dívidas e compromissos evita surpresas. Metas comuns, como viagem ou casa, motivam os dois.',
    ],
    examples: ['Exemplo ilustrativo: na divisão proporcional, quem ganha 60% da renda total do casal paga 60% das contas comuns.'],
    relatedQuestions: ['Quanto gastamos neste mês?', 'Planejamento familiar', 'Como definir metas?'],
    references: [REF.bcb],
  },
  'planejamento-viagens': {
    summary: 'Planejar uma viagem é estimar o custo total (transporte, hospedagem, alimentação, passeios, imprevistos) e juntar antes de ir.',
    details: [
      'Pesquise com antecedência e defina um orçamento por item. Uma margem para imprevistos evita estourar o cartão durante a viagem.',
      'Criar uma meta com prazo na data da viagem mostra quanto guardar por mês.',
    ],
    examples: ['Exemplo ilustrativo: uma viagem estimada em R$ 4.800, daqui a 8 meses, pede R$ 600 por mês.'],
    relatedQuestions: ['Quanto preciso guardar por mês para juntar 5 mil em 10 meses?', 'Como estão minhas metas?', 'O que são grandes despesas?'],
    references: [REF.bcb],
  },
  'grandes-despesas': {
    summary: 'Grandes despesas — carro, imóvel, casamento, reforma — exigem planejamento de meses ou anos e comparação entre juntar e financiar.',
    details: [
      'Juntar antes costuma sair mais barato, porque o dinheiro rende em vez de pagar juros. Quando o financiamento é inevitável, uma entrada maior reduz juros e parcelas.',
      'Inclua custos indiretos: documentação, seguro, manutenção, mudança.',
    ],
    examples: ['Exemplo ilustrativo: além do preço de um carro, considere seguro, impostos anuais e manutenção no orçamento mensal.'],
    relatedQuestions: ['O que é financiamento?', 'O que é amortização?', 'Quanto preciso guardar por mês para juntar 30 mil em 24 meses?'],
    references: [REF.bcb],
  },
  'estrategias-economia': {
    summary: 'Economizar é gastar menos do que se ganha de forma sustentável — cortando desperdícios, não qualidade de vida.',
    details: [
      'Comece pelos maiores gastos e pelos recorrentes: uma economia mensal num gasto fixo vale para todos os meses seguintes. Compare preços, renegocie contratos, cancele o que não usa.',
      'Automatize: separar o valor da meta logo que a renda entra ("pague-se primeiro") funciona melhor do que esperar sobrar.',
      'Regra das 24 horas para compras não planejadas ajuda a evitar impulso.',
    ],
    examples: ['Exemplo ilustrativo: cozinhar mais em casa e levar marmita alguns dias por semana costuma reduzir a categoria de alimentação.'],
    relatedQuestions: ['Qual categoria teve mais despesas?', 'Compare meus gastos com o mês passado', 'O que é consumo consciente?'],
    references: [REF.bcb],
  },
}

export default content
