import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toUserMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AuthLayout, Field } from './AuthLayout'

export const MIN_PASSWORD_LENGTH = 8

export function SignupPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    setSubmitting(false)
    if (signUpError) {
      setError(toUserMessage(signUpError))
      return
    }
    if (data.session) {
      navigate('/', { replace: true })
    } else {
      setSentTo(email.trim())
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Confirme seu e-mail"
        footer={
          <Link to="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
            Voltar para entrar
          </Link>
        }
      >
        <div className="flex gap-3 rounded-lg border bg-surface p-4 text-sm" role="status">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden="true" />
          <p>
            Enviamos um link de confirmação para <strong className="font-medium">{sentTo}</strong>. Abra a mensagem e
            toque no link para ativar sua conta. Se não encontrar, confira a caixa de spam.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Comece com um espaço pessoal. Depois você pode criar espaços para o casal ou a família."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
        <FormError message={error} />
        <Field id="full-name" label="Nome">
          <Input
            id="full-name"
            autoComplete="name"
            required
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
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
        <Field id="password" label="Senha" hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
          />
        </Field>
        <Button type="submit" size="lg" loading={submitting} disabled={!fullName.trim() || !email || !password}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}
