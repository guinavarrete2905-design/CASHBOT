import { Logo } from '@/components/layout/Logo'

/** Mostrada quando as variáveis do Supabase não foram configuradas no ambiente. */
export function ConfigMissingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Configuração pendente</h1>
        <p className="text-sm text-muted-foreground">
          O CashBot não encontrou os dados de conexão com o Supabase. Defina as variáveis abaixo no arquivo{' '}
          <code className="rounded bg-muted px-1 py-0.5">.env.local</code> (desenvolvimento) ou nas variáveis de
          ambiente da hospedagem, e gere a aplicação novamente.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-surface p-3 text-xs">
          {'VITE_SUPABASE_URL\nVITE_SUPABASE_PUBLISHABLE_KEY'}
        </pre>
        <p className="text-sm text-muted-foreground">Use apenas a chave pública (publishable). Nunca a service_role.</p>
      </div>
    </div>
  )
}
