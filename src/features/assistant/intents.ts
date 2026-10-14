import { correctTypos } from './normalize'
import type { IntentId } from './types'

/*
  Reconhecimento de intenções por regras.
  Cada regra dá uma pontuação para a mensagem (texto normalizado + sinais extraídos).
  A maior pontuação vence; empates próximos entre intenções diferentes viram uma pergunta de esclarecimento.
*/

export type Signals = {
  /** Há valor em dinheiro explícito ("R$ 150", "150 reais", "3 mil"). */
  explicitAmount: boolean
  /** Há qualquer número que possa ser valor (inclui números soltos). */
  anyAmount: boolean
  periods: number
  hasCategory: boolean
  hasAccount: boolean
  hasInstallments: boolean
  hasPercent: boolean
  hasDuration: boolean
  /** A mensagem tem cara de pergunta (palavra interrogativa ou "?"). */
  question: boolean
  words: number
}

type Rule = { id: IntentId; score: (t: string, s: Signals) => number }

const EXPENSE = /\b(gast\w*|despesas?|saiu|sairam|saidas?|paguei|pago|desembols\w*|torrei|consumi|gastos?)\b/
const INCOME = /\b(receb\w*|receitas?|entrou|entraram|entradas?|ganhei|ganhos?|renda|faturei|caiu na conta)\b/
const ASK = /\b(quanto|quanta|quantos|quantas|qual|quais|quando|onde|como|mostr\w*|me (diz|diga|fala|fale|passa)|lista\w*|ver|veja|exib\w*|resum\w*|total|soma|consulta\w*|sabe)\b/
const REGISTER_VERB =
  /\b(registr\w*|lanc\w*|adicion\w*|anot\w*|inclu\w*|cadastr\w*|cri[ae]r?|coloc\w*|insir\w*|inserir|bot\w*|marc\w*)\b/
const SPEND_VERB = /\b(gastei|paguei|comprei|torrei|desembolsei|gasto de|compra de|pagamento de)\b/
const EARN_VERB = /\b(recebi|ganhei|entrou|caiu|faturei|me pagaram|recebimento de)\b/

export const QUESTION_START = /^(quanto|quanta|quantos|quantas|qual|quais|quando|onde|como|o que|sera|tenho|estou|posso|devo|ja|existe|ha|e)\b/

