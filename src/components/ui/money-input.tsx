import * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatMoneyInput, parseMoneyInput } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Campo de valor em reais com prefixo "R$"; formata ao sair do campo. */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: string
    onValueChange: (value: string) => void
  }
>(({ value, onValueChange, className, onBlur, ...props }, ref) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
    <Input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      className={cn('tabular pl-10', className)}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onBlur={(e) => {
        const parsed = parseMoneyInput(value)
        if (parsed !== null) onValueChange(formatMoneyInput(parsed))
        onBlur?.(e)
      }}
      {...props}
    />
  </div>
))
MoneyInput.displayName = 'MoneyInput'
