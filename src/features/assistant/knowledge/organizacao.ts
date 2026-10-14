import type { ArticleContent } from './index'
import { REF } from './refs'

const content: Record<string, ArticleContent> = {
  'controle-receitas': {
    summary: 'Controlar receitas é registrar tudo o que entra — salário, bicos, rendimentos, reembolsos — para saber com quanto você realmente pode contar.',
    details: [
      'Separe as receitas recorrentes (salário, aluguel recebido) das eventuais (freelas, vendas, prêmios). O planejamento do mês deve se apoiar nas recorrentes; as eventuais são ótimas para metas e reserva.',
      'Registre o valor líquido, que é o que de fato cai na conta. Se a renda varia, use a média dos últimos meses como referência e trate o que passar disso como extra.',
    ],
    examples: ['Exemplo ilustrativo: quem recebe um salário fixo e faz freelas eventuais planeja o mês só com o salário e manda o dinheiro dos freelas direto para uma meta.'],
    relatedQuestions: ['Quanto recebi neste mês?', 'Registrar receita de 500 de freela', 'O que é fluxo de caixa?'],
    references: [REF.bcb],
  },
  'controle-despesas': {
    summary: 'Controlar despesas é registrar cada gasto com valor, data e categoria, para enxergar para onde o dinheiro vai e decidir onde ajustar.',
    details: [
      'O hábito vale mais que a precisão: anotar no mesmo dia, mesmo que de forma simples, evita esquecimentos. Categorias ajudam a ver padrões — é comum descobrir que pequenos gastos frequentes somam mais do que uma conta grande.',
      'Revise uma vez por semana: confira se nada ficou de fora, marque o que já foi pago e compare com o mesmo período do mês anterior.',
    ],
    examples: ['Exemplo ilustrativo: cafés e lanches de pequeno valor, feitos quase todos os dias úteis, podem virar uma das maiores categorias do mês sem que a pessoa perceba.'],
    relatedQuestions: ['Quanto gastei este mês?', 'Qual categoria teve mais despesas?', 'Quais foram minhas maiores despesas?'],
    references: [REF.bcb],
  },
  'planejamento-mensal': {
    summary: 'Planejar o mês é decidir, antes de gastar, quanto vai para contas fixas, gastos do dia a dia, metas e reserva.',
    details: [
      'Comece pela renda líquida prevista. Reserve primeiro as contas fixas e a parcela das metas ("pague-se primeiro"); o que sobrar é o limite dos gastos variáveis.',
      'Defina limites por categoria (orçamentos) e acompanhe ao longo do mês. Se uma categoria estourar, compense em outra em vez de esperar o fim do mês.',
    ],
    examples: ['Exemplo ilustrativo: no dia do salário, a pessoa transfere a parte da meta para a poupança, separa as contas fixas e divide o restante pelas semanas do mês.'],
    relatedQuestions: ['Como está meu orçamento?', 'Quanto preciso pagar até o fim do mês?', 'O que é orçamento doméstico?'],
    references: [REF.bcb],
  },
  'fluxo-de-caixa': {
    summary: 'Fluxo de caixa é o registro das entradas e saídas de dinheiro ao longo do tempo. Mostra se sobra ou falta e em que momento.',
    details: [
      'Não basta a soma do mês fechar positiva: se as contas vencem antes de o salário cair, falta dinheiro naquele intervalo. Olhar as datas de entradas e vencimentos evita juros por atraso.',
      'Um fluxo de caixa saudável tem entradas maiores que saídas de forma constante. A diferença é o que permite formar reserva e investir.',
    ],
    examples: ['Exemplo ilustrativo: se o salário cai no dia 5 e o aluguel vence no dia 1, vale pedir a mudança do vencimento ou manter um saldo de segurança para cobrir esse intervalo.'],
    relatedQuestions: ['Quanto sobrou neste mês?', 'Quais contas vencem nos próximos 7 dias?', 'Como vou fechar o mês?'],
    references: [REF.bcb],
  },
  'orcamento-domestico': {
    summary: 'Orçamento doméstico é o plano de quanto a casa pode gastar em cada área, com base na renda e nas prioridades da família.',
    details: [
      'Um ponto de partida muito usado é dividir a renda em necessidades, desejos e objetivos (como a conhecida proporção 50/30/20). Ela é uma referência, não uma regra: o certo é ajustar à sua realidade.',
      'O orçamento funciona quando é revisado. Se a realidade mostrar que um limite é impossível, ajuste o limite ou o gasto — o importante é que a soma caiba na renda.',
    ],
    examples: ['Exemplo ilustrativo: numa divisão 50/30/20, metade da renda iria para necessidades, 30% para desejos e 20% para metas e reserva.'],
    relatedQuestions: ['Como está meu orçamento?', 'Quanto posso gastar com alimentação?', 'O que são despesas essenciais?'],
    references: [REF.bcb],
  },
  'gastos-fixos': {
    summary: 'Gastos fixos são os que se repetem com valor parecido todo mês: aluguel, condomínio, escola, plano de saúde, assinaturas.',
    details: [
      'Eles são previsíveis, o que facilita o planejamento, mas também são difíceis de cortar no curto prazo. Por isso, compromissos fixos novos merecem cuidado: uma assinatura ou parcela pequena pesa por muitos meses.',
      'Revisar os fixos uma ou duas vezes por ano (renegociar planos, trocar pacotes, cancelar o que não usa) costuma trazer economia duradoura.',
    ],
    examples: ['Exemplo ilustrativo: trocar um plano de internet ou telefone por um mais adequado ao uso real reduz a conta de todos os meses seguintes.'],
    relatedQuestions: ['Quais contas preciso pagar?', 'O que são gastos variáveis?', 'Como controlar assinaturas?'],
    references: [REF.bcb],
  },
  'gastos-variaveis': {
    summary: 'Gastos variáveis mudam de mês para mês: mercado, transporte por aplicativo, lazer, compras.',
    details: [
      'É aqui que costuma estar a maior margem de ajuste no curto prazo. Definir um limite semanal ajuda a não gastar tudo nos primeiros dias.',
      'Acompanhar por categoria mostra onde estão os excessos. Compare com meses anteriores para separar o que foi pontual do que virou hábito.',
    ],
    examples: ['Exemplo ilustrativo: dividir o limite de lazer do mês por quatro e acompanhar semana a semana evita chegar ao fim do mês sem margem.'],
    relatedQuestions: ['Compare meus gastos com o mês passado', 'Quanto gastei com lazer?', 'Estratégias para economizar'],
    references: [REF.bcb],
  },
  'despesas-essenciais': {
    summary: 'Despesas essenciais são as necessárias para viver e trabalhar: moradia, alimentação básica, saúde, transporte, contas de consumo.',
    details: [
      'Conhecer o custo essencial mensal é importante porque ele define o tamanho da reserva de emergência e quanto você precisa ganhar no mínimo para manter o padrão de vida.',
      'Mesmo dentro do essencial há escolhas: o mercado é essencial, mas a marca e o local de compra fazem diferença.',
    ],
    examples: ['Exemplo ilustrativo: somar aluguel, mercado, contas de casa, transporte e saúde de um mês típico dá uma boa estimativa do custo essencial.'],
    relatedQuestions: ['O que é reserva de emergência?', 'Quanto deveria ter de reserva?', 'O que são despesas não essenciais?'],
    references: [REF.bcb],
  },
  'despesas-nao-essenciais': {
    summary: 'Despesas não essenciais são as que trazem conforto e prazer, mas podem ser reduzidas sem comprometer o básico: restaurantes, lazer, compras por desejo.',
    details: [
      'Não essencial não significa proibido. O objetivo é que esses gastos sejam escolhas conscientes e caibam no orçamento depois das prioridades.',
      'Quando é preciso cortar, comece pelo que traz menos satisfação em relação ao custo.',
    ],
    examples: ['Exemplo ilustrativo: manter o jantar fora que a família valoriza e cortar assinaturas que ninguém usa.'],
    relatedQuestions: ['Quanto gastei com lazer neste mês?', 'O que é consumo consciente?', 'Como economizar?'],
    references: [REF.bcb],
  },
  'controle-assinaturas': {
    summary: 'Assinaturas são cobranças recorrentes (streaming, aplicativos, clubes, serviços) que, somadas, podem pesar bastante.',
    details: [
      'Por serem automáticas, são fáceis de esquecer. Faça uma lista com valor e data de cobrança e revise a cada poucos meses.',
      'Cuidado com testes gratuitos que viram cobrança. Anote a data para cancelar antes, se não for continuar.',
    ],
    examples: ['Exemplo ilustrativo: revezar serviços de streaming — assinar um por vez, conforme o que quer assistir.'],
    relatedQuestions: ['Quanto gastei com contas e serviços?', 'O que são gastos fixos?', 'Registrar Netflix todo mês'],
    references: [REF.consumidor],
  },
  'planejamento-anual': {
    summary: 'O planejamento anual antecipa despesas que não acontecem todo mês: impostos de início de ano, matrícula, seguros, presentes, férias.',
    details: [
      'Liste as despesas sazonais com o mês em que costumam ocorrer e divida o total por 12. Guardar essa parte todo mês evita apertos em janeiro e fevereiro.',
      'Rendas extras do ano (13º, restituição, bônus) podem ser destinadas a essas despesas ou às metas.',
    ],
    examples: ['Exemplo ilustrativo: somar o valor dos impostos e da matrícula do ano anterior, dividir por 12 e guardar essa parte mensalmente.'],
    relatedQuestions: ['Como planejar grandes despesas?', 'Quanto gastei neste ano?', 'Como criar metas?'],
    references: [REF.bcb],
  },
}

export default content
