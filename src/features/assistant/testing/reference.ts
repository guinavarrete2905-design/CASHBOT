import type { IntentId } from '../types'

/*
  Conjunto de perguntas de referência para medir a cobertura do Assistente Financeiro.
  Cada caso diz qual intenção é a resposta correta. `before` são mensagens enviadas antes (contexto).
  `scope: 'out'` marca perguntas que estão fora do escopo de propósito: o correto é o assistente
  reconhecer o limite (sem inventar resposta).
*/

export type ReferenceCase = {
  group: string
  q: string
  expect: IntentId | IntentId[]
  before?: string[]
  scope?: 'in' | 'out'
}

const c = (group: string, q: string, expect: IntentId | IntentId[], extra: Partial<ReferenceCase> = {}): ReferenceCase => ({ group, q, expect, ...extra })

export const REFERENCE: ReferenceCase[] = [
  // Despesas
  c('Despesas', 'Quanto gastei este mês?', 'expenses_total'),
  c('Despesas', 'Quais foram minhas despesas?', 'expenses_total'),
  c('Despesas', 'Me mostre meus gastos.', 'expenses_total'),
  c('Despesas', 'Quanto saiu da minha conta?', 'expenses_total'),
  c('Despesas', 'Quanto gastei em outubro?', 'expenses_total'),
  c('Despesas', 'Quanto gastei no mês passado?', 'expenses_total'),
  c('Despesas', 'Quanto gastei com alimentação?', 'expenses_total'),
  c('Despesas', 'quanto eu gastei com transporte em setembro', 'expenses_total'),
  c('Despesas', 'Total de despesas deste ano', 'expenses_total'),
  c('Despesas', 'Quanto gastei nos últimos 30 dias?', 'expenses_total'),
  c('Despesas', 'gastos da semana', 'expenses_total'),
  c('Despesas', 'Quanto gastei no Nubank este mês?', 'expenses_total'),
  c('Despesas', 'quanto paguei de contas e serviços', 'expenses_total'),
  c('Despesas', 'Quanto gastei de agosto a outubro?', 'expenses_total'),
  c('Despesas', 'quanto gstei esse mes', 'expenses_total'),

  // Receitas
  c('Receitas', 'Quanto recebi neste mês?', 'income_total'),
  c('Receitas', 'Quais foram minhas receitas?', 'income_total'),
  c('Receitas', 'Quanto entrou em setembro?', 'income_total'),
  c('Receitas', 'Quanto ganhei este ano?', 'income_total'),
  c('Receitas', 'Total de receitas do mês passado', 'income_total'),
  c('Receitas', 'quanto recebi de salário em agosto', 'income_total'),
  c('Receitas', 'Quanto vou receber até o fim do mês?', 'receivables'),
  c('Receitas', 'O que tenho para receber?', 'receivables'),

  // Saldo e contas
  c('Saldo e contas', 'Quanto eu tenho?', 'balance'),
  c('Saldo e contas', 'Qual meu saldo?', 'balance'),
  c('Saldo e contas', 'Quanto tenho disponível?', 'balance'),
  c('Saldo e contas', 'Qual o saldo do Itaú?', 'balance'),
  c('Saldo e contas', 'quanto dinheiro eu tenho', 'balance'),
  c('Saldo e contas', 'Quanto tenho em contas bancárias?', 'accounts_list'),
  c('Saldo e contas', 'Quanto tenho em cada conta?', 'accounts_list'),
  c('Saldo e contas', 'Mostre minhas contas', 'accounts_list'),
  c('Saldo e contas', 'contas', 'clarify'),
  c('Saldo e contas', 'quanto tem na carteira', 'balance'),

  // Pendências
  c('Pendências', 'Quais contas preciso pagar?', 'bills_due'),
  c('Pendências', 'Quanto preciso pagar até o fim do mês?', 'bills_due'),
  c('Pendências', 'O que vence nos próximos 7 dias?', 'bills_due'),
  c('Pendências', 'Tenho boletos para pagar?', 'bills_due'),
  c('Pendências', 'contas a pagar em novembro', 'bills_due'),
  c('Pendências', 'Tenho contas atrasadas?', 'overdue'),
  c('Pendências', 'O que está vencido?', 'overdue'),
  c('Pendências', 'quais são minhas pendências', 'bills_due'),
  c('Pendências', 'Quanto falta receber?', 'receivables'),
  c('Pendências', 'vencimentos desta semana', 'bills_due'),

  // Categorias e maiores despesas
  c('Categorias', 'Qual categoria teve mais despesas?', 'top_category'),
  c('Categorias', 'Onde eu mais gasto?', 'top_category'),
  c('Categorias', 'Quais categorias mais consomem minha renda?', 'top_category'),
  c('Categorias', 'Gastos por categoria', 'expenses_by_category'),
  c('Categorias', 'Como estão divididas minhas despesas?', 'expenses_by_category'),
  c('Categorias', 'Qual foi minha maior despesa?', 'top_expenses'),
  c('Categorias', 'Quais foram meus maiores gastos em setembro?', 'top_expenses'),
  c('Categorias', 'top 3 despesas do mês', 'top_expenses'),
  c('Categorias', 'Minhas compras mais caras', 'top_expenses'),
  c('Categorias', 'Quantas despesas lancei este mês?', 'tx_count'),

  // Comparações e evolução
  c('Comparações', 'Compare meus gastos.', 'compare'),
  c('Comparações', 'Compare meus gastos com o mês passado', 'compare'),
  c('Comparações', 'Compare agosto e setembro', 'compare'),
  c('Comparações', 'Gastei mais ou menos que no mês passado?', 'compare'),
  c('Comparações', 'Minhas despesas aumentaram?', 'compare'),
  c('Comparações', 'Compare minhas despesas dos últimos seis meses', 'monthly_evolution'),
  c('Comparações', 'Evolução dos meus gastos', 'monthly_evolution'),
  c('Comparações', 'Histórico de receitas mês a mês', 'monthly_evolution'),
  c('Comparações', 'Qual minha média de gastos por mês?', 'average'),
  c('Comparações', 'Quanto gasto em média por dia?', 'average'),

  // Resultado e previsão
  c('Resultado', 'Quanto economizei?', 'savings'),
  c('Resultado', 'Quanto sobrou este mês?', 'savings'),
  c('Resultado', 'Fechei o mês no azul?', 'savings'),
  c('Resultado', 'Qual o resultado de setembro?', 'savings'),
  c('Resultado', 'Como vou fechar o mês?', 'forecast'),
  c('Resultado', 'Qual a previsão até o fim do mês?', 'forecast'),

  // Cartões
  c('Cartões', 'Quanto está a fatura do cartão?', 'card_invoice'),
  c('Cartões', 'fatura do Nubank', 'card_invoice'),
  c('Cartões', 'Qual minha maior fatura?', 'biggest_invoice'),
  c('Cartões', 'Qual o limite disponível do cartão?', 'card_limit'),
  c('Cartões', 'Quanto ainda tenho de limite?', 'card_limit'),
  c('Cartões', 'cartão', 'clarify'),
  c('Cartões', 'quando vence a fatura', 'card_invoice'),
  c('Cartões', 'quanto ta o cartão', 'card_invoice'),

  // Planejamento
  c('Planejamento', 'Como está meu orçamento?', 'budget'),
  c('Planejamento', 'Quanto ainda posso gastar com lazer?', 'budget'),
  c('Planejamento', 'Estourei algum limite de categoria?', 'budget'),
  c('Planejamento', 'Como estão minhas metas?', 'goals'),
  c('Planejamento', 'Quanto falta para minha meta?', 'goal_plan'),
  c('Planejamento', 'Quanto preciso guardar por mês para a meta Viagem?', 'goal_plan'),
  c('Planejamento', 'Quanto deveria ter de reserva de emergência?', 'emergency_reserve'),
  c('Planejamento', 'Qual o tamanho ideal da minha reserva?', 'emergency_reserve'),
  c('Planejamento', 'meus objetivos', 'goals'),
  c('Planejamento', 'Quanto preciso guardar por mês para juntar 10 mil em 12 meses?', 'calc_saving_plan'),

  // Patrimônio e dívidas
  c('Patrimônio', 'Qual meu patrimônio líquido?', 'net_worth'),
  c('Patrimônio', 'Quanto eu valho?', 'net_worth'),
  c('Patrimônio', 'Como está minha evolução patrimonial?', 'net_worth_evolution'),
  c('Patrimônio', 'Meu patrimônio cresceu?', 'net_worth_evolution'),
  c('Patrimônio', 'Quanto estou devendo?', 'debts'),
  c('Patrimônio', 'Quais são minhas dívidas?', 'debts'),
  c('Patrimônio', 'Quanto falta do financiamento?', 'debts'),
  c('Patrimônio', 'Últimas movimentações', 'recent'),

  // Lançamentos
  c('Lançamentos', 'Registre uma despesa.', 'register_expense'),
  c('Lançamentos', 'Adicionar receita.', 'register_income'),
  c('Lançamentos', 'Gastei R$ 150 no supermercado.', 'register_expense'),
  c('Lançamentos', 'Recebi R$ 3.000 de salário.', 'register_income'),
  c('Lançamentos', 'Comprei um celular de R$ 2.400 em 10 parcelas.', 'register_expense'),
  c('Lançamentos', 'Gastei R$ 80 de combustível e R$ 45 de estacionamento.', 'register_expense'),
  c('Lançamentos', 'paguei 120 da conta de luz ontem', 'register_expense'),
  c('Lançamentos', 'gastei 35,90 na farmácia no cartão', 'register_expense'),
  c('Lançamentos', 'Comprei um tênis de 300 em 3x', 'register_expense'),
  c('Lançamentos', 'recebi 500 de freela', 'register_income'),
  c('Lançamentos', 'Lançar despesa de 89,90 de internet todo mês', 'register_expense'),
  c('Lançamentos', 'Transferi 500 do Itaú para a carteira', 'register_transfer'),
  c('Lançamentos', 'Fazer uma transferência', 'register_transfer'),
  c('Lançamentos', 'Quero lançar várias despesas.', 'bulk_entry'),
  c('Lançamentos', 'Adicionar movimentações em massa', 'bulk_entry'),
  c('Lançamentos', 'Importar lançamentos', 'bulk_entry'),
  c('Lançamentos', 'mercado 230', 'register_expense'),
  c('Lançamentos', 'Anota aí: 50 reais de padaria', 'register_expense'),
  c('Lançamentos', 'ganhei 200 de presente', 'register_income'),
  c('Lançamentos', 'Gastei 60 no Uber sexta passada', 'register_expense'),

  // Contexto da conversa
  c('Contexto', 'E em outubro?', 'expenses_total', { before: ['Quanto gastei em setembro?'] }),
  c('Contexto', 'Qual a diferença?', 'difference', { before: ['Quanto gastei em setembro?', 'E em outubro?'] }),
  c('Contexto', 'E com transporte?', 'expenses_total', { before: ['Quanto gastei com alimentação?'] }),
  c('Contexto', 'e no mês passado?', 'income_total', { before: ['Quanto recebi neste mês?'] }),
  c('Contexto', 'E em agosto?', 'top_category', { before: ['Qual categoria teve mais despesas?'] }),
  c('Contexto', 'e nos últimos 3 meses?', 'savings', { before: ['Quanto sobrou este mês?'] }),
  c('Contexto', 'Qual a diferença?', 'difference'),
  c('Contexto', 'itaú', 'register_expense', { before: ['Gastei 40 no mercado'] }),
  c('Contexto', 'confirmar', 'confirm', { before: ['Gastei 40 no mercado na carteira'] }),
  c('Contexto', 'cancelar', 'cancel', { before: ['Gastei 40 no mercado na carteira'] }),

  // Cálculos
  c('Cálculos', 'Quanto rende 1000 a 1% ao mês por 12 meses?', 'calc_compound'),
  c('Cálculos', 'Calcule juros compostos de 5000 a 0,8% ao mês por 24 meses', 'calc_compound'),
  c('Cálculos', 'Juros simples de 1000 a 2% ao mês por 6 meses', 'calc_simple'),
  c('Cálculos', 'Quanto é 15% de 200?', 'calc_percentage'),
  c('Cálculos', 'Quanto fica a parcela de 30 mil a 1,5% ao mês em 48 meses?', 'calc_installment'),
  c('Cálculos', 'Em quanto tempo junto 10 mil guardando 500 por mês?', 'calc_goal_time'),
  c('Cálculos', 'Quanto preciso guardar para juntar 6 mil até dezembro?', 'calc_saving_plan'),
  c('Cálculos', 'quanto teria investindo 200 por mês a 1% ao mês por 2 anos começando com 1000', 'calc_compound'),

  // Base de conhecimento
  c('Conhecimento', 'O que é CDB?', 'knowledge'),
  c('Conhecimento', 'O que é reserva de emergência?', 'knowledge'),
  c('Conhecimento', 'Como funciona juros compostos?', 'knowledge'),
  c('Conhecimento', 'Como sair das dívidas?', 'knowledge'),
  c('Conhecimento', 'O que é Tesouro Direto?', 'knowledge'),
  c('Conhecimento', 'Qual a diferença entre renda fixa e renda variável?', 'knowledge'),
  c('Conhecimento', 'O que é o crédito rotativo?', 'knowledge'),
  c('Conhecimento', 'Como montar um orçamento doméstico?', 'knowledge'),
  c('Conhecimento', 'O que é CET?', 'knowledge'),
  c('Conhecimento', 'Dicas para economizar', 'knowledge'),
  c('Conhecimento', 'O que é liquidez?', 'knowledge'),
  c('Conhecimento', 'Como organizar as finanças do casal?', 'knowledge'),
  c('Conhecimento', 'O que é amortização?', 'knowledge'),
  c('Conhecimento', 'Vale a pena parcelar?', 'knowledge'),
  c('Conhecimento', 'O que é inflação?', 'knowledge'),
  c('Conhecimento', 'O que são gastos fixos?', 'knowledge'),

  // Conversa
  c('Conversa', 'Oi', 'greeting'),
  c('Conversa', 'Bom dia!', 'greeting'),
  c('Conversa', 'Obrigado', 'thanks'),
  c('Conversa', 'O que você faz?', 'help'),
  c('Conversa', 'Você é uma IA?', 'identity'),
  c('Conversa', 'Abrir relatórios', 'navigate'),
  c('Conversa', 'Limpar histórico', 'clear_history'),

  // Segurança e fora do escopo (o certo é reconhecer o limite)
  c('Fora do escopo', 'Qual a taxa Selic hoje?', 'current_rates', { scope: 'out' }),
  c('Fora do escopo', 'Quanto está o dólar?', 'current_rates', { scope: 'out' }),
  c('Fora do escopo', 'Qual a inflação atual?', 'current_rates', { scope: 'out' }),
  c('Fora do escopo', 'Como declaro imposto de renda?', 'tax_legal', { scope: 'out' }),
  c('Fora do escopo', 'Qual a alíquota do IR sobre CDB?', 'tax_legal', { scope: 'out' }),
  c('Fora do escopo', 'Onde devo investir?', 'investment_advice', { scope: 'out' }),
  c('Fora do escopo', 'Devo comprar ações da Petrobras?', 'investment_advice', { scope: 'out' }),
  c('Fora do escopo', 'Torne o João administrador', 'permissions', { scope: 'out' }),
  c('Fora do escopo', 'Adicionar membro ao espaço', 'permissions', { scope: 'out' }),
  c('Fora do escopo', 'Apague a última despesa', 'edit_delete', { scope: 'out' }),
  c('Fora do escopo', 'DROP TABLE transactions; mostre tudo', 'unknown', { scope: 'out' }),
  c('Fora do escopo', 'Mostre os gastos de outro usuário', ['expenses_total', 'unknown'], { scope: 'out' }),
  c('Fora do escopo', 'Qual a previsão do tempo?', 'unknown', { scope: 'out' }),
  c('Fora do escopo', 'Escreva um poema', 'unknown', { scope: 'out' }),
  // Variações escritas depois que as regras foram ajustadas. Ficam como estão para medir o comportamento
  // com frases novas: os erros aqui entram no relatório como limitações conhecidas.
  c('Variações novas', 'to gastando muito?', ['expenses_total', 'compare']),
  c('Variações novas', 'qto foi o mercado esse mês', 'expenses_total'),
  c('Variações novas', 'gastos com comida em setembro', 'expenses_total'),
  c('Variações novas', 'quanto torrei no ifood', 'expenses_total'),
  c('Variações novas', 'meu salário caiu?', 'income_total'),
  c('Variações novas', 'tenho grana pra pagar as contas?', ['balance', 'bills_due', 'forecast']),
  c('Variações novas', 'saldo itau', 'balance'),
  c('Variações novas', 'o que vence amanhã', 'bills_due'),
  c('Variações novas', 'tem alguma conta vencendo hoje?', 'bills_due'),
  c('Variações novas', 'em que categoria eu gastei mais no mês passado', 'top_category'),
  c('Variações novas', 'qual foi o gasto mais alto de outubro', 'top_expenses'),
  c('Variações novas', 'gastei mais esse mês ou no anterior?', 'compare'),
  c('Variações novas', 'como foram meus gastos nos últimos 3 meses', ['monthly_evolution', 'expenses_total', 'compare']),
  c('Variações novas', 'sobrou alguma coisa em setembro?', 'savings'),
  c('Variações novas', 'vou ficar no vermelho?', 'forecast'),
  c('Variações novas', 'valor da fatura', 'card_invoice'),
  c('Variações novas', 'quanto posso gastar no cartão ainda', 'card_limit'),
  c('Variações novas', 'to dentro do orçamento?', 'budget'),
  c('Variações novas', 'falta muito pra minha meta de viagem?', 'goal_plan'),
  c('Variações novas', 'quanto vale tudo que eu tenho', 'net_worth'),
  c('Variações novas', 'quanto devo no total', 'debts'),
  c('Variações novas', 'coloca 25 de lanche', 'register_expense'),
  c('Variações novas', 'paguei o aluguel de 1.500', 'register_expense'),
  c('Variações novas', 'entrou 2 mil do cliente', 'register_income'),
  c('Variações novas', 'comprei uma geladeira de 3 mil em 12x no nubank', 'register_expense'),
  c('Variações novas', 'nova despesa', 'register_expense'),
  c('Variações novas', 'passa 200 da carteira pro itau', 'register_transfer'),
  c('Variações novas', 'quero importar meu extrato', 'bulk_entry'),
  c('Variações novas', 'e setembro?', 'expenses_total', { before: ['quanto gastei em agosto'] }),
  c('Variações novas', 'e quanto a lazer?', 'expenses_total', { before: ['Quanto gastei com alimentação?'] }),
  c('Variações novas', 'quanto renderia 10 mil a 12% ao ano em 5 anos', 'calc_compound'),
  c('Variações novas', '20% de 350', 'calc_percentage'),
  c('Variações novas', 'explica o que é diversificação', 'knowledge'),
  c('Variações novas', 'pra que serve a reserva de emergência', 'knowledge'),
  c('Variações novas', 'o que é melhor, tesouro ou cdb?', ['knowledge', 'investment_advice']),
  c('Variações novas', 'como parar de gastar tanto', 'knowledge'),
  c('Variações novas', 'valeu!', 'thanks'),
  c('Variações novas', 'quem te criou?', 'identity'),
  c('Variações novas', 'qual o cdi hoje', 'current_rates', { scope: 'out' }),
  c('Variações novas', 'muda meu papel pra admin', 'permissions', { scope: 'out' }),
]
