import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { FormError } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { toUserMessage } from '@/lib/errors'
import { formatMoneyInput, parseMoneyInput } from '@/lib/money'
import {
  ASSET_TYPE_LABEL,
  LIABILITY_TYPE_LABEL,
  useSaveAsset,
  useSaveLiability,
  type Asset,
  type AssetType,
  type Liability,
  type LiabilityType,
} from './api'

export function AssetDialog({ spaceId, asset, onClose }: { spaceId: string; asset?: Asset; onClose: () => void }) {
  const save = useSaveAsset(spaceId)
  const [name, setName] = useState(asset?.name ?? '')
  const [type, setType] = useState<AssetType>(asset?.type ?? 'investment')
  const [valueText, setValueText] = useState(asset ? formatMoneyInput(asset.value) : '')
  const [notes, setNotes] = useState(asset?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const value = parseMoneyInput(valueText)
    if (!name.trim()) return setError('Dê um nome. Ex.: Apartamento, Tesouro Selic, Carro.')
    if (value === null) return setError('Informe o valor atual. Ex.: 25.000,00')
    save.mutate(
      { id: asset?.id, name, type, value, notes },
      {
        onSuccess: () => {
          toast.success(asset ? 'Valor atualizado.' : 'Bem cadastrado.')
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível salvar.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{asset ? 'Atualizar bem ou investimento' : 'Novo bem ou investimento'}</DialogTitle>
          <DialogDescription>Use o valor de hoje: saldo da aplicação ou valor estimado de venda do bem.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <div className="grid gap-2">
            <Label htmlFor="asset-name">Nome</Label>
            <Input id="asset-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!asset} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="asset-type">Tipo</Label>
              <NativeSelect id="asset-type" value={type} onChange={(e) => setType(e.target.value as AssetType)}>
                {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABEL[t]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-value">Valor atual</Label>
              <MoneyInput id="asset-value" value={valueText} onValueChange={setValueText} autoFocus={Boolean(asset)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-notes">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea id="asset-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LiabilityDialog({ spaceId, liability, onClose }: { spaceId: string; liability?: Liability; onClose: () => void }) {
  const save = useSaveLiability(spaceId)
  const [name, setName] = useState(liability?.name ?? '')
  const [type, setType] = useState<LiabilityType>(liability?.type ?? 'financing')
  const [balanceText, setBalanceText] = useState(liability ? formatMoneyInput(liability.balance) : '')
  const [paymentText, setPaymentText] = useState(liability?.monthlyPayment ? formatMoneyInput(liability.monthlyPayment) : '')
  const [notes, setNotes] = useState(liability?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const balance = parseMoneyInput(balanceText)
    const payment = paymentText.trim() ? parseMoneyInput(paymentText) : null
    if (!name.trim()) return setError('Dê um nome. Ex.: Financiamento do apartamento.')
    if (balance === null) return setError('Informe quanto ainda falta pagar. Ex.: 180.000,00')
    if (paymentText.trim() && (payment === null || payment <= 0)) return setError('A parcela não é válida.')
    save.mutate(
      { id: liability?.id, name, type, balance, monthlyPayment: payment, notes },
      {
        onSuccess: () => {
          toast.success(liability ? 'Dívida atualizada.' : 'Dívida cadastrada.')
          onClose()
        },
        onError: (err) => setError(toUserMessage(err, 'Não foi possível salvar.')),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{liability ? 'Atualizar dívida' : 'Nova dívida ou financiamento'}</DialogTitle>
          <DialogDescription>
            Informe o saldo devedor de hoje. As parcelas pagas continuam sendo lançadas em Movimentações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={error} />
          <div className="grid gap-2">
            <Label htmlFor="debt-name">Nome</Label>
            <Input id="debt-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!liability} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="debt-type">Tipo</Label>
            <NativeSelect id="debt-type" value={type} onChange={(e) => setType(e.target.value as LiabilityType)}>
              {(Object.keys(LIABILITY_TYPE_LABEL) as LiabilityType[]).map((t) => (
                <option key={t} value={t}>
                  {LIABILITY_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="debt-balance">Falta pagar</Label>
              <MoneyInput id="debt-balance" value={balanceText} onValueChange={setBalanceText} autoFocus={Boolean(liability)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="debt-payment">
                Parcela <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <MoneyInput id="debt-payment" value={paymentText} onValueChange={setPaymentText} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="debt-notes">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea id="debt-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
