import { normalizeText } from '../normalize'

/*
  Base de conhecimento do Assistente Financeiro — índice.
  Aqui ficam só os metadados usados na busca (leves). O conteúdo de cada categoria está num arquivo próprio
  e é carregado sob demanda (import dinâmico) quando um artigo é aberto.

  Regras editoriais:
  - Conteúdo educativo e geral; não é recomendação individual.
  - Nenhuma taxa atual, alíquota, limite legal ou regra tributária é citada como valor. Quando o tema depende
    disso, o artigo é marcado com `needsUpdate` e aponta para a fonte oficial.
  - Exemplos numéricos são sempre identificados como ilustrativos.
*/

export type KnowledgeCategory = 'organizacao' | 'planejamento' | 'endividamento' | 'investimentos' | 'educacao'

export const CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  organizacao: 'Organização financeira',
  planejamento: 'Planejamento',
  endividamento: 'Endividamento',
  investimentos: 'Investimentos',
  educacao: 'Educação financeira',
}

export type ArticleMeta = {
  id: string
  title: string
  category: KnowledgeCategory
  /** Termos que identificam o assunto (normalizados: minúsculos, sem acento). */
  keywords: string[]
  /** Outras formas de falar do mesmo assunto. */
  synonyms: string[]
  related: string[]
  /** Data da última revisão do conteúdo (AAAA-MM-DD). */
  reviewedAt: string
}

export type Article = ArticleMeta & {
  summary: string
  details: string[]
  examples: string[]
  relatedQuestions: string[]
  references: Array<{ label: string; url: string }>
  /** Conteúdo que depende de regras ou taxas que mudam: a resposta mostra um aviso. */
  needsUpdate?: string
}

export type ArticleContent = Omit<Article, keyof ArticleMeta>

const R = '2026-10-14'

