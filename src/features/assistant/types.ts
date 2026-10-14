import type { Period } from './parse'

/*
  Tipos compartilhados do Assistente Financeiro.
  O motor (engine.ts) é puro: recebe a mensagem, o contexto e uma fonte de dados, e devolve a resposta.
  A interface só desenha a resposta e executa as ações confirmadas pelo usuário.
*/

export type Tone = 'positive' | 'negative' | 'muted'

export type Block =
  | { type: 'text'; text: string }
  | { type: 'facts'; items: Array<{ label: string; value: string; tone?: Tone }> }
  | { type: 'list'; items: string[] }
  /** Observação discreta: limitações, origem do dado, aviso de conteúdo que depende de atualização. */
  | { type: 'note'; text: string }

export type Link = { label: string; to: string }

/** Botão que envia uma mensagem pronta (esclarecimento de ambiguidade, sugestões). */
export type Choice = { label: string; message: string }

export type TxKind = 'expense' | 'income' | 'transfer'

/** Lançamento preparado pelo assistente e mostrado para confirmação. */
export type Draft = {
  /** Identificador único: vira o external_ref do lançamento e impede gravar duas vezes. */
  id: string
  kind: TxKind
  description: string
  amount: number
  occurredOn: string
  categoryId: string | null
  categoryName: string | null
  accountId: string | null
  accountName: string | null
  onCard: boolean
  transferAccountId: string | null
  transferAccountName: string | null
  status: 'paid' | 'pending'
  /** Compra parcelada (parcelas) ou lançamento que se repete todo mês (ocorrências). */
  series: { kind: 'installment' | 'recurring'; count: number } | null
  spaceName: string
}

export type Effect =
  | { type: 'confirm'; draftIds: string[] }
  | { type: 'cancel'; draftIds: string[] }
  | { type: 'clear-history' }

export type Reply = {
  intent: IntentId
  blocks: Block[]
  links?: Link[]
  choices?: Choice[]
  suggestions?: string[]
  drafts?: Draft[]
  /** Ação para a interface executar (sempre a partir de um pedido explícito do usuário). */
  effect?: Effect
}

// ---------------------------------------------------------------------------
// Contexto da conversa
// ---------------------------------------------------------------------------

export type Metric = 'expense' | 'income' | 'net'

/** Último resultado numérico, para "E em outubro?" e "Qual a diferença?". */
export type ResultMemo = {
  intent: IntentId
  metric: Metric
  period: Period
  value: number
  categoryId: string | null
  categoryName: string | null
  accountId: string | null
  accountName: string | null
}

export type Awaiting =
  | { slot: 'amount'; draft: Draft }
  | { slot: 'description'; draft: Draft }
  | { slot: 'account'; draft: Draft; options: Array<{ id: string; name: string; onCard: boolean }> }
  | { slot: 'transfer-from'; draft: Draft; options: Array<{ id: string; name: string }> }
  | { slot: 'transfer-to'; draft: Draft; options: Array<{ id: string; name: string }> }

export type ConversationContext = {
  lastIntent: IntentId | null
  last: ResultMemo | null
  previous: ResultMemo | null
  /** Lançamentos mostrados e ainda não confirmados nem cancelados. */
  pendingDrafts: Draft[]
  awaiting: Awaiting | null
  turns: number
}

export const EMPTY_CONTEXT: ConversationContext = {
  lastIntent: null,
  last: null,
  previous: null,
  pendingDrafts: [],
  awaiting: null,
  turns: 0,
}

// ---------------------------------------------------------------------------
// Dados que o motor consulta
// ---------------------------------------------------------------------------

export type AccountData = {
  id: string
  name: string
  type: string
  balance: number
  archived: boolean
  creditLimit: number | null
  closingDay: number | null
  dueDay: number | null
}

export type CategoryData = { id: string; name: string; kind: 'expense' | 'income'; archived: boolean }

