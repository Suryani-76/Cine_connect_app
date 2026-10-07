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
  'post-production': { key: 'editing', label: 'Editing', bgClass: 'bg-gel-editing', dotColor: 'var(--color-gel-editing)' },
  post: { key: 'editing', label: 'Editing', bgClass: 'bg-gel-editing', dotColor: 'var(--color-gel-editing)' },
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
  const resolvedKey = resolveDepartment(department)
  const config = GEL_CONFIG[resolvedKey] || {
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

export function resolveDepartment(roleOrDept?: string | null): DepartmentKey {
  if (!roleOrDept) return 'production'
  const r = roleOrDept.toLowerCase().trim()
  if (r.includes('edit') || r.includes('color') || r.includes('vfx') || r.includes('post')) {
    return 'editing'
  }
  if (
    r.includes('camera') ||
    r.includes('cinematograph') ||
    r.includes('dop') ||
    r.includes('gaffer') ||
    r.includes('grip') ||
    r.includes('focus') ||
    r.includes('light') ||
    r.includes('steadicam') ||
    r.includes('dit')
  ) {
    return 'camera'
  }
  if (
    r.includes('sound') ||
    r.includes('audio') ||
    r.includes('boom') ||
    r.includes('mixer') ||
    r.includes('foley') ||
    r.includes('music')
  ) {
    return 'sound'
  }
  if (
    r.includes('art') ||
    r.includes('costume') ||
    r.includes('set') ||
    r.includes('wardrobe') ||
    r.includes('makeup') ||
    r.includes('dresser') ||
    r.includes('prop')
  ) {
    return 'art and costume'
  }
  if (
    r.includes('cast') ||
    r.includes('actor') ||
    r.includes('actress') ||
    r.includes('talent') ||
    r.includes('stunt') ||
    r.includes('voice')
  ) {
    return 'cast'
  }
  return 'production'
}

