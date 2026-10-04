import { forwardRef, InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string
  inputSize?: 'sm' | 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  error,
  inputSize = 'md',
  disabled,
  className = '',
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'text-12 px-2.5 py-1 min-h-[28px]',
    md: 'text-14 px-3 py-1.5 min-h-[36px]',
    lg: 'text-16 px-4 py-2 min-h-[44px]',
  }[inputSize]

  const errorClasses = error
    ? 'border-status-error text-status-error focus:border-status-error focus:ring-1 focus:ring-status-error'
    : 'border-line text-ink focus:border-ink focus:ring-1 focus:ring-ink'

  return (
    <input
      ref={ref}
      disabled={disabled}
      aria-invalid={!!error}
      className={`w-full rounded-sm bg-surface font-sans placeholder:text-muted/70 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-paper border ${sizeClasses} ${errorClasses} ${className}`}
      {...props}
    />
  )
})

Input.displayName = 'Input'
