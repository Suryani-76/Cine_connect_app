/**
 * Strips HTML tags and trims whitespace from a string.
 * Protects against stored XSS in free-text fields (bio, description, cover_note, etc.).
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')    // remove all HTML tags
    .replace(/&[a-z]+;/gi, '')  // remove common HTML entities (&amp; &lt; etc.)
    .trim()
}

/**
 * Returns a new object with stripHtml applied to every string value (shallow).
 * Non-string values are preserved as-is.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    result[key] = typeof val === 'string' ? stripHtml(val) : val
  }
  return result as T
}
