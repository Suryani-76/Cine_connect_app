import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-tungsten/15 border-b border-tungsten/40 text-ink px-4 py-2 text-12 font-medium flex items-center justify-center gap-2 select-none sticky top-0 z-50 backdrop-blur-sm"
    >
      <WifiOff size={14} className="text-tungsten shrink-0" aria-hidden="true" />
      <span>You are currently offline. Some features may be unavailable.</span>
    </div>
  )
}
