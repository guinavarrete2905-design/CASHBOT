import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toUserMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AuthLayout, Field } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setSubmitting(false)
    if (resetError) {
      setError(toUserMessage(resetError))
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle={sent ? undefined : 'Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.'}
      footer={
        <Link to="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
          Voltar para entrar
        </Link>
      }
    >
      {sent ? (
        <div className="flex gap-3 rounded-lg border bg-surface p-4 text-sm" role="status">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
          <p>
            Se existir uma conta com <strong className="font-medium">{email.trim()}</strong>, você vai receber o link
            em alguns minutos. Confira também a caixa de spam.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
          <FormError message={error} />
          <Field id="email" label="E-mail">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" loading={submitting} disabled={!email}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
