import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface Signal {
  name: string
  score: number
  maxScore?: number
  weight?: number
  reason?: string
}

export interface LightMeterProps {
  score: number
  breakdown?: Signal[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
  showScoreLabel?: boolean
  expandable?: boolean
  defaultExpanded?: boolean
}

export function LightMeter({
  score,
  breakdown,
  size = 'md',
  className = '',
  label,
  showScoreLabel = true,
  expandable = true,
  defaultExpanded = false,
}: LightMeterProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const [expanded, setExpanded] = useState(defaultExpanded)

  // Needle settles with transition only when value changes AFTER mount
  const hasMounted = useRef(false)
  const prevScore = useRef(clampedScore)
  const [enableTransition, setEnableTransition] = useState(false)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    if (prevScore.current !== clampedScore) {
      prevScore.current = clampedScore
      setEnableTransition(true)
      const timer = setTimeout(() => setEnableTransition(false), 600)
      return () => clearTimeout(timer)
    }
  }, [clampedScore])

  // Size configurations
  const dimensions = {
    sm: { trackHeight: 'h-4', needleHeight: 'h-5', tickHeight: 'h-2', majorTick: 'h-3', textSize: 'text-12' },
    md: { trackHeight: 'h-6', needleHeight: 'h-7', tickHeight: 'h-2.5', majorTick: 'h-4.5', textSize: 'text-14' },
    lg: { trackHeight: 'h-8', needleHeight: 'h-9', tickHeight: 'h-3', majorTick: 'h-6', textSize: 'text-16' },
  }[size]

  return (
    <div
      className={`flex flex-col gap-1.5 select-none font-sans ${className}`}
      data-testid="light-meter"
    >
      {/* Header with label & score value */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {label && <span className="text-12 font-medium text-muted">{label}</span>}
          {breakdown && breakdown.length > 0 && expandable && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-0.5 text-12 text-muted hover:text-ink transition-colors focus-visible:outline-none"
              aria-expanded={expanded}
              aria-label="Toggle match signals breakdown"
            >
              <span>Signals</span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {showScoreLabel && (
          <div className="flex items-baseline gap-1 text-ink tnum">
            <span className="text-18 font-bold leading-none">{clampedScore}</span>
            <span className="text-12 text-muted leading-none">/ 100</span>
          </div>
        )}
      </div>

      {/* Accessible Exposure Scale Track */}
      <div
        role="meter"
        aria-valuenow={clampedScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Match score ${clampedScore} out of 100`}
        className={`relative w-full ${dimensions.trackHeight} light-meter-track rounded-sm flex items-center px-2 overflow-visible`}
      >
        <span className="sr-only">Match score {clampedScore} out of 100</span>

        {/* Exposure scale tick marks */}
        <div className="absolute inset-x-2 inset-y-0 flex items-center justify-between pointer-events-none">
          {Array.from({ length: 21 }).map((_, i) => {
            const isMajor = i % 5 === 0 // 0, 25, 50, 75, 100
            const isMid = i % 2 === 0    // 10, 20, 30, 40, 60, 70, 80, 90
            return (
              <div
                key={i}
                data-tick-score={i * 5}
                className={`${
                  isMajor
                    ? `${dimensions.majorTick} w-[1.5px] bg-ink`
                    : isMid
                      ? `${dimensions.tickHeight} w-[1px] bg-muted opacity-80`
                      : 'h-1.5 w-[1px] bg-muted opacity-50'
                }`}
              />
            )
          })}
        </div>

        {/* Exposure Stop Labels on lg size */}
        {size === 'lg' && (
          <div className="absolute inset-x-2 -bottom-4 flex justify-between text-[9px] font-mono text-muted/70 pointer-events-none tnum">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        )}

        {/* Tungsten Needle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 ${
            enableTransition ? 'transition-[left] duration-500 ease-out motion-reduce:transition-none' : ''
          }`}
          style={{ left: `calc(8px + (100% - 16px) * ${clampedScore / 100})` }}
        >
          {/* Triangular needle head */}
          <div
            className="w-0 h-0 border-l-[4.5px] border-l-transparent border-r-[4.5px] border-r-transparent border-t-[6px] border-t-tungsten"
            aria-hidden="true"
          />
          {/* Vertical needle bar */}
          <div
            className={`w-[3px] ${dimensions.needleHeight} bg-tungsten shadow-[0_0_3px_rgba(242,163,58,0.7)]`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Expandable Breakdown Drawer / Signals */}
      {breakdown && breakdown.length > 0 && expanded && (
        <div
          className="mt-2.5 p-3 bg-surface border border-line rounded-sm flex flex-col gap-2.5 text-12 animate-in fade-in-50 duration-200"
          data-testid="signals-breakdown"
        >
          <div className="text-12 font-semibold text-ink border-b border-line pb-1.5 flex items-center justify-between">
            <span>Signal evaluation</span>
            <span className="text-muted font-normal">Weight contribution</span>
          </div>

          <div className="flex flex-col gap-2">
            {breakdown.map((sig, idx) => {
              const max = sig.maxScore ?? sig.weight ?? 10
              const earned = sig.score > max
                ? Math.min(max, Math.round((sig.score / 100) * max))
                : Math.min(max, Math.max(0, sig.score))
              const percent = max > 0 ? Math.min(100, Math.round((earned / max) * 100)) : 0

              return (
                <div
                  key={idx}
                  className="flex flex-col gap-1 p-1.5 rounded-sm hover:bg-paper/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-ink">
                    <span className="font-medium">{sig.name}</span>
                    <span className="text-muted tnum">
                      <strong className="text-ink">{earned}</strong> / {max} pts
                    </span>
                  </div>

                  {/* Signal mini bar */}
                  <div className="w-full h-1.5 bg-paper rounded-[1px] overflow-hidden border border-line/60">
                    <div
                      className="h-full bg-tungsten transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Reason text */}
                  {sig.reason && (
                    <p className="text-[11px] text-muted leading-tight mt-0.5">
                      {sig.reason}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
