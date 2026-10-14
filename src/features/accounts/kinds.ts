export function toKindSafe(kind: string): 'income' | 'expense' | 'transfer' {
  return kind === 'income' || kind === 'transfer' ? kind : 'expense'
}
