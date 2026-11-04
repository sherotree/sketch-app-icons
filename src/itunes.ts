import { artworkUrl } from './artwork-url'
import { normalizeCountry } from './countries'

const SEARCH_LIMIT = '30'
const MAX_TERM_LENGTH = 200

export interface AppIcon {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl: string
  primaryGenreName?: string
}

interface ItunesRow {
  trackId?: unknown
  trackName?: unknown
  artistName?: unknown
  artworkUrl512?: unknown
  artworkUrl100?: unknown
  primaryGenreName?: unknown
  kind?: unknown
}

export function itunesSearchUrl(term: string, country: string): string {
  const params = [
    'media=software',
    `limit=${SEARCH_LIMIT}`,
    `term=${encodeURIComponent(term.trim().slice(0, MAX_TERM_LENGTH))}`,
    `country=${encodeURIComponent(normalizeCountry(country))}`,
  ]
  return `https://itunes.apple.com/search?${params.join('&')}`
}

export function appsFromItunes(payload: unknown): AppIcon[] {
  if (!payload || typeof payload !== 'object') return []
  const results = (payload as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  const apps: AppIcon[] = []
  for (const item of results) {
    const app = normalizeRow(item)
    if (app) apps.push(app)
  }
  return apps
}

function normalizeRow(item: unknown): AppIcon | undefined {
  if (!item || typeof item !== 'object') return undefined
  const row = item as ItunesRow
  if (row.kind !== 'software' && row.kind !== 'mac-software') return undefined
  if (typeof row.trackId !== 'number' || typeof row.trackName !== 'string') return undefined
  const artwork = artworkUrl(row.artworkUrl512) ?? artworkUrl(row.artworkUrl100)
  if (!artwork) return undefined
  return {
    trackId: row.trackId,
    trackName: row.trackName,
    artistName: typeof row.artistName === 'string' ? row.artistName : '',
    artworkUrl: artwork,
    primaryGenreName: typeof row.primaryGenreName === 'string' ? row.primaryGenreName : undefined,
  }
}