export type PeriodSummary = { income: number; expense: number; pendingIncome: number; pendingExpense: number; count: number }

export type CategoryTotal = { categoryId: string | null; name: string | null; total: number; count: number }

export type ExpenseItem = {
  id: string
  description: string
  amount: number
  occurredOn: string
  status: 'paid' | 'pending'
  categoryName: string | null
  accountName: string | null
}

export type PendingItem = {
  id: string
  kind: TxKind
  description: string
  amount: number
  occurredOn: string
  accountId: string | null
}

export type CardMovementData = { kind: TxKind; amount: number; occurred_on: string; account_id: string | null }

export type BudgetData = { categoryId: string; amount: number }
export type GoalData = { id: string; name: string; target: number; saved: number; targetDate: string | null; archived: boolean }
export type AssetData = { name: string; type: string; value: number; archived: boolean }
export type LiabilityData = { name: string; type: string; balance: number; monthlyPayment: number | null; archived: boolean }
export type SnapshotData = { month: string; netWorth: number; accounts: number; assets: number; liabilities: number }

/**
 * Consultas autorizadas que o assistente pode fazer. A implementação real (queries.ts) usa o Supabase
 * com a sessão do usuário, então as políticas RLS sempre se aplicam. Nos testes, usamos dados falsos.
 */
export interface DataSource {
  today: string
  space: { id: string; name: string; type: string }
  categories(): Promise<CategoryData[]>
  accounts(): Promise<AccountData[]>
  periodSummary(p: { from: string; to: string; accountId?: string | null; categoryId?: string | null }): Promise<PeriodSummary>
  expensesByCategory(from: string, to: string): Promise<CategoryTotal[]>
  topExpenses(from: string, to: string, limit: number, categoryId?: string | null): Promise<ExpenseItem[]>
  monthlyTotals(from: string, to: string): Promise<Array<{ month: string; income: number; expense: number }>>
  pendingUntil(untilISO: string): Promise<PendingItem[]>
  cardMovements(cardIds: string[], fromISO: string): Promise<CardMovementData[]>
  recent(limit: number): Promise<ExpenseItem[]>
  budgets(): Promise<BudgetData[]>
  goals(): Promise<GoalData[]>
  assets(): Promise<AssetData[]>
  liabilities(): Promise<LiabilityData[]>
  snapshots(): Promise<SnapshotData[]>
  /** Gera um identificador único para lançamentos. */
  newId(): string
}

export type IntentId =
  | 'expenses_total'
  | 'income_total'
  | 'balance'
  | 'accounts_list'
  | 'top_category'
  | 'expenses_by_category'
  | 'top_expenses'
  | 'bills_due'
  | 'receivables'
  | 'overdue'
  | 'compare'
  | 'monthly_evolution'
  | 'savings'
  | 'forecast'
  | 'card_invoice'
  | 'biggest_invoice'
  | 'card_limit'
  | 'budget'
  | 'goals'
  | 'goal_plan'
  | 'net_worth'
  | 'net_worth_evolution'
  | 'debts'
  | 'recent'
  | 'tx_count'
  | 'average'
  | 'emergency_reserve'
  | 'calc_compound'
  | 'calc_simple'
  | 'calc_percentage'
  | 'calc_installment'
  | 'calc_saving_plan'
  | 'calc_goal_time'
  | 'register_expense'
  | 'register_income'
  | 'register_transfer'
  | 'bulk_entry'
  | 'confirm'
  | 'cancel'
  | 'greeting'
  | 'thanks'
  | 'help'
  | 'identity'
  | 'knowledge'
  | 'navigate'
  | 'clear_history'
  | 'current_rates'
  | 'tax_legal'
  | 'investment_advice'
  | 'permissions'
  | 'edit_delete'
  | 'followup_period'
  | 'followup_filter'
  | 'difference'
  | 'clarify'
  | 'slot_answer'
  | 'unknown'
