import { useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/** Confirmação obrigatória para ações destrutivas. Fica aberta até a ação terminar. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<void>
}) {
  const [running, setRunning] = useState(false)

  async function handleConfirm() {
    setRunning(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // Quem chamou já mostrou a mensagem de erro; o diálogo continua aberto para nova tentativa.
    } finally {
      setRunning(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} loading={running}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
