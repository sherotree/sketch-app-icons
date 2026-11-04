export const RECENT_LIMIT = 6
const MAX_TERM_LENGTH = 80

export function normalizeRecent(value: unknown): string[] {
  const items = asList(value)
  const seen = new Set<string>()
  const next: string[] = []
  for (const item of items) {
    const cleaned = cleanTerm(item)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(cleaned)
    if (next.length >= RECENT_LIMIT) break
  }
  return next
}

export function rememberRecent(current: readonly string[], term: string): string[] {
  const cleaned = cleanTerm(term)
  if (!cleaned) return normalizeRecent(current)
  return normalizeRecent([cleaned, ...current])
}

export function forgetRecent(current: readonly string[], term: string): string[] {
  return current.filter(item => item !== term)
}

function cleanTerm(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_TERM_LENGTH)
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && typeof (value as { count?: unknown }).count === 'function') {
    const list = value as { count: () => number; objectAtIndex: (index: number) => unknown }
    const count = Number(list.count())
    const items: unknown[] = []
    for (let index = 0; index < count; index += 1) items.push(String(list.objectAtIndex(index)))
    return items
  }
  return []
}
