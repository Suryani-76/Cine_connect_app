import { ReactNode } from 'react'
import { Button } from './Button'

export interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center border border-dashed border-line bg-surface rounded-sm ${className}`}
    >
      {icon && <div className="text-muted mb-3">{icon}</div>}
      <h3 className="text-16 font-bold text-ink mb-1">{title}</h3>
      {description && (
        <p className="text-14 text-muted max-w-sm mb-4 leading-normal">
          {description}
        </p>
      )}
      {action ? (
        action
      ) : actionLabel && onAction ? (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
