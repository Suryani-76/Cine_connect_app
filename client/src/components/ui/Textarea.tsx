import { forwardRef, TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  error,
  disabled,
  rows = 4,
  className = '',
  ...props
}, ref) => {
  const errorClasses = error
    ? 'border-status-error text-status-error focus:border-status-error focus:ring-1 focus:ring-status-error'
    : 'border-line text-ink focus:border-ink focus:ring-1 focus:ring-ink'

  return (
    <textarea
      ref={ref}
      rows={rows}
      disabled={disabled}
      aria-invalid={!!error}
      className={`w-full rounded-sm bg-surface font-sans text-14 p-3 placeholder:text-muted/70 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-paper border ${errorClasses} ${className}`}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
