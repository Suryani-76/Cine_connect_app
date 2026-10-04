import { useState } from 'react'

export interface AvatarProps {
  src?: string | null
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'square' | 'circle'
  className?: string
}

export function Avatar({
  src,
  alt = 'Avatar',
  fallback,
  size = 'md',
  shape = 'square',
  className = '',
}: AvatarProps) {
  const [error, setError] = useState(false)

  const sizeClasses = {
    sm: 'w-6 h-6 text-12',
    md: 'w-8 h-8 text-12',
    lg: 'w-10 h-10 text-14',
    xl: 'w-14 h-14 text-18',
  }[size]

  const shapeClasses = shape === 'circle' ? 'rounded-full' : 'rounded-sm'

  const initials = fallback
    ? fallback
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  return (
    <div
      className={`relative inline-flex items-center justify-center border border-line bg-paper text-ink font-semibold select-none overflow-hidden shrink-0 ${sizeClasses} ${shapeClasses} ${className}`}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
