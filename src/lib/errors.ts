type ErrorLike = { message?: string; code?: string; status?: number } | null | undefined

const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Procure a mensagem do CashBot na sua caixa de entrada.'],
  [/user already registered|already been registered/i, 'Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.'],
  [/password should be at least (\d+)/i, 'A senha precisa ter pelo menos $1 caracteres.'],
  [/new password should be different/i, 'A nova senha precisa ser diferente da atual.'],
  [/unable to validate email address|invalid email/i, 'Informe um e-mail válido.'],
  [/rate limit|too many requests|security purposes/i, 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.'],
  [/auth session missing|jwt expired|invalid jwt/i, 'Sua sessão expirou. Entre novamente.'],
  [/failed to fetch|networkerror|load failed/i, 'Não foi possível conectar. Verifique sua internet e tente de novo.'],
]

// Mensagens das funções e gatilhos do banco já são escritas em português.
const PORTUGUESE = /[áéíóúãõçê]|você|não|espaço|membro|proprietário|papel/i

/**
 * Converte erros do Supabase (Auth e Postgres) em mensagens claras em português.
 * Mensagens que já vêm em português das funções do banco são mantidas.
 */
export function toUserMessage(error: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  const err = (typeof error === 'object' ? error : { message: String(error ?? '') }) as ErrorLike
  const message = err?.message?.trim() ?? ''

  if (err?.code === '42501' && /row-level security|permission denied/i.test(message)) {
    return 'Você não tem permissão para fazer isso neste espaço.'
  }
  if (err?.code === '23505' && /duplicate key|unique/i.test(message)) {
    return 'Já existe um item com esse nome.'
  }
  if (err?.code === '23514' && !PORTUGUESE.test(message)) {
    return 'Algum valor informado não é válido. Revise os campos.'
  }

  for (const [pattern, text] of AUTH_MESSAGES) {
    const match = message.match(pattern)
    if (match) return text.replace('$1', match[1] ?? '')
  }

  if (message && PORTUGUESE.test(message)) {
    return message
  }

  return fallback
}
