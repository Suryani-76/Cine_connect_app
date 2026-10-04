import { BadgeCheck } from 'lucide-react'

interface VerifiedBadgeProps {
  className?: string
  showText?: boolean
  size?: number
}

/**
 * VerifiedBadge Component
 * Displays a verified badge indicating a verified production company or entity.
 */
export function VerifiedBadge({ className = '', showText = true, size = 14 }: VerifiedBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 ${className}`}
      title="Verified Production Company"
    >
      <BadgeCheck size={size} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
      {showText && <span>Verified</span>}
    </span>
  )
}

export default VerifiedBadge
