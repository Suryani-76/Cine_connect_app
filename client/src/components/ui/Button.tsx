import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-sans font-medium rounded-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const sizeClasses = {
    sm: 'text-12 px-2.5 py-1 gap-1.5 min-h-[28px]',
    md: 'text-14 px-3.5 py-1.5 gap-2 min-h-[36px]',
    lg: 'text-16 px-5 py-2.5 gap-2.5 min-h-[44px]',
  }[size]

  const variantClasses = {
    primary: 'bg-tungsten text-ink font-semibold border border-transparent hover:brightness-95 active:brightness-90',
    secondary: 'bg-surface text-ink border border-line hover:bg-paper active:bg-line/20',
    ghost: 'bg-transparent text-muted hover:text-ink hover:bg-paper active:bg-line/20 border border-transparent',
    danger: 'bg-status-error/10 text-status-error border border-status-error/30 hover:bg-status-error/20 active:bg-status-error/30',
  }[variant]

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
})

Button.displayName = 'Button'
