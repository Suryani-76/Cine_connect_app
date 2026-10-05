import { HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle'
}

export function Skeleton({
  variant = 'rect',
  className = '',
  ...props
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full rounded-sm',
    rect: 'rounded-sm',
    circle: 'rounded-full',
  }[variant]

  return (
    <div
      className={`skeleton select-none ${variantClasses} ${className}`}
      aria-hidden="true"
      {...props}
    />
  )
}
