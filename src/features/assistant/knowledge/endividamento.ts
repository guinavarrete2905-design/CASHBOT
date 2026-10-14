import type { ArticleContent } from './index'
import { REF } from './refs'

const content: Record<string, ArticleContent> = {
  'juros-simples': {
    summary: 'Nos juros simples, a taxa incide sempre sobre o valor inicial. O total cresce em linha reta: juros = valor × taxa × tempo.',
    details: [
      'São pouco usados em investimentos e empréstimos do dia a dia, que normalmente usam juros compostos, mas aparecem em alguns cálculos de multa e atraso.',
      'A taxa e o tempo precisam estar na mesma unidade (ao mês com meses, ao ano com anos).',
    ],
    examples: ['Exemplo ilustrativo: R$ 1.000 a 2% ao mês por 6 meses rendem R$ 120 de juros simples (1.000 × 0,02 × 6).'],
    relatedQuestions: ['Calcule juros simples de 1000 a 2% ao mês por 6 meses', 'O que são juros compostos?'],
    references: [REF.bcb],
  },
  'juros-compostos': {
    summary: 'Nos juros compostos, os juros de cada período entram na base do período seguinte — são os "juros sobre juros". Montante = valor × (1 + taxa)^tempo.',
    details: [
      'A favor (investimentos), o efeito cresce com o tempo: começar cedo pesa mais do que aportar muito tarde. Contra (dívidas), o mesmo efeito faz uma dívida pequena crescer rápido.',
      'Pequenas diferenças de taxa fazem grande diferença em prazos longos.',
    ],
    examples: ['Exemplo ilustrativo: R$ 1.000 a 1% ao mês por 12 meses viram cerca de R$ 1.126,83 com juros compostos, contra R$ 1.120 com juros simples.'],
    relatedQuestions: ['Quanto rende 1000 a 1% ao mês por 12 meses?', 'O que é crédito rotativo?', 'O que é rentabilidade?'],
    references: [REF.bcb],
  },
  dividas: {
    summary: 'Dívida em si não é problema; o problema é quando as parcelas não cabem no orçamento ou os juros são altos.',
    details: [
      'Para sair das dívidas: liste todas (credor, saldo, taxa, parcela), pare de criar novas e priorize as de juros mais altos — em geral cartão rotativo e cheque especial. Trocar uma dívida cara por outra mais barata pode ajudar.',
      'Use o Registrato, serviço gratuito do Banco Central, para consultar as dívidas em seu nome em instituições financeiras.',
    ],
    examples: ['Exemplo ilustrativo: com duas dívidas, uma no rotativo e outra num empréstimo mais barato, quitar primeiro o rotativo reduz o custo total.'],
    relatedQuestions: ['Quanto estou devendo?', 'Como renegociar dívidas?', 'O que é crédito rotativo?'],
    references: [REF.bcb, REF.consumidor],
  },
  financiamentos: {
    summary: 'Financiamento é um crédito para comprar um bem específico (imóvel, veículo), em geral com o próprio bem como garantia.',
    details: [
      'Dois sistemas comuns: Price (parcelas iguais, amortização menor no início) e SAC (amortização constante, parcelas que começam maiores e diminuem). No SAC, o total de juros pago tende a ser menor.',
      'Compare propostas pelo Custo Efetivo Total (CET), não só pela taxa de juros. Uma entrada maior e um prazo menor reduzem o custo total.',
    ],
    examples: ['Exemplo ilustrativo: num financiamento Price, a prestação fica igual do início ao fim, mas no começo a maior parte dela é juros.'],
    relatedQuestions: ['O que é amortização?', 'O que é CET?', 'Quanto fica a parcela de 30 mil a 1,5% ao mês em 48 meses?'],
    references: [REF.bcb, REF.bcbJuros],
    needsUpdate: 'As taxas de juros variam por instituição e ao longo do tempo. Consulte as taxas médias divulgadas pelo Banco Central.',
  },
  emprestimos: {
    summary: 'Empréstimo é dinheiro emprestado por uma instituição para uso livre, pago em parcelas com juros.',
    details: [
      'As modalidades têm custos muito diferentes: o crédito com garantia ou com desconto em folha (consignado) tende a ser mais barato do que o crédito pessoal sem garantia; cheque especial e rotativo costumam ser dos mais caros.',
      'Antes de contratar, compare o CET entre instituições e confira se a parcela cabe no orçamento com folga.',
    ],
    examples: ['Exemplo ilustrativo: duas ofertas com a mesma taxa de juros podem ter CET diferentes por causa de tarifas e seguros embutidos.'],
    relatedQuestions: ['O que é CET?', 'Como sair das dívidas?', 'Quanto estou devendo?'],
    references: [REF.bcb, REF.bcbJuros],
    needsUpdate: 'Taxas e regras de cada modalidade mudam. Confira as taxas médias atualizadas no Banco Central.',
  },
  'cartao-credito': {
    summary: 'O cartão de crédito concentra as compras do período numa fatura, que fecha numa data e vence alguns dias depois.',
    details: [
      'Pagar a fatura inteira até o vencimento evita juros. Compras feitas logo depois do fechamento só entram na fatura seguinte — é o "melhor dia de compra".',
      'Trate o limite como teto de segurança, não como renda extra. Acompanhar a fatura ao longo do mês evita surpresas.',
    ],
    examples: ['Exemplo ilustrativo: se a fatura fecha no dia 3 e vence no dia 10, uma compra feita no dia 4 só será paga no vencimento do mês seguinte.'],
    relatedQuestions: ['Quanto está a fatura do cartão?', 'Qual o limite disponível do meu cartão?', 'O que é crédito rotativo?'],
    references: [REF.bcb],
  },
  'credito-rotativo': {
    summary: 'O rotativo é o crédito usado automaticamente quando se paga menos que o total da fatura. Está entre as modalidades de crédito mais caras.',
    details: [
      'O saldo não pago vira dívida com juros altos, que se somam à fatura seguinte. Por isso, pagar só o mínimo deve ser evitado.',
      'Se não for possível pagar a fatura inteira, compare as opções de parcelamento da fatura oferecidas pelo banco com outras formas de crédito mais baratas.',
    ],
    examples: ['Exemplo ilustrativo: pagar só o mínimo por alguns meses pode fazer o saldo devedor crescer, mesmo sem novas compras.'],
    relatedQuestions: ['Como sair das dívidas?', 'O que são juros compostos?', 'Quanto está a fatura do cartão?'],
    references: [REF.bcb, REF.bcbJuros],
    needsUpdate: 'As regras do rotativo e do parcelamento de fatura são definidas pelo Conselho Monetário Nacional e pelo Banco Central e podem mudar. Consulte as regras vigentes.',
  },
  parcelamentos: {
    summary: 'Parcelar divide o pagamento de uma compra em meses. Ajuda a encaixar compras maiores, mas compromete a renda futura.',
    details: [
      'O risco está no acúmulo: várias parcelas pequenas somam um valor grande todo mês. Antes de parcelar, some as parcelas já em andamento.',
      '"Sem juros" nem sempre significa sem custo: se houver desconto à vista, o preço parcelado embute essa diferença.',
    ],
    examples: ['Exemplo ilustrativo: cinco compras de R$ 100 por mês em parcelas comprometem R$ 500 de cada mês até terminarem.'],
    relatedQuestions: ['Comprei um celular de 2.400 em 10x', 'Planejamento de compras', 'Quanto está a fatura do cartão?'],
    references: [REF.bcb, REF.consumidor],
  },
  amortizacao: {
    summary: 'Amortizar é pagar parte do saldo principal de uma dívida. Antecipar parcelas reduz os juros futuros.',
    details: [
      'Ao antecipar pagamentos, normalmente se escolhe entre reduzir o prazo (menos parcelas) ou o valor da parcela. Reduzir o prazo costuma economizar mais juros no total.',
      'O consumidor tem direito à redução proporcional dos juros ao antecipar pagamentos de crédito. Consulte o banco para simular.',
    ],
    examples: ['Exemplo ilustrativo: numa dívida longa, usar o 13º para amortizar e reduzir o prazo pode eliminar várias parcelas finais.'],
    relatedQuestions: ['O que é financiamento?', 'O que são juros compostos?', 'Quanto estou devendo?'],
    references: [REF.bcb],
    needsUpdate: 'As regras de antecipação e desconto de juros são definidas em lei e por normas do Banco Central. Confirme as condições vigentes com a instituição.',
  },
  renegociacao: {
    summary: 'Renegociar é propor novas condições a um credor — prazo, desconto, parcela — para conseguir pagar a dívida.',
    details: [
      'Antes de negociar, saiba quanto você consegue pagar por mês sem comprometer o essencial. Não aceite uma parcela que não cabe: um acordo descumprido piora a situação.',
      'Peça o CET e o valor total do acordo por escrito. Prefira canais oficiais do credor e plataformas públicas de negociação.',
    ],
    examples: ['Exemplo ilustrativo: oferecer um valor à vista menor, quando há dinheiro guardado, costuma conseguir descontos maiores do que parcelar.'],
    relatedQuestions: ['Como sair das dívidas?', 'O que é CET?', 'Quanto estou devendo?'],
    references: [REF.consumidor, REF.bcb],
  },
  cet: {
    summary: 'O Custo Efetivo Total (CET) reúne juros, tarifas, impostos e seguros de uma operação de crédito numa só taxa. É o melhor número para comparar ofertas.',
    details: [
      'As instituições financeiras devem informar o CET antes da contratação. Duas ofertas com a mesma taxa de juros podem ter CET diferentes por causa dos encargos embutidos.',
      'Compare sempre o CET no mesmo período (ao mês ou ao ano) e o valor total a pagar.',
    ],
    examples: ['Exemplo ilustrativo: um empréstimo com juros menores mas seguro obrigatório embutido pode ter CET maior do que outro sem seguro.'],
    relatedQuestions: ['O que é empréstimo?', 'O que é financiamento?', 'Como renegociar dívidas?'],
    references: [REF.bcb],
  },
}

export default content
