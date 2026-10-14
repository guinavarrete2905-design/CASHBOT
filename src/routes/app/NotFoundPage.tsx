import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/feedback'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/">Ir para o início</Link>
        </Button>
      }
    >
      O endereço pode ter mudado ou não existe.
    </EmptyState>
  )
}
