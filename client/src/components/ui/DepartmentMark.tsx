import { HTMLAttributes } from 'react'

export type DepartmentKey =
  | 'camera'
  | 'sound'
  | 'editing'
  | 'art'
  | 'art and costume'
  | 'cast'
  | 'production'

const GEL_CONFIG: Record<string, { key: DepartmentKey; label: string; bgClass: string; dotColor: string }> = {
  camera: { key: 'camera', label: 'Camera', bgClass: 'bg-gel-camera', dotColor: 'var(--color-gel-camera)' },
  sound: { key: 'sound', label: 'Sound', bgClass: 'bg-gel-sound', dotColor: 'var(--color-gel-sound)' },
  editing: { key: 'editing', label: 'Editing', bgClass: 'bg-gel-editing', dotColor: 'var(--color-gel-editing)' },
  art: { key: 'art and costume', label: 'Art & Costume', bgClass: 'bg-gel-art', dotColor: 'var(--color-gel-art)' },
  'art and costume': { key: 'art and costume', label: 'Art & Costume', bgClass: 'bg-gel-art', dotColor: 'var(--color-gel-art)' },
  'art & costume': { key: 'art and costume', label: 'Art & Costume', bgClass: 'bg-gel-art', dotColor: 'var(--color-gel-art)' },
  cast: { key: 'cast', label: 'Cast', bgClass: 'bg-gel-cast', dotColor: 'var(--color-gel-cast)' },
  production: { key: 'production', label: 'Production', bgClass: 'bg-gel-production', dotColor: 'var(--color-gel-production)' },
}

export interface DepartmentMarkProps extends HTMLAttributes<HTMLSpanElement> {
  department: string
  label?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function DepartmentMark({
  department,
  label,
  showLabel = true,
  size = 'md',
  className = '',
  ...props
}: DepartmentMarkProps) {
  const normalizedKey = department?.toLowerCase().trim() || 'production'
  const config = GEL_CONFIG[normalizedKey] || {
    key: 'production',
    label: department || 'Production',
    bgClass: 'bg-gel-production',
    dotColor: 'var(--color-gel-production)',
  }

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
  const textSize = size === 'sm' ? 'text-12' : 'text-14'
  const displayLabel = label ?? config.label

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${textSize} text-ink font-medium select-none ${className}`}
      title={displayLabel}
      {...props}
    >
      <span
        className={`inline-block ${dotSize} rounded-[1px] shrink-0 ${config.bgClass}`}
        style={{ backgroundColor: config.dotColor }}
        aria-hidden="true"
      />
      {showLabel && <span>{displayLabel}</span>}
    </span>
  )
}