export const ARTICLES: ArticleMeta[] = [
  // Organização financeira
  { id: 'controle-receitas', title: 'Controle de receitas', category: 'organizacao', keywords: ['controle de receitas', 'controlar receitas', 'registrar receitas'], synonyms: ['controlar o que entra', 'controle de entradas', 'acompanhar renda'], related: ['controle-despesas', 'fluxo-de-caixa'], reviewedAt: R },
  { id: 'controle-despesas', title: 'Controle de despesas', category: 'organizacao', keywords: ['controle de despesas', 'controlar despesas', 'controlar gastos', 'controle de gastos'], synonyms: ['anotar gastos', 'acompanhar gastos', 'saber para onde vai o dinheiro', 'parar de gastar'], related: ['gastos-fixos', 'gastos-variaveis', 'orcamento-domestico'], reviewedAt: R },
  { id: 'planejamento-mensal', title: 'Planejamento mensal', category: 'organizacao', keywords: ['planejamento mensal', 'planejar o mes', 'planejar mes'], synonyms: ['organizar o mes', 'planejar o salario', 'organizar as contas do mes'], related: ['orcamento-domestico', 'fluxo-de-caixa'], reviewedAt: R },
  { id: 'fluxo-de-caixa', title: 'Fluxo de caixa', category: 'organizacao', keywords: ['fluxo de caixa'], synonyms: ['entradas e saidas', 'caixa pessoal', 'dinheiro entrando e saindo'], related: ['planejamento-mensal', 'controle-receitas'], reviewedAt: R },
  { id: 'orcamento-domestico', title: 'Orçamento doméstico', category: 'organizacao', keywords: ['orcamento domestico', 'orcamento familiar', 'orcamento pessoal', 'montar orcamento', 'fazer orcamento'], synonyms: ['regra 50 30 20', '50 30 20', 'dividir o salario', 'organizar o orcamento'], related: ['despesas-essenciais', 'planejamento-mensal'], reviewedAt: R },
  { id: 'gastos-fixos', title: 'Gastos fixos', category: 'organizacao', keywords: ['gastos fixos', 'despesas fixas', 'custo fixo', 'custos fixos'], synonyms: ['contas fixas', 'contas que se repetem'], related: ['gastos-variaveis', 'controle-assinaturas'], reviewedAt: R },
  { id: 'gastos-variaveis', title: 'Gastos variáveis', category: 'organizacao', keywords: ['gastos variaveis', 'despesas variaveis', 'custos variaveis'], synonyms: ['gastos que mudam', 'gastos do dia a dia'], related: ['gastos-fixos', 'estrategias-economia'], reviewedAt: R },
  { id: 'despesas-essenciais', title: 'Despesas essenciais', category: 'organizacao', keywords: ['despesas essenciais', 'gastos essenciais', 'necessidades basicas'], synonyms: ['o que e essencial', 'gastos obrigatorios', 'custo de vida'], related: ['despesas-nao-essenciais', 'reserva-emergencia'], reviewedAt: R },
  { id: 'despesas-nao-essenciais', title: 'Despesas não essenciais', category: 'organizacao', keywords: ['despesas nao essenciais', 'gastos nao essenciais', 'gastos superfluos', 'superfluos', 'superfluo'], synonyms: ['gastos desnecessarios', 'luxos', 'desejos'], related: ['despesas-essenciais', 'consumo-consciente'], reviewedAt: R },
  { id: 'controle-assinaturas', title: 'Controle de assinaturas', category: 'organizacao', keywords: ['assinaturas', 'controle de assinaturas', 'streaming'], synonyms: ['servicos recorrentes', 'cobrancas recorrentes', 'cancelar assinaturas'], related: ['gastos-fixos', 'estrategias-economia'], reviewedAt: R },
  { id: 'planejamento-anual', title: 'Planejamento anual', category: 'organizacao', keywords: ['planejamento anual', 'planejar o ano', 'despesas anuais', 'gastos anuais'], synonyms: ['ipva iptu matricula', 'contas de inicio de ano', 'decimo terceiro'], related: ['grandes-despesas', 'metas-financeiras'], reviewedAt: R },

  // Planejamento
  { id: 'metas-financeiras', title: 'Metas financeiras', category: 'planejamento', keywords: ['metas financeiras', 'meta financeira', 'definir metas', 'criar meta'], synonyms: ['objetivos financeiros', 'metas smart', 'como juntar dinheiro'], related: ['planejamento-compras', 'reserva-emergencia'], reviewedAt: R },
  { id: 'reserva-emergencia', title: 'Reserva de emergência', category: 'planejamento', keywords: ['reserva de emergencia', 'fundo de emergencia', 'colchao financeiro'], synonyms: ['dinheiro para imprevistos', 'reserva', 'fundo de reserva'], related: ['liquidez', 'despesas-essenciais'], reviewedAt: R },
  { id: 'planejamento-compras', title: 'Planejamento de compras', category: 'planejamento', keywords: ['planejamento de compras', 'planejar compra', 'comprar a vista ou parcelado', 'a vista ou parcelado'], synonyms: ['vale a pena parcelar', 'desconto a vista', 'compra planejada'], related: ['parcelamentos', 'metas-financeiras'], reviewedAt: R },
  { id: 'planejamento-familiar', title: 'Planejamento financeiro familiar', category: 'planejamento', keywords: ['planejamento familiar', 'financas da familia', 'orcamento da familia'], synonyms: ['filhos e dinheiro', 'mesada', 'educacao financeira para filhos'], related: ['financas-casal', 'orcamento-domestico'], reviewedAt: R },
  { id: 'financas-casal', title: 'Organização financeira do casal', category: 'planejamento', keywords: ['financas do casal', 'dinheiro no casamento', 'casal', 'dividir contas'], synonyms: ['conta conjunta', 'dividir despesas com parceiro', 'dinheiro a dois'], related: ['planejamento-familiar', 'metas-financeiras'], reviewedAt: R },
  { id: 'planejamento-viagens', title: 'Planejamento de viagens', category: 'planejamento', keywords: ['planejar viagem', 'planejamento de viagem', 'juntar para viagem', 'viagem'], synonyms: ['ferias', 'custos de viagem'], related: ['metas-financeiras', 'grandes-despesas'], reviewedAt: R },
  { id: 'grandes-despesas', title: 'Planejamento de grandes despesas', category: 'planejamento', keywords: ['grandes despesas', 'compra grande', 'comprar carro', 'comprar casa', 'entrada do imovel'], synonyms: ['casamento', 'reforma', 'troca de carro'], related: ['metas-financeiras', 'financiamentos'], reviewedAt: R },
  { id: 'estrategias-economia', title: 'Estratégias de economia', category: 'planejamento', keywords: ['economizar', 'economia', 'estrategias de economia', 'gastar menos', 'cortar gastos', 'reduzir gastos'], synonyms: ['sobrar dinheiro', 'poupar mais', 'apertar o cinto'], related: ['gastos-variaveis', 'consumo-consciente'], reviewedAt: R },

  // Endividamento
  { id: 'juros-simples', title: 'Juros simples', category: 'endividamento', keywords: ['juros simples'], synonyms: ['juro simples', 'calculo de juros simples'], related: ['juros-compostos'], reviewedAt: R },
  { id: 'juros-compostos', title: 'Juros compostos', category: 'endividamento', keywords: ['juros compostos', 'juros sobre juros'], synonyms: ['juro composto', 'efeito bola de neve'], related: ['juros-simples', 'rentabilidade'], reviewedAt: R },
  { id: 'dividas', title: 'Dívidas', category: 'endividamento', keywords: ['dividas', 'divida', 'sair das dividas', 'endividado', 'endividamento', 'quitar dividas'], synonyms: ['nome sujo', 'estou devendo', 'inadimplencia'], related: ['renegociacao', 'credito-rotativo'], reviewedAt: R },
  { id: 'financiamentos', title: 'Financiamentos', category: 'endividamento', keywords: ['financiamento', 'financiamentos', 'financiar'], synonyms: ['financiamento imobiliario', 'financiamento de carro', 'tabela price', 'sac'], related: ['amortizacao', 'cet'], reviewedAt: R },
  { id: 'emprestimos', title: 'Empréstimos', category: 'endividamento', keywords: ['emprestimo', 'emprestimos', 'credito pessoal', 'consignado'], synonyms: ['pegar dinheiro emprestado', 'pedir emprestimo'], related: ['cet', 'dividas'], reviewedAt: R },
  { id: 'cartao-credito', title: 'Cartão de crédito', category: 'endividamento', keywords: ['cartao de credito', 'usar o cartao', 'fatura do cartao', 'melhor dia de compra', 'fechamento da fatura'], synonyms: ['cartao', 'limite do cartao', 'anuidade'], related: ['credito-rotativo', 'parcelamentos'], reviewedAt: R },
  { id: 'credito-rotativo', title: 'Crédito rotativo', category: 'endividamento', keywords: ['rotativo', 'credito rotativo', 'pagamento minimo', 'pagar o minimo'], synonyms: ['nao paguei a fatura toda', 'pagar parte da fatura'], related: ['cartao-credito', 'dividas'], reviewedAt: R },
  { id: 'parcelamentos', title: 'Parcelamentos', category: 'endividamento', keywords: ['parcelamento', 'parcelamentos', 'parcelar', 'compras parceladas', 'parcelado sem juros'], synonyms: ['comprar parcelado', 'muitas parcelas'], related: ['planejamento-compras', 'cartao-credito'], reviewedAt: R },
  { id: 'amortizacao', title: 'Amortização', category: 'endividamento', keywords: ['amortizacao', 'amortizar', 'antecipar parcelas', 'quitar antes'], synonyms: ['reduzir prazo', 'reduzir parcela', 'pagar adiantado'], related: ['financiamentos', 'juros-compostos'], reviewedAt: R },
  { id: 'renegociacao', title: 'Renegociação de dívidas', category: 'endividamento', keywords: ['renegociar', 'renegociacao', 'negociar divida', 'acordo de divida'], synonyms: ['limpar o nome', 'feirao de negociacao', 'proposta de acordo'], related: ['dividas', 'cet'], reviewedAt: R },
  { id: 'cet', title: 'Custo Efetivo Total (CET)', category: 'endividamento', keywords: ['cet', 'custo efetivo total'], synonyms: ['custo real do emprestimo', 'taxas e tarifas do credito'], related: ['emprestimos', 'financiamentos'], reviewedAt: R },

  // Investimentos
  { id: 'renda-fixa', title: 'Renda fixa', category: 'investimentos', keywords: ['renda fixa'], synonyms: ['investimento seguro', 'lci', 'lca', 'debentures', 'pre fixado', 'pos fixado'], related: ['cdb', 'tesouro-direto'], reviewedAt: R },
  { id: 'renda-variavel', title: 'Renda variável', category: 'investimentos', keywords: ['renda variavel', 'acoes', 'bolsa de valores', 'fiis', 'fundos imobiliarios'], synonyms: ['investir em acoes', 'bolsa'], related: ['risco', 'diversificacao'], reviewedAt: R },
  { id: 'cdb', title: 'CDB', category: 'investimentos', keywords: ['cdb', 'certificado de deposito bancario'], synonyms: ['cdb de banco', 'cdb liquidez diaria'], related: ['renda-fixa', 'liquidez'], reviewedAt: R },
  { id: 'tesouro-direto', title: 'Tesouro Direto', category: 'investimentos', keywords: ['tesouro direto', 'tesouro selic', 'tesouro ipca', 'tesouro prefixado', 'titulos publicos'], synonyms: ['tesouro', 'titulo do governo'], related: ['renda-fixa', 'inflacao'], reviewedAt: R },
  { id: 'fundos', title: 'Fundos de investimento', category: 'investimentos', keywords: ['fundos de investimento', 'fundo de investimento', 'fundos'], synonyms: ['taxa de administracao', 'gestor', 'cotas'], related: ['diversificacao', 'rentabilidade'], reviewedAt: R },
  { id: 'liquidez', title: 'Liquidez', category: 'investimentos', keywords: ['liquidez', 'liquidez diaria', 'resgate'], synonyms: ['sacar a qualquer momento', 'tirar o dinheiro rapido'], related: ['reserva-emergencia', 'cdb'], reviewedAt: R },
  { id: 'rentabilidade', title: 'Rentabilidade', category: 'investimentos', keywords: ['rentabilidade', 'rendimento', 'quanto rende', 'retorno'], synonyms: ['ganho real', 'rentabilidade liquida', 'rentabilidade bruta'], related: ['inflacao', 'juros-compostos'], reviewedAt: R },
  { id: 'inflacao', title: 'Inflação', category: 'investimentos', keywords: ['inflacao', 'ipca', 'poder de compra'], synonyms: ['precos subindo', 'custo de vida aumentando'], related: ['rentabilidade', 'tesouro-direto'], reviewedAt: R },
  { id: 'risco', title: 'Risco nos investimentos', category: 'investimentos', keywords: ['risco', 'riscos', 'perfil de investidor', 'suitability', 'perfil de risco'], synonyms: ['volatilidade', 'perder dinheiro investindo'], related: ['diversificacao', 'renda-variavel'], reviewedAt: R },
  { id: 'diversificacao', title: 'Diversificação', category: 'investimentos', keywords: ['diversificacao', 'diversificar', 'carteira de investimentos'], synonyms: ['nao colocar todos os ovos na mesma cesta', 'distribuir investimentos'], related: ['risco', 'fundos'], reviewedAt: R },
  { id: 'patrimonio-liquido', title: 'Patrimônio líquido', category: 'investimentos', keywords: ['patrimonio liquido', 'o que e patrimonio', 'calcular patrimonio'], synonyms: ['bens menos dividas', 'riqueza liquida'], related: ['organizacao-patrimonial', 'dividas'], reviewedAt: R },

  // Educação financeira
  { id: 'conceitos-basicos', title: 'Conceitos básicos de finanças pessoais', category: 'educacao', keywords: ['conceitos basicos', 'financas pessoais', 'educacao financeira', 'comecar a organizar'], synonyms: ['por onde comecar', 'iniciante', 'primeiros passos'], related: ['controle-despesas', 'orcamento-domestico'], reviewedAt: R },
  { id: 'indicadores-financeiros', title: 'Indicadores financeiros pessoais', category: 'educacao', keywords: ['indicadores financeiros', 'taxa de poupanca', 'comprometimento de renda', 'indicadores'], synonyms: ['saude financeira', 'como saber se estou bem'], related: ['patrimonio-liquido', 'fluxo-de-caixa'], reviewedAt: R },
  { id: 'consumo-consciente', title: 'Consumo consciente', category: 'educacao', keywords: ['consumo consciente', 'compras por impulso', 'compra por impulso', 'consumismo'], synonyms: ['comprar menos', 'evitar compras desnecessarias'], related: ['despesas-nao-essenciais', 'habitos-financeiros'], reviewedAt: R },
  { id: 'habitos-financeiros', title: 'Hábitos financeiros', category: 'educacao', keywords: ['habitos financeiros', 'habito', 'disciplina financeira', 'rotina financeira'], synonyms: ['manter o controle', 'constancia'], related: ['consumo-consciente', 'metas-financeiras'], reviewedAt: R },
  { id: 'longo-prazo', title: 'Planejamento de longo prazo', category: 'educacao', keywords: ['longo prazo', 'aposentadoria', 'previdencia', 'independencia financeira'], synonyms: ['futuro', 'viver de renda', 'previdencia privada'], related: ['juros-compostos', 'inflacao'], reviewedAt: R },
  { id: 'organizacao-patrimonial', title: 'Organização patrimonial', category: 'educacao', keywords: ['organizacao patrimonial', 'organizar patrimonio', 'bens', 'documentos financeiros'], synonyms: ['controlar bens', 'inventario de bens'], related: ['patrimonio-liquido', 'longo-prazo'], reviewedAt: R },
]