const RULES: Rule[] = [
  // ---- Conversa ----
  { id: 'greeting', score: (t, s) => (/^(oi+|ola|bom dia|boa tarde|boa noite|e ai|eai|opa|hey|hello|salve|tudo bem)\b/.test(t) && s.words <= 5 ? 9 : 0) },
  { id: 'thanks', score: (t, s) => (/\b(obrigad\w*|valeu|vlw|brigad\w*|agradec\w*|thanks)\b/.test(t) && s.words <= 6 ? 9 : 0) },
  {
    id: 'identity',
    score: (t) =>
      /\b(voce|vc|tu) (e|eh|es) (uma? )?(ia|inteligencia artificial|robo|bot|humano|pessoa|chatgpt|gpt|claude)\b|\bquem (e|eh) voce\b|\bquem (te )?(criou|fez)\b|\b(usa|e feito com|funciona com) (ia|inteligencia artificial)\b/.test(t)
        ? 10
        : 0,
  },
  {
    id: 'help',
    score: (t, s) =>
      /\b(ajuda|socorro|o que (voce|vc) (faz|sabe|consegue|pode)|como (te |)(uso|usar|funciona voce)|comandos|exemplos de pergunta|o que posso (perguntar|pedir)|menu|opcoes)\b/.test(t) && s.words <= 10 ? 8 : 0,
  },
  {
    id: 'clear_history',
    score: (t) => (/\b(limp\w*|apag\w*|exclu\w*|zer\w*|delet\w*) (o |a |meu |minha |todo o |toda a )?(historico|conversa|chat|mensagens)\b/.test(t) ? 10 : 0),
  },
  { id: 'confirm', score: (t, s) => (/^(confirm\w*|sim|pode (salvar|lancar|registrar|confirmar)|ok|isso|correto|certo|salva|salvar|manda|pode)\b/.test(t) && s.words <= 4 ? 8 : 0) },
  { id: 'cancel', score: (t, s) => (/^(cancel\w*|nao|deixa|esquece|desist\w*|para|pare)\b/.test(t) && s.words <= 4 ? 8 : 0) },

  // ---- Segurança e fora do escopo ----
  {
    id: 'permissions',
    score: (t) =>
      /\b(permiss\w*|papel|papeis|administrador|admin|tornar .*(admin|dono|proprietario)|convid\w*|(adicion|remov|exclu|tir)\w* (um |o |a )?(membro|pessoa|usuario)|mud\w* (o |meu )?(papel|cargo|acesso)|dar acesso|tirar acesso)\b/.test(t)
        ? 9
        : 0,
  },
  {
    id: 'edit_delete',
    score: (t) =>
      /\b(apag\w*|exclu\w*|delet\w*|remov\w*|edit\w*|alter\w*|corrig\w*|desfaz\w*|estorn\w*)\b.*\b(movimentac\w*|despesas?|receitas?|lancamentos?|transac\w*|gastos?|compras?|ultim[oa])\b/.test(t)
        ? 9
        : 0,
  },
  {
    id: 'current_rates',
    score: (t) =>
      /\b(selic|cdi|ipca|igpm|igp m|inflacao|dolar|euro|cotacao|taxa basica|poupanca rende|rendimento da poupanca)\b/.test(t) &&
      /\b(hoje|atual|atualmente|agora|quanto (esta|ta|e|rende)|qual (e|a|o)|esta em|ta em|vale|do mes|deste ano|este ano)\b/.test(t)
        ? 9
        : 0,
  },
  {
    id: 'tax_legal',
    score: (t) =>
      /\b(imposto de renda|irpf|declarar|declaracao|leao|receita federal|tributa\w*|aliquota|iof|come cotas|isento|isencao|juridic\w*|advogad\w*|inventario)\b/.test(t)
        ? 8
        : 0,
  },
  {
    id: 'investment_advice',
    score: (t) =>
      /\b(qual (o |e o )?melhor investimento|onde (devo |eu devo |posso )?investir|em que (devo )?investir|devo (comprar|vender|investir)|vale a pena (investir|comprar) (em|acoes|bitcoin|cripto)|(compro|vendo) (acoes|bitcoin|cripto|dolar)|qual acao|que acao comprar)\b/.test(t)
        ? 9
        : 0,
  },

  // ---- Lançamentos ----
  {
    id: 'bulk_entry',
    score: (t) =>
      /\b(varias|varios|muitas|muitos|em massa|em lote|de uma vez|planilha|importar|importacao|extrato bancario|arquivo|csv|ofx)\b/.test(t) &&
      /\b(despesas?|receitas?|lancamentos?|movimentac\w*|gastos?|lanc\w*|registr\w*|adicion\w*|importa\w*|planilha|extrato|arquivo|csv|ofx)\b/.test(t)
        ? 9
        : 0,
  },
  {
    id: 'register_transfer',
    score: (t, s) =>
      /\b(transferi|transferir|transfira|transfere|transferencia|passei|passar|passa|mov[ie]\w*|mandei|manda|enviei|envia)\b/.test(t) && /\b(para|pra|pro)\b/.test(t) && (s.anyAmount || REGISTER_VERB.test(t))
        ? 8
        : /\b(registr\w*|lanc\w*|adicion\w*|nova|fazer uma|criar uma) (uma )?transferencia\b/.test(t)
          ? 8
          : 0,
  },
  {
    id: 'register_expense',
    score: (t, s) => {
      if (/^(quanto|quanta|quantos|quantas|qual|quais|onde|quando|como|ja)\b/.test(t)) return 0
      if (/^(nova|novo|outra|outro|mais uma) (despesa|gasto|compra|saida)\b/.test(t)) return 9
      if (REGISTER_VERB.test(t) && /\b(despesas?|gastos?|saidas?|compras?|conta a pagar|pagamento|boleto)\b/.test(t)) return 8
      if (SPEND_VERB.test(t) && s.anyAmount) return s.question && !s.explicitAmount ? 4 : 8
      if (s.anyAmount && s.hasCategory && !INCOME.test(t) && !s.question) return 6
      if (s.anyAmount && s.hasInstallments) return 7
      return 0
    },
  },
  {
    id: 'register_income',
    score: (t, s) => {
      if (/^(quanto|quanta|quantos|quantas|qual|quais|onde|quando|como|ja)\b/.test(t)) return 0
      if (/^(nova|novo|outra|outro|mais uma) (receita|entrada)\b/.test(t)) return 9
      if (REGISTER_VERB.test(t) && /\b(receitas?|entradas?|renda|ganhos?|recebimento|salario)\b/.test(t) && !/\b(despesas?|gastos?)\b/.test(t)) return 8
      if (EARN_VERB.test(t) && s.anyAmount) return 8.5
      return 0
    },
  },

  // ---- Calculadoras ----
  {
    id: 'calc_percentage',
    score: (t, s) =>
      s.hasPercent && /(%|por cento) (de|sobre) /.test(t) && !/juros/.test(t) && (/\b(quanto (e|da|fica)|calcul\w*)\b/.test(t) || s.words <= 5) ? 9 : 0,
  },
  { id: 'calc_simple', score: (t, s) => (/\bjuros simples\b/.test(t) && (/\b(calcul\w*|quanto|qual|render|rende|pagar|fica)\b/.test(t) || (s.hasPercent && s.anyAmount)) ? 9 : 0) },
  {
    id: 'calc_compound',
    score: (t, s) =>
      (/\bjuros compostos\b/.test(t) && (/\b(calcul\w*|quanto|qual|render|rende|fica)\b/.test(t) || (s.hasPercent && s.anyAmount))) ||
      (/\b(quanto (rende|renderia|vai render|vou ter|teria)|rendendo|aplicando|investindo)\b/.test(t) && s.hasPercent && s.anyAmount)
        ? 9
        : 0,
  },
  {
    id: 'calc_installment',
    score: (t, s) =>
      /\b(parcela|prestacao|financiamento|financiar|emprestimo)\b/.test(t) && /\b(quanto fica|qual (o valor da|seria a|a)|calcul\w*|simul\w*|valor da)\b/.test(t) && s.hasPercent && s.anyAmount
        ? 9
        : 0,
  },
  {
    id: 'calc_goal_time',
    score: (t, s) =>
      /\b(em quanto tempo|quanto tempo|quantos meses|quando (eu )?(vou |consigo )?(juntar|chegar|atingir|alcancar))\b/.test(t) && s.anyAmount && /\b(guardando|juntando|poupando|economizando|separando|por mes|mensal\w*)\b/.test(t)
        ? 9
        : 0,
  },
  {
    id: 'calc_saving_plan',
    score: (t, s) =>
      /\b(quanto (preciso|devo|tenho que|teria que) (guardar|juntar|poupar|economizar|separar|investir))\b/.test(t) && s.anyAmount && (s.hasDuration || s.periods > 0)
        ? 9
        : 0,
  },

  // ---- Consultas ----
  {
    id: 'goal_plan',
    score: (t) => (/\bmetas?\b/.test(t) && /\b(falta|faltam|quanto (preciso|devo|tenho que)|por mes|mensal\w*|guardar|juntar|economizar|poupar|alcancar|atingir|bater)\b/.test(t) ? 8.5 : 0),
  },
  { id: 'goals', score: (t) => (/\b(metas?|objetivos?)\b/.test(t) ? 7 : 0) },
  {
    id: 'budget',
    score: (t) =>
      /\b(orcamentos?|limite de (gasto|gastos|categoria)|limites? (das|por) categorias?|quanto (ainda )?posso gastar|estourei|estourado|estourou|dentro do (limite|orcamento)|passei do limite)\b/.test(t)
        ? 8
        : 0,
  },
  {
    id: 'net_worth_evolution',
    score: (t) => (/\bpatrimon\w*\b/.test(t) && /\b(evolu\w*|historico|cresc\w*|aument\w*|diminu\w*|vari\w*|como (esta|vai|anda)|andamento|ao longo|mes a mes|tendencia)\b/.test(t) ? 9 : 0),
  },
  { id: 'net_worth', score: (t) => (/\b(patrimonio( liquido)?|quanto (eu )?valho|meus bens|tudo (o )?que (eu )?tenho|riqueza)\b/.test(t) ? 8 : 0) },
  {
    id: 'debts',
    score: (t) =>
      /\b(dividas?|financiamentos?|emprestimos?|quanto (eu )?devo|estou devendo|to devendo|passivos?|devendo)\b/.test(t) && !/\b(pagar|vence|vencimento)\b.*\b(hoje|semana|mes)\b/.test(t)
        ? 7.5
        : 0,
  },
  { id: 'biggest_invoice', score: (t) => (/\bfaturas?\b/.test(t) && /\b(maior|mais alta|mais cara|recorde)\b/.test(t) ? 9 : 0) },
  { id: 'card_invoice', score: (t) => (/\bfaturas?\b/.test(t) ? 8 : /\bquanto (esta|ta|deu) (o |no )?cartao\b/.test(t) ? 7 : 0) },
  {
    id: 'card_limit',
    score: (t) =>
      /\b(posso|consigo|da pra) (ainda )?(gastar|usar|comprar)\b.*\bcartao\b/.test(t)
        ? 9
        : /\blimites?\b/.test(t) && (/\b(cartao|cartoes|credito|disponivel|livre|usado)\b/.test(t) || /\b(quanto|qual)\b/.test(t)) && !/\b(orcamento|categorias?|gastos?|gastar)\b/.test(t) ? 8.5 : 0,
  },
  {
    id: 'overdue',
    score: (t) => (/\b(atrasad\w*|vencid\w*|em atraso|esqueci de pagar|nao paguei)\b/.test(t) ? 8.5 : 0),
  },
  {
    id: 'receivables',
    score: (t) => (/\b(a receber|vou receber|tenho (pra|para|a) receber|falta receber|ainda (vou )?receber|receber ainda|previsto (de )?receber)\b/.test(t) ? 8.5 : 0),
  },
  {
    id: 'bills_due',
    score: (t) =>
      /\b(a pagar|preciso pagar|tenho (que|pra|para|de) pagar|devo pagar|falta pagar|vou pagar|vencimentos?|vence|vencem|vencendo|boletos?|contas pendentes|pendencias|pendentes|proximas contas|contas do mes|pagar ate)\b/.test(t)
        ? 8
        : 0,
  },
  {
    id: 'forecast',
    score: (t) =>
      /\b(previsao (do mes|ate|para o|pro|de gastos|de saldo|financeira|do saldo)|projec\w*|vou fechar|como vou (terminar|fechar)|vai sobrar|vou ter no fim|fim do mes .*(sobr|saldo|fechar)|fechar o mes|terminar o mes|no azul ate|vou ficar (no )?(negativo|vermelho)|(tenho|terei) (dinheiro|grana|saldo) (pra|para) pagar|(da|consigo) (pra )?pagar (as|todas as) contas)\b/.test(t)
        ? 8
        : 0,
  },
  {
    id: 'savings',
    score: (t) =>
      /\b(economizei|sobrou|sobra|poupei|guardei|resultado|balanco|lucro|prejuizo|no azul|no vermelho|fechei (o mes )?(positivo|negativo)|positivo|negativo|saldo do mes|quanto (eu )?economizo|taxa de poupanca)\b/.test(t)
        ? 7.5
        : 0,
  },
  {
    id: 'compare',
    score: (t, s) =>
      /\b(compar\w*|versus|vs|em relacao (a|ao)|frente ao|contra o|gastei mais|gastei menos|aument\w*|diminu\w*|cresc\w*|caiu|cairam|subiu|subiram)\b/.test(t) &&
      (EXPENSE.test(t) || INCOME.test(t) || s.periods >= 1 || /\bcompar/.test(t))
        ? 7
        : 0,
  },
  {
    id: 'monthly_evolution',
    score: (t) =>
      /\b(evolu\w*|historico|mes a mes|por mes|cada mes|mensalmente|tendencia|grafico)\b/.test(t) && (EXPENSE.test(t) || INCOME.test(t) || /financ|dinheiro|movimenta/.test(t)) && !/patrimon/.test(t)
        ? 7.5
        : 0,
  },
  {
    id: 'top_category',
    score: (t) =>
      (/\b(categorias?|onde|com o que|com que|em que|no que|com oque)\b/.test(t) && /\b(mais|maior|principal|principais)\b/.test(t) && (EXPENSE.test(t) || /\b(consom\w*|pesa\w*|vai|foi|vao|leva)\b/.test(t))) ||
      /\bcategorias? (que )?mais (consom|pesa|gast)/.test(t)
        ? 8
        : 0,
  },
  {
    id: 'expenses_by_category',
    score: (t) =>
      /\b(por categoria|cada categoria|divisao|dividid\w*|distribu\w*|composic\w*|separad\w* por|todas as categorias|categorias)\b/.test(t) && !/\b(mais|maior)\b/.test(t) ? 7.5 : 0,
  },
  {
    id: 'top_expenses',
    score: (t) =>
      /\b(maior(es)?|mais car[oa]s?|mais alt[oa]s?|top \d+|principais)\b/.test(t) && /\b(despesas?|gastos?|compras?|saidas?|pagamentos?)\b/.test(t) && !/categoria/.test(t) ? 8 : 0,
  },
  {
    id: 'recent',
    score: (t) =>
      /\b(ultim[oa]s? (movimentac\w*|lancamentos?|transac\w*|gastos?|despesas?|compras?|registros?)|extrato|o que (eu )?lancei|movimentac\w* recentes?|lancamentos recentes|historico de (movimentac|lancamento))\b/.test(t)
        ? 7.5
        : 0,
  },
  { id: 'tx_count', score: (t) => (/\bquant[oa]s (movimentac\w*|compras?|despesas?|receitas?|transac\w*|lancamentos?|vezes|gastos?)\b/.test(t) ? 7.5 : 0) },
  {
    id: 'average',
    score: (t) => (/\b(media|medio|em media|por dia|diari\w*|por semana|semanal\w*)\b/.test(t) && (EXPENSE.test(t) || INCOME.test(t)) ? (/\b(media|medio)\b/.test(t) ? 8 : 7.5) : 0),
  },
  {
    id: 'emergency_reserve',
    score: (t) => (/\breserva( de emergencia)?\b/.test(t) && /\b(quanto|qual|tamanho|deveria|devo|preciso|ideal|minha)\b/.test(t) ? 8 : 0),
  },
  {
    id: 'accounts_list',
    score: (t) =>
      /\b(contas bancarias|cada conta|por conta|minhas contas|meus bancos|em (cada|todas as) contas?|saldo das contas|saldos|quais contas (eu )?tenho|em contas)\b/.test(t) ? 7.5 : 0,
  },
  {
    id: 'balance',
    score: (t) =>
      /\b(saldo|quanto (eu )?tenho|quanto dinheiro|quanta grana|disponivel|tenho de dinheiro|dinheiro em conta|quanto (ainda )?resta|quanto tem na|quanto tem no|quanto ta na|quanto ta no|quanto esta na|quanto esta no)\b/.test(t) && !/\bsaldo do mes\b/.test(t)
        ? 7
        : 0,
  },
  {
    id: 'income_total',
    score: (t, s) =>
      /\bsalario\b.*\b(caiu|entrou|veio|chegou|pingou)\b/.test(t) && s.question ? 7 : INCOME.test(t) && (ASK.test(t) || s.question || s.words <= 4) ? 6 : 0,
  },
  {
    id: 'expenses_total',
    score: (t, s) =>
      EXPENSE.test(t) && (ASK.test(t) || s.question || s.words <= 4)
        ? 6
        : s.hasCategory && /\b(quanto|qual|total)\b/.test(t) && !s.explicitAmount
          ? 5
          : 0,
  },
  {
    id: 'navigate',
    score: (t) =>
      /\b(abr\w*|ir (para|pra|pro|ao|a)|vai (para|pra)|leva\w* (para|pra|ao|a)|acess\w*|mostr\w* a (pagina|tela)|onde (fica|encontro|vejo))\b/.test(t) &&
      /\b(movimentac\w*|contas|cartoes|planejamento|patrimonio|relatorios?|configurac\w*|ajustes|inicio|dashboard|painel|categorias|perfil|espacos)\b/.test(t)
        ? 8.5
        : 0,
  },
  {
    id: 'knowledge',
    score: (t) =>
      /^(o que (e|eh|sao|significa)|oq e|como funciona|como funcionam|qual (a )?diferenca entre|diferenca entre|para que serve|pra que serve)\b/.test(t)
        ? 8.5
        : /^(como (fazer|faco|montar|monto|organizar|organizo|sair|saio|controlar|controlo|economizar|economizo|calcular|calculo|comecar|comeco|investir|invisto|quitar|quito|negociar|negocio|planejar|planejo|criar|crio|juntar|separar|dividir|evitar|usar|uso|definir|defino|ter|guardar|poupar|aumentar|reduzir|cortar|parar)|explic\w*|me explica|vale a pena|dicas?|quero (aprender|entender|saber sobre)|por que|porque|o que fazer|e melhor)\b/.test(t)
          ? 8.2
          : /\b(o que (e|eh|sao|significa)|como funciona|diferenca entre|para que serve|pra que serve)\b/.test(t)
            ? 6
            : 0,
  },
]

