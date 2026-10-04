import { forwardRef, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean | string
  options?: SelectOption[]
  selectSize?: 'sm' | 'md' | 'lg'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  error,
  options,
  selectSize = 'md',
  disabled,
  className = '',
  children,
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'text-12 pl-2.5 pr-8 py-1 min-h-[28px]',
    md: 'text-14 pl-3 pr-8 py-1.5 min-h-[36px]',
    lg: 'text-16 pl-4 pr-10 py-2 min-h-[44px]',
  }[selectSize]

  const errorClasses = error
    ? 'border-status-error text-status-error focus:border-status-error focus:ring-1 focus:ring-status-error'
    : 'border-line text-ink focus:border-ink focus:ring-1 focus:ring-ink'

  return (
    <div className="relative w-full">
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={!!error}
        className={`w-full appearance-none rounded-sm bg-surface font-sans transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-paper border ${sizeClasses} ${errorClasses} ${className}`}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  )
})

Select.displayName = 'Select'