const ARTICLE_BY_ID = new Map(ARTICLES.map((a) => [a.id, a]))

export function articleMeta(id: string): ArticleMeta | undefined {
  return ARTICLE_BY_ID.get(id)
}

/** Carrega o conteúdo da categoria só quando um artigo dela é aberto. */
const LOADERS: Record<KnowledgeCategory, () => Promise<{ default: Record<string, ArticleContent> }>> = {
  organizacao: () => import('./organizacao'),
  planejamento: () => import('./planejamento'),
  endividamento: () => import('./endividamento'),
  investimentos: () => import('./investimentos'),
  educacao: () => import('./educacao'),
}

export async function loadArticle(id: string): Promise<Article | null> {
  const meta = ARTICLE_BY_ID.get(id)
  if (!meta) return null
  const mod = await LOADERS[meta.category]()
  const content = mod.default[id]
  return content ? { ...meta, ...content } : null
}

const STOP = new Set('o a os as um uma de do da dos das e que como para pra por em no na nos nas eu meu minha me se com sobre qual quais e funciona'.split(' '))

/**
 * Busca artigos por palavras-chave e sinônimos. Frase inteira vale mais; palavras soltas valem menos.
 * Devolve só resultados com pontuação mínima — sem chute.
 */
export function searchArticles(text: string, limit = 3): Array<{ id: string; score: number }> {
  const t = ` ${normalizeText(text)} `
  const words = new Set(t.trim().split(' ').filter((w) => w.length > 2 && !STOP.has(w)))
  const scored: Array<{ id: string; score: number }> = []
  for (const a of ARTICLES) {
    let score = 0
    for (const k of a.keywords) if (t.includes(` ${k} `)) score = Math.max(score, 10 + k.split(' ').length)
    for (const s of a.synonyms) if (t.includes(` ${s} `)) score = Math.max(score, 8 + s.split(' ').length)
    if (score === 0) {
      // Palavras do título ajudam quando a frase não bate exatamente.
      const titleWords = normalizeText(a.title).split(' ').filter((w) => w.length > 3 && !STOP.has(w))
      const hits = titleWords.filter((w) => words.has(w)).length
      if (hits > 0 && hits === titleWords.length) score = 6 + hits
    }
    if (score > 0) scored.push({ id: a.id, score })
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, limit)
}
