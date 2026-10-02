/**
 * normalize.ts
 * ────────────
 * Standardized string normalization for match scoring, vocabulary search,
 * and entity comparisons across skills, roles, languages, and locations.
 *
 * Rules:
 *  1. Unicode NFKD decomposition + strip diacritics
 *  2. Lowercase
 *  3. Strip punctuation (replace non-alphanumeric unicode characters with space)
 *  4. Collapse whitespace
 *  5. Trim
 */

export function normalizeString(val: string | null | undefined): string {
  if (!val) return ''
  return val
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes an array of strings, filtering out empty entries
 * and removing duplicates.
 */
export function normalizeList(items: string[] | null | undefined): string[] {
  if (!items || !Array.isArray(items)) return []
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const norm = normalizeString(item)
    if (norm && !seen.has(norm)) {
      seen.add(norm)
      result.push(norm)
    }
  }

  return result
}

/**
 * Checks whether two strings match under normalization.
 */
export function areStringsEqualNormalized(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const normA = normalizeString(a)
  const normB = normalizeString(b)
  return Boolean(normA && normB && normA === normB)
}