/** Vocabulário para corrigir erros de digitação (só palavras-chave das regras). */
export const VOCABULARY = new Set(
  (
    'quanto quanta quantos quantas qual quais gastei gastos despesa despesas receita receitas recebi saldo disponivel ' +
    'contas cartao cartoes fatura faturas limite orcamento orcamentos metas objetivo patrimonio dividas financiamento ' +
    'emprestimo compare comparar comparacao diferenca evolucao historico categoria categorias alimentacao transporte ' +
    'moradia educacao lazer compras supermercado mercado combustivel gasolina estacionamento farmacia restaurante salario ' +
    'transferencia transferir transferi registrar registre adicionar adicione lancar lance economizei sobrou previsao ' +
    'vencimento vencidas atrasadas pagar receber movimentacoes lancamentos relatorios planejamento configuracoes ' +
    'reserva emergencia juros compostos simples parcela parcelas parcelado inflacao rentabilidade liquidez diversificacao ' +
    'investimento investimentos tesouro poupanca setembro outubro novembro dezembro janeiro fevereiro marco abril maio ' +
    'junho julho agosto semana passado passada ultimos proximos obrigado ajuda historico mostrar maiores maior'
  ).split(' '),
)

export type Ranked = Array<{ id: IntentId; score: number }>

/** Pontua todas as regras e devolve as intenções com pontuação, da maior para a menor. */
export function rankIntents(text: string, signals: Signals): Ranked {
  const corrected = correctTypos(text, VOCABULARY)
  const out: Ranked = []
  for (const rule of RULES) {
    const score = rule.score(text, signals)
    if (score > 0) out.push({ id: rule.id, score })
    // Texto com correção de digitação vale um pouco menos que o original.
    if (corrected !== text) {
      const fixed = rule.score(corrected, signals) - 0.5
      if (fixed > 0) out.push({ id: rule.id, score: fixed })
    }
  }
  // Mantém a maior pontuação de cada intenção.
  const best = new Map<IntentId, number>()
  for (const r of out) best.set(r.id, Math.max(best.get(r.id) ?? 0, r.score))
  return [...best].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score)
}

/** Pares de intenções que, empatadas, pedem esclarecimento em vez de escolha automática. */
const CONFLICTS: Array<[IntentId, IntentId]> = [
  ['card_invoice', 'card_limit'],
  ['balance', 'savings'],
  ['bills_due', 'debts'],
  ['expenses_total', 'income_total'],
  ['register_expense', 'register_income'],
  ['accounts_list', 'bills_due'],
]

export function isConflict(a: IntentId, b: IntentId): boolean {
  return CONFLICTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** Lista de intenções com regras próprias (para o relatório de entrega). */
export function intentCount(): number {
  return new Set(RULES.map((r) => r.id)).size
}
