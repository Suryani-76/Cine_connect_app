/**
 * Shared formatting utilities for CineConnect.
 * Used across Job Wizard (review & preview), Browse Rows, Detail Page, and Home.
 */

/** Sentence-case a string: capitalizes first letter, lowers the rest, converts underscores to spaces */
export function toSentenceCase(str?: string | null): string {
  if (!str) return ''
  const normalized = str.trim().replace(/_/g, ' ')
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

/** Format JobType enum into clean sentence case ("Part time", "Full time", etc.) */
export function formatJobType(jobType?: string | null): string {
  if (!jobType) return 'Freelance'
  const key = jobType.trim().toLowerCase().replace(/\s+/g, '_')
  switch (key) {
    case 'part_time':
      return 'Part time'
    case 'full_time':
      return 'Full time'
    case 'freelance':
      return 'Freelance'
    case 'contract':
      return 'Contract'
    default:
      return toSentenceCase(jobType)
  }
}

/** Format ExperienceLevel into standard display string ("Entry level", "Mid level", "Senior", etc.) */
export function formatExperienceLevel(level?: string | null): string {
  if (!level) return 'Any level'
  const key = level.trim().toLowerCase().replace(/_level$|\s+level$/, '').replace(/_/g, ' ')
  switch (key) {
    case 'entry':
      return 'Entry level'
    case 'mid':
      return 'Mid level'
    case 'senior':
      return 'Senior'
    case 'any':
      return 'Any level'
    default:
      return toSentenceCase(level)
  }
}

export interface PayParams {
  pay_min?: number | string | null
  pay_max?: number | string | null
  pay_currency?: string | null
  pay_period?: string | null
}

/** Resolve currency symbol: ₹ for INR / default, $ for USD, € for EUR, £ for GBP */
export function resolveCurrencySymbol(currency?: string | null): string {
  if (!currency || currency.toUpperCase() === 'INR') return '₹'
  if (currency.toUpperCase() === 'USD') return '$'
  if (currency.toUpperCase() === 'EUR') return '€'
  if (currency.toUpperCase() === 'GBP') return '£'
  return currency.trim() + ' '
}

/** Format pay period suffix: " per project", " per month", " per hour", etc. */
export function formatPayPeriod(period?: string | null): string {
  if (!period) return ''
  const trimmed = period.trim().toLowerCase().replace(/^(\/|per)\s*/, '')
  if (!trimmed) return ''
  return ` per ${trimmed}`
}

/**
 * Format pay range into standard string:
 * e.g. "₹35,000 – ₹40,000 per project", "₹35,000 per project", "From ₹35,000 per project", "Pay unspecified"
 * Never returns "INR 35000" or raw lowercase enum.
 */
export function formatPayRange(params?: PayParams | null): string {
  if (!params) return 'Pay unspecified'

  const minNum = params.pay_min != null && params.pay_min !== '' ? Number(params.pay_min) : NaN
  const maxNum = params.pay_max != null && params.pay_max !== '' ? Number(params.pay_max) : NaN
  const hasMin = !isNaN(minNum) && minNum >= 0
  const hasMax = !isNaN(maxNum) && maxNum >= 0

  if (!hasMin && !hasMax) return 'Pay unspecified'

  const curr = resolveCurrencySymbol(params.pay_currency)
  const period = formatPayPeriod(params.pay_period)

  if (hasMin && hasMax) {
    if (minNum === maxNum) {
      return `${curr}${minNum.toLocaleString()}${period}`
    }
    return `${curr}${minNum.toLocaleString()} – ${curr}${maxNum.toLocaleString()}${period}`
  }

  if (hasMin) {
    return `From ${curr}${minNum.toLocaleString()}${period}`
  }

  return `Up to ${curr}${maxNum.toLocaleString()}${period}`
}

/** Alias to format pay for any job-like object */
export function formatPay(job?: PayParams | null): string {
  return formatPayRange(job)
}

/** Helper to parse YYYY-MM-DD or ISO dates without local timezone day skew */
function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // If date-only format YYYY-MM-DD
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10)
    const month = parseInt(dateOnlyMatch[2], 10) - 1
    const day = parseInt(dateOnlyMatch[3], 10)
    return new Date(year, month, day)
  }

  const d = new Date(trimmed)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Format date range into standard display:
 * e.g. "Oct 9 – Oct 30, 2026", "Nov 1 – Dec 15, 2026", "Oct 9, 2026 – Jan 15, 2027", "Flexible / To be discussed"
 * Never returns ISO dates.
 */
