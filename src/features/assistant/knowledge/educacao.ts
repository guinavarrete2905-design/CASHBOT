import type { ArticleContent } from './index'
import { REF } from './refs'

const content: Record<string, ArticleContent> = {
  'conceitos-basicos': {
    summary: 'Finanças pessoais se apoiam em poucos princípios: gastar menos do que ganha, ter reserva para imprevistos, evitar dívidas caras e investir com objetivo.',
    details: [
      'Por onde começar: 1) registre o que entra e sai por um mês; 2) identifique gastos fixos, variáveis e essenciais; 3) monte um orçamento; 4) forme a reserva de emergência; 5) defina metas e invista para elas.',
      'Consistência importa mais que perfeição. Um controle simples mantido todo mês vale mais do que uma planilha complexa abandonada.',
    ],
    examples: ['Exemplo ilustrativo: no primeiro mês, apenas registre tudo; no segundo, use os dados para definir limites por categoria.'],
    relatedQuestions: ['Como controlar despesas?', 'O que é orçamento doméstico?', 'O que é reserva de emergência?'],
    references: [REF.bcb],
  },
  'indicadores-financeiros': {
    summary: 'Alguns indicadores simples mostram a saúde financeira: taxa de poupança, comprometimento da renda com dívidas, meses de reserva e evolução do patrimônio.',
    details: [
      'Taxa de poupança: quanto da renda sobra no mês (sobra ÷ renda). Comprometimento com dívidas: parcelas ÷ renda. Meses de reserva: reserva ÷ despesas essenciais mensais.',
      'Acompanhe a tendência ao longo dos meses, não só um mês isolado.',
    ],
    examples: ['Exemplo ilustrativo: renda de R$ 5.000 e sobra de R$ 750 no mês significam taxa de poupança de 15%.'],
    relatedQuestions: ['Quanto economizei neste mês?', 'Qual meu patrimônio líquido?', 'Quanto deveria ter de reserva?'],
    references: [REF.bcb],
  },
  'consumo-consciente': {
    summary: 'Consumo consciente é comprar por necessidade ou escolha deliberada, e não por impulso, considerando o impacto no orçamento.',
    details: [
      'Antes de comprar, pergunte: preciso disso? Posso esperar? Cabe no orçamento sem tirar de uma prioridade? Esperar 24 horas para compras não planejadas reduz arrependimentos.',
      'Desconfie de urgência artificial ("só hoje") e de compras para aliviar emoções. Lista de compras e limite semanal ajudam.',
    ],
    examples: ['Exemplo ilustrativo: deixar itens no carrinho por um dia e voltar a avaliar costuma eliminar parte das compras por impulso.'],
    relatedQuestions: ['Estratégias para economizar', 'O que são despesas não essenciais?', 'Hábitos financeiros'],
    references: [REF.bcb, REF.consumidor],
  },
  'habitos-financeiros': {
    summary: 'Bons hábitos financeiros são rotinas simples que, repetidas, mantêm as contas em ordem sem esforço constante.',
    details: [
      'Exemplos: registrar gastos no mesmo dia, revisar as finanças uma vez por semana, separar a meta assim que a renda entra, conferir a fatura antes do vencimento.',
      'Automatize o que puder (débito automático de contas fixas, transferência programada para a reserva) e reduza decisões repetitivas.',
    ],
    examples: ['Exemplo ilustrativo: reservar 15 minutos no domingo para conferir o que foi lançado na semana e o que vence na próxima.'],
    relatedQuestions: ['Quais contas vencem nos próximos 7 dias?', 'Como controlar despesas?', 'O que é consumo consciente?'],
    references: [REF.bcb],
  },
  'longo-prazo': {
    summary: 'O planejamento de longo prazo pensa em objetivos de muitos anos — aposentadoria, independência financeira, educação dos filhos.',
    details: [
      'O tempo é o principal aliado por causa dos juros compostos: começar cedo, mesmo com pouco, faz grande diferença. Considere a inflação ao estimar quanto precisará no futuro.',
      'Previdência pública, previdência privada e investimentos próprios podem se complementar. As regras de cada um mudam e devem ser consultadas nas fontes oficiais.',
    ],
    examples: ['Exemplo ilustrativo: aportes mensais constantes por 30 anos tendem a acumular bem mais do que o dobro de aportes por 15 anos, por causa dos juros compostos.'],
    relatedQuestions: ['O que são juros compostos?', 'O que é inflação?', 'O que é diversificação?'],
    references: [REF.cvm, REF.bcb],
    needsUpdate: 'Regras de previdência e de tributação de investimentos mudam. Confira as normas vigentes antes de decidir.',
  },
  'organizacao-patrimonial': {
    summary: 'Organização patrimonial é manter registrado o que você tem (contas, investimentos, bens) e o que deve, com documentos em ordem.',
    details: [
      'Mantenha uma lista atualizada com instituição, tipo, valor aproximado e documentos de cada item. Isso facilita decisões, declarações e, em caso de necessidade, a vida da família.',
      'Revise o valor dos bens periodicamente e acompanhe o patrimônio líquido mês a mês.',
    ],
    examples: ['Exemplo ilustrativo: cadastrar no CashBot os bens e as dívidas na área de Patrimônio e atualizar os valores a cada alguns meses.'],
    relatedQuestions: ['Qual meu patrimônio líquido?', 'Como está minha evolução patrimonial?', 'O que é patrimônio líquido?'],
    references: [REF.bcb],
  },
}

export default content
