import { HTMLAttributes, ReactNode } from 'react'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'tungsten' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  const sizeClasses = {
    sm: 'text-12 px-1.5 py-0.5 min-h-[20px]',
    md: 'text-14 px-2 py-0.5 min-h-[24px]',
  }[size]

  const variantClasses = {
    neutral: 'bg-paper text-ink border-line',
    tungsten: 'bg-tungsten/15 text-ink border-tungsten/40 font-semibold',
    success: 'bg-status-success/10 text-status-success border-status-success/30',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    error: 'bg-status-error/10 text-status-error border-status-error/30',
  }[variant]

  return (
    <span
      className={`inline-flex items-center gap-1 font-sans font-medium rounded-sm border select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
