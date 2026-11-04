export function artworkUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) return undefined
  try {
    const url = new URL(value)
    const host = url.hostname
    const allowed = host === 'mzstatic.com' || host.endsWith('.mzstatic.com')
    if (url.protocol !== 'https:' || !allowed) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}