export function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  const dStart = parseDateSafe(startDate)
  const dEnd = parseDateSafe(endDate)

  if (!dStart && !dEnd) {
    return 'Flexible / To be discussed'
  }

  if (dStart && dEnd) {
    const sameYear = dStart.getFullYear() === dEnd.getFullYear()
    const sameMonth = sameYear && dStart.getMonth() === dEnd.getMonth()
    const sameDay = sameMonth && dStart.getDate() === dEnd.getDate()

    const mStart = dStart.toLocaleDateString('en-US', { month: 'short' })
    const dayStart = dStart.getDate()
    const yStart = dStart.getFullYear()

    const mEnd = dEnd.toLocaleDateString('en-US', { month: 'short' })
    const dayEnd = dEnd.getDate()
    const yEnd = dEnd.getFullYear()

    if (sameDay) {
      return `${mStart} ${dayStart}, ${yEnd}`
    }

    if (sameYear) {
      return `${mStart} ${dayStart} – ${mEnd} ${dayEnd}, ${yEnd}`
    }

    return `${mStart} ${dayStart}, ${yStart} – ${mEnd} ${dayEnd}, ${yEnd}`
  }

  if (dStart) {
    const mStart = dStart.toLocaleDateString('en-US', { month: 'short' })
    const dayStart = dStart.getDate()
    const yStart = dStart.getFullYear()
    return `${mStart} ${dayStart}, ${yStart} – TBD`
  }

  if (dEnd) {
    const mEnd = dEnd.toLocaleDateString('en-US', { month: 'short' })
    const dayEnd = dEnd.getDate()
    const yEnd = dEnd.getFullYear()
    return `Immediate – ${mEnd} ${dayEnd}, ${yEnd}`
  }

  return 'Flexible / To be discussed'
}

/**
 * Format deadline date into standard display:
 * e.g. "Oct 8, 2026, 5:00 PM" when time is provided, or "Oct 8, 2026".
 * Returns "No deadline" when null or empty.
 */
export function formatDeadlineDate(
  deadline?: string | null,
  options?: { includeTime?: boolean }
): string {
  if (!deadline) return 'No deadline'
  const trimmed = deadline.trim()
  if (!trimmed) return 'No deadline'

  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return 'No deadline'

  const hasTime = trimmed.includes('T') || trimmed.includes(':')
  const shouldIncludeTime = options?.includeTime ?? hasTime

  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  if (!shouldIncludeTime) {
    return dateStr
  }

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${dateStr}, ${timeStr}`
}

/** Format single date: e.g. "Oct 8, 2026" */
export function formatDate(date?: string | null): string {
  if (!date) return '—'
  const d = parseDateSafe(date)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Correct pluralization for counts:
 * e.g. pluralize(1, 'active job') => "1 active job"
 * e.g. pluralize(0, 'active job') => "0 active jobs"
 * e.g. pluralize(1, 'opening') => "1 opening"
 * e.g. pluralize(2, 'opening') => "2 openings"
 * e.g. pluralize(0, 'applicant') => "0 applicants"
 * e.g. pluralize(1, 'applicant') => "1 applicant"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const safeCount = isNaN(count) ? 0 : count
  if (safeCount === 1) {
    return `1 ${singular}`
  }

  if (plural) {
    return `${safeCount} ${plural}`
  }

  if (singular.endsWith('y') && !singular.endsWith('ey') && !singular.endsWith('ay')) {
    return `${safeCount} ${singular.slice(0, -1)}ies`
  }

  return `${safeCount} ${singular}s`
}
