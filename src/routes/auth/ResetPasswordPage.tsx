import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FormError, FullScreenLoader } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toUserMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { AuthLayout, Field } from './AuthLayout'
import { MIN_PASSWORD_LENGTH } from './SignupPage'

/** Página aberta pelo link de recuperação enviado por e-mail. */
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullScreenLoader />

  if (!session) {
    return (
      <AuthLayout
        title="Link inválido ou expirado"
        subtitle="Peça um novo link de recuperação para criar sua senha."
        footer={
          <Link to="/recuperar-senha" className="font-medium text-primary underline-offset-4 hover:underline">
            Pedir novo link
          </Link>
        }
      >
        {null}
      </AuthLayout>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirm) {
      setError('As senhas não são iguais.')
      return
    }
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) {
      setError(toUserMessage(updateError))
      return
    }
    toast.success('Senha atualizada.')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Criar nova senha">
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <FormError message={error} />
        <Field id="new-password" label="Nova senha" hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="new-password-hint"
          />
        </Field>
        <Field id="confirm-password" label="Repita a nova senha">
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" loading={submitting} disabled={!password || !confirm}>
          Salvar senha
        </Button>
      </form>
    </AuthLayout>
  )
}
