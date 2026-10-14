import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ErrorState, FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useChangePassword, useProfile, useUpdateProfile } from '@/features/profile/api'
import { toUserMessage } from '@/lib/errors'
import { useAuth } from '@/providers/AuthProvider'
import { MIN_PASSWORD_LENGTH } from '@/routes/auth/SignupPage'
import { SettingsBlock } from './SettingsBlock'

function ProfileForm() {
  const { user } = useAuth()
  const profile = useProfile()
  const update = useUpdateProfile()
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    if (profile.data) setFullName(profile.data.full_name)
  }, [profile.data])

  if (profile.isPending) return <Skeleton className="h-28 w-full max-w-md" />
  if (profile.error) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />

  const unchanged = fullName.trim() === (profile.data?.full_name ?? '').trim()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    update.mutate(
      { fullName },
      {
        onSuccess: () => toast.success('Perfil atualizado.'),
        onError: (err) => toast.error(toUserMessage(err, 'Não foi possível salvar o perfil.')),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-md gap-5">
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Nome</Label>
        <Input
          id="profile-name"
          autoComplete="name"
          maxLength={120}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" value={user?.email ?? ''} readOnly disabled aria-describedby="profile-email-hint" />
        <p id="profile-email-hint" className="text-xs text-muted-foreground">
          O e-mail é usado para entrar e para receber convites de espaços.
        </p>
      </div>
      <div>
        <Button type="submit" loading={update.isPending} disabled={unchanged || !fullName.trim()}>
          Salvar
        </Button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
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
    change.mutate(password, {
      onSuccess: () => {
        setPassword('')
        setConfirm('')
        toast.success('Senha alterada.')
      },
      onError: (err) => setError(toUserMessage(err, 'Não foi possível alterar a senha.')),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-md gap-5" noValidate>
      <FormError message={error} />
      <div className="grid gap-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Repita a nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div>
        <Button type="submit" variant="outline" loading={change.isPending} disabled={!password || !confirm}>
          Alterar senha
        </Button>
      </div>
    </form>
  )
}

export function ProfileSection() {
  return (
    <>
      <SettingsBlock title="Dados do perfil" description="Seu nome aparece para quem divide espaços com você.">
        <ProfileForm />
      </SettingsBlock>
      <SettingsBlock title="Senha">
        <PasswordForm />
      </SettingsBlock>
    </>
  )
}
