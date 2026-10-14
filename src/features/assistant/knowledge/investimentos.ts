import type { ArticleContent } from './index'
import { REF } from './refs'

const RATES_NOTICE = 'Rentabilidades, taxas e regras de tributação mudam. Consulte as condições atuais nas fontes oficiais antes de decidir.'

const content: Record<string, ArticleContent> = {
  'renda-fixa': {
    summary: 'Na renda fixa, as regras de remuneração são conhecidas no momento da aplicação: uma taxa prefixada, um indicador (como CDI ou IPCA) ou uma combinação.',
    details: [
      'Exemplos: Tesouro Direto, CDB, LCI, LCA e debêntures. Prefixados pagam uma taxa definida; pós-fixados acompanham um indicador; híbridos pagam inflação mais uma taxa.',
      '"Fixa" não significa sem risco: há risco de crédito (o emissor não pagar), de mercado (preço oscilar antes do vencimento) e de liquidez. Alguns produtos bancários têm cobertura do Fundo Garantidor de Créditos (FGC), dentro dos limites dele.',
    ],
    examples: ['Exemplo ilustrativo: um título que paga "100% do CDI" acompanha o CDI do período; um "prefixado" paga a taxa combinada mesmo que os juros do país mudem.'],
    relatedQuestions: ['O que é CDB?', 'O que é Tesouro Direto?', 'O que é liquidez?'],
    references: [REF.cvm, REF.tesouro, REF.fgc],
    needsUpdate: RATES_NOTICE,
  },
  'renda-variavel': {
    summary: 'Na renda variável, o retorno não é conhecido de antemão e pode ser negativo: ações, fundos imobiliários, ETFs e outros ativos negociados em bolsa.',
    details: [
      'Os preços oscilam com resultados das empresas, juros, economia e expectativas. Por isso, é indicada para prazos longos e para uma parte do patrimônio que você aceita ver oscilar.',
      'Antes de investir, tenha reserva de emergência formada e conheça seu perfil de risco. Diversificar reduz o impacto de um ativo isolado.',
    ],
    examples: ['Exemplo ilustrativo: o valor de uma carteira de ações pode cair num ano e subir no seguinte; quem precisa do dinheiro na queda realiza a perda.'],
    relatedQuestions: ['O que é risco?', 'O que é diversificação?', 'O que é renda fixa?'],
    references: [REF.cvm, REF.b3],
    needsUpdate: RATES_NOTICE,
  },
  cdb: {
    summary: 'CDB (Certificado de Depósito Bancário) é um título emitido por bancos: você empresta dinheiro ao banco e recebe juros.',
    details: [
      'Pode ser prefixado, pós-fixado (geralmente atrelado ao CDI) ou atrelado à inflação. Alguns têm liquidez diária; outros só podem ser resgatados no vencimento.',
      'Tem cobertura do Fundo Garantidor de Créditos, dentro dos limites e regras do FGC. Compare a rentabilidade líquida, considerando impostos.',
    ],
    examples: ['Exemplo ilustrativo: um CDB de liquidez diária pode servir para a reserva de emergência; um com vencimento em 3 anos, para uma meta com esse prazo.'],
    relatedQuestions: ['O que é liquidez?', 'O que é renda fixa?', 'O que é rentabilidade?'],
    references: [REF.cvm, REF.fgc],
    needsUpdate: RATES_NOTICE,
  },
  'tesouro-direto': {
    summary: 'Tesouro Direto é o programa para pessoas físicas comprarem títulos públicos federais pela internet, emprestando dinheiro ao governo.',
    details: [
      'Há títulos atrelados à Selic (indicados para reserva, por oscilarem pouco), prefixados e atrelados à inflação (IPCA+). Os dois últimos podem ter o preço oscilando antes do vencimento — vender antes pode dar ganho ou perda.',
      'As compras são feitas por meio de uma instituição financeira habilitada. Há taxa de custódia da B3 e tributação de renda fixa.',
    ],
    examples: ['Exemplo ilustrativo: um título IPCA+ com vencimento distante combina proteção contra a inflação e um ganho real, desde que mantido até o fim.'],
    relatedQuestions: ['O que é inflação?', 'O que é renda fixa?', 'O que é liquidez?'],
    references: [REF.tesouro, REF.b3],
    needsUpdate: RATES_NOTICE,
  },
  fundos: {
    summary: 'Fundo de investimento reúne o dinheiro de vários investidores, aplicado por um gestor profissional conforme uma política definida.',
    details: [
      'Há fundos de renda fixa, multimercado, ações, cambiais e outros. Você compra cotas, e o valor delas varia conforme os ativos do fundo.',
      'Observe a taxa de administração (e de performance, se houver), o prazo de resgate e o histórico em relação ao objetivo do fundo. Taxas altas corroem a rentabilidade ao longo do tempo.',
    ],
    examples: ['Exemplo ilustrativo: dois fundos com a mesma estratégia e taxas de administração diferentes tendem a entregar resultados líquidos diferentes ao longo dos anos.'],
    relatedQuestions: ['O que é diversificação?', 'O que é rentabilidade?', 'O que é risco?'],
    references: [REF.cvm],
    needsUpdate: RATES_NOTICE,
  },
  liquidez: {
    summary: 'Liquidez é a facilidade e a rapidez de transformar um investimento em dinheiro sem perder valor.',
    details: [
      'Produtos com liquidez diária permitem resgate a qualquer momento; outros só pagam no vencimento ou têm prazo de carência. Geralmente, abrir mão de liquidez é compensado com taxas maiores.',
      'Combine liquidez e objetivo: reserva de emergência pede liquidez imediata; metas de longo prazo podem ficar em produtos com vencimento.',
    ],
    examples: ['Exemplo ilustrativo: um imóvel tem baixa liquidez — vender rápido costuma exigir desconto.'],
    relatedQuestions: ['O que é reserva de emergência?', 'O que é CDB?', 'O que é Tesouro Direto?'],
    references: [REF.cvm],
  },
  rentabilidade: {
    summary: 'Rentabilidade é quanto um investimento rendeu em um período, normalmente em percentual.',
    details: [
      'Diferencie bruta (antes de impostos e taxas) de líquida (o que fica para você). Compare também com a inflação: rentabilidade real é o ganho acima dela.',
      'Rentabilidade passada não garante rentabilidade futura. Compare produtos no mesmo prazo e com riscos semelhantes.',
    ],
    examples: ['Exemplo ilustrativo: se um investimento rendeu 10% no ano e a inflação foi de 4%, o ganho real ficou em torno de 5,8% (1,10 ÷ 1,04 − 1).'],
    relatedQuestions: ['O que é inflação?', 'Quanto rende 5000 a 1% ao mês por 24 meses?', 'O que são juros compostos?'],
    references: [REF.cvm],
    needsUpdate: RATES_NOTICE,
  },
  inflacao: {
    summary: 'Inflação é o aumento generalizado dos preços, que reduz o poder de compra do dinheiro ao longo do tempo.',
    details: [
      'No Brasil, o índice oficial é o IPCA, calculado pelo IBGE. Dinheiro parado perde valor real; por isso, investimentos devem ser avaliados pelo ganho acima da inflação.',
      'Sua inflação pessoal pode ser diferente do índice, dependendo do que você consome.',
    ],
    examples: ['Exemplo ilustrativo: com inflação de 5% ao ano, algo que custava R$ 100 passa a custar cerca de R$ 105 um ano depois.'],
    relatedQuestions: ['O que é rentabilidade?', 'O que é Tesouro Direto?', 'Qual a inflação atual?'],
    references: [REF.ibge, REF.bcb],
    needsUpdate: 'O índice de inflação muda todo mês. Consulte o valor atual no IBGE.',
  },
  risco: {
    summary: 'Risco é a possibilidade de o resultado de um investimento ser diferente do esperado, inclusive com perdas.',
    details: [
      'Principais tipos: de mercado (oscilação de preços), de crédito (o emissor não pagar), de liquidez (não conseguir vender quando precisa). Em geral, maior potencial de retorno vem com maior risco.',
      'As instituições devem avaliar seu perfil de investidor (suitability) antes de recomendar produtos. Conhecer seu prazo e sua tolerância a perdas evita decisões ruins em momentos de queda.',
    ],
    examples: ['Exemplo ilustrativo: um investimento que promete retorno muito acima do mercado sem risco é um sinal de alerta para golpe.'],
    relatedQuestions: ['O que é diversificação?', 'O que é renda variável?', 'O que é liquidez?'],
    references: [REF.cvm],
  },
  diversificacao: {
    summary: 'Diversificar é distribuir o dinheiro entre diferentes investimentos, para que um resultado ruim isolado não comprometa tudo.',
    details: [
      'Pode-se diversificar por classe (renda fixa, variável), emissor, prazo, setor e país. Diversificar não elimina o risco, mas reduz a dependência de um único ativo.',
      'Mais produtos não é sinônimo de mais diversificação: vários fundos com a mesma estratégia têm pouco efeito.',
    ],
    examples: ['Exemplo ilustrativo: quem tem todo o patrimônio em ações de uma única empresa fica muito exposto a problemas dela.'],
    relatedQuestions: ['O que é risco?', 'O que são fundos de investimento?', 'O que é renda fixa?'],
    references: [REF.cvm],
  },
  'patrimonio-liquido': {
    summary: 'Patrimônio líquido é tudo o que você tem menos tudo o que você deve: saldos e investimentos mais bens, menos dívidas.',
    details: [
      'No CashBot, ele é calculado com o saldo das contas, os bens e investimentos cadastrados, menos as dívidas e o valor em aberto nos cartões.',
      'Acompanhar a evolução mês a mês é um dos melhores indicadores de progresso financeiro — mais do que a renda.',
    ],
    examples: ['Exemplo ilustrativo: R$ 20.000 em contas e investimentos, um carro de R$ 40.000 e um financiamento de R$ 25.000 resultam em patrimônio líquido de R$ 35.000.'],
    relatedQuestions: ['Qual meu patrimônio líquido?', 'Como está minha evolução patrimonial?', 'Quanto estou devendo?'],
    references: [REF.bcb],
  },
}

export default content
