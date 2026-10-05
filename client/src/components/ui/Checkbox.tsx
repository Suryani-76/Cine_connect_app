import { forwardRef, InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  description?: string
  error?: boolean | string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  description,
  error,
  checked,
  disabled,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? `cb-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none text-14 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={!!error}
          className="peer sr-only"
          {...props}
        />
        <div className={`w-4 h-4 rounded-sm border transition-all flex items-center justify-center bg-surface checkbox-box peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface peer-checked:bg-ink peer-checked:border-ink ${error ? 'border-status-error' : 'border-line'}`}>
          <Check size={12} className={`text-surface stroke-[3] transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="font-medium text-ink leading-tight">{label}</span>}
          {description && <span className="text-12 text-muted leading-tight mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  )
})

Checkbox.displayName = 'Checkbox'
