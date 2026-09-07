import { personalizeOpportunities, PersonalizedOpportunity } from './personalizeOpportunities'

export const LISTING_TITLE_RE =
  /актуальний open call та події|актуальні гранти та конкурсні програми|worldwide network open calls|grants database|eu supports ukraine through culture|swiss arts council residencies|selected artists in residence|selected projects/i

const KNOWN_DEAD_URL_PARTS = [
  'prohelvetia.ch/en/sundry/residencies',
]

const MS_24H = 24 * 60 * 60 * 1000

function norm(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function toArray(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((i) => String(i).trim()).filter(Boolean)
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map((i) => String(i).trim()).filter(Boolean)
    } catch {
      // fall through
    }
    return trimmed.split(/[,;|/]/).map((i) => i.trim()).filter(Boolean)
  }
  return []
}

export function parseIdList(raw: any): string[] {
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map((id) => String(id)).filter(Boolean)))
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((id) => String(id)).filter(Boolean)))
      }
    } catch {
      return []
    }
  }
  return []
}

export function sameIdSet(a: string[], b: string[]): boolean {
  const left = Array.from(new Set(a.map((id) => String(id)).filter(Boolean))).sort()
  const right = Array.from(new Set(b.map((id) => String(id)).filter(Boolean))).sort()
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }
  return true
}

export function pickOpportunityUrl(opp: any): string {
  const raw = opp?.source_url || opp?.link || opp?.link_url || opp?.url || ''
  return String(raw).trim()
}

export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

export function isKnownDeadUrl(url: string): boolean {
  const low = norm(url)
  for (let i = 0; i < KNOWN_DEAD_URL_PARTS.length; i += 1) {
    if (low.indexOf(KNOWN_DEAD_URL_PARTS[i]) !== -1) return true
  }
  return false
}

export function isUsableOpportunityUrl(opp: any): boolean {
  const url = pickOpportunityUrl(opp)
  if (!isValidHttpUrl(url)) return false
  if (isKnownDeadUrl(url)) return false
  return true
}

function isListingTitle(title: string): boolean {
  const t = String(title || '')
  if (/artfinenation/i.test(t)) return false
  return LISTING_TITLE_RE.test(t)
}

export function filterDigestPool(opportunities: any[]): any[] {
  const list = opportunities || []
  const out: any[] = []
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]
    if (!item) continue
    if (item.is_active === false) continue
    if (isListingTitle(item.title)) continue
    if (!isUsableOpportunityUrl(item)) continue
    out.push(item)
  }
  return out
}

function isUkraineToken(value: string): boolean {
  const v = norm(value)
  if (!v) return false
  return (
    v.indexOf('україн') !== -1 ||
    v.indexOf('ukraine') !== -1 ||
    /(^|[^a-zа-яіїєґ])ua([^a-zа-яіїєґ]|$)/.test(v)
  )
}

function isInternationalToken(value: string): boolean {
  const v = norm(value)
  if (!v) return false
  return (
    v.indexOf('international') !== -1 ||
    v.indexOf('worldwide') !== -1 ||
    v.indexOf('world') !== -1 ||
    v.indexOf('europe') !== -1 ||
    v.indexOf('європ') !== -1 ||
    v.indexOf('eu ') !== -1 ||
    v.indexOf(' eu') !== -1 ||
    v === 'eu' ||
    v.indexOf('онлайн') !== -1 ||
    v.indexOf('online') !== -1 ||
    v.indexOf('swiss') !== -1 ||
    v.indexOf('switzerland') !== -1 ||
    v.indexOf('швейцар') !== -1 ||
    v.indexOf('solidarity') !== -1
  )
}

export function formatOpportunityCountry(opp: any): string {
  const country = String(opp?.country || '').trim()
  const eligible = toArray(opp?.eligible_countries)
  const url = pickOpportunityUrl(opp)
  const title = String(opp?.title || '')
  const blob = norm([country, eligible.join(' '), title, url].join(' '))

  const forcedIntl =
    blob.indexOf('culturehelpssolidarity') !== -1 ||
    blob.indexOf('art4mental') !== -1 ||
    blob.indexOf('prohelvetia') !== -1 ||
    blob.indexOf('culture helps') !== -1

  const countryIsUa = isUkraineToken(country)
  const countryIsIntl = isInternationalToken(country) || forcedIntl
  const eligibleIntl = eligible.some((item) => isInternationalToken(item))
  const eligibleNonUa = eligible.some((item) => item && !isUkraineToken(item) && !isInternationalToken(item))

  if (forcedIntl || countryIsIntl) {
    if (country && !countryIsUa) return country
    return 'Міжнародна'
  }

  if (country && !countryIsUa) return country

  if (countryIsUa && !eligibleIntl && !eligibleNonUa && !forcedIntl) {
    return 'Україна'
  }

  if (eligibleNonUa && country && !countryIsUa) return country
  if (eligibleIntl || eligibleNonUa) return country && !countryIsUa ? country : 'Міжнародна'

  if (country) return country
  return 'Онлайн'
}

function itemTimestamp(opp: any): number {
  const created = Date.parse(String(opp?.created_at || ''))
  const updated = Date.parse(String(opp?.updated_at || ''))
  const times = [created, updated].filter((n) => Number.isFinite(n))
  if (times.length === 0) return NaN
  return Math.max.apply(null, times)
}

export type DigestPortion = {
  items: PersonalizedOpportunity[]
  ids: string[]
  freshCount: number
}

export function buildDigestPortion(options: {
  profile: any
  opportunities: any[]
  previousIds: string[]
  previousRunAt?: string | null
  nowMs?: number
  minNew?: number
  limit?: number
}): DigestPortion {
  const minNew = options.minNew ?? 3
  const limit = options.limit ?? 20
  const nowMs = options.nowMs ?? Date.now()
  const previousIds = parseIdList(options.previousIds)
  const prevSet: { [key: string]: boolean } = {}
  for (let i = 0; i < previousIds.length; i += 1) {
    prevSet[previousIds[i]] = true
  }

  const cutoffMs = options.previousRunAt
    ? Date.parse(String(options.previousRunAt))
    : nowMs - MS_24H
  const safeCutoff = Number.isFinite(cutoffMs) ? cutoffMs : nowMs - MS_24H

  const pool = filterDigestPool(options.opportunities || [])
  const ranked = personalizeOpportunities(options.profile, pool, {
    minScore: 48,
    limit: 40,
  })

  const fresh: PersonalizedOpportunity[] = []
  const fill: PersonalizedOpportunity[] = []

  for (let i = 0; i < ranked.length; i += 1) {
    const row = ranked[i]
    const opp = row.opportunity
    const id = opp && opp.id ? String(opp.id) : ''
    if (!id) continue
    const wasInPrev = prevSet[id] === true
    const ts = itemTimestamp(opp)
    const isNewByTime = Number.isFinite(ts) && ts >= safeCutoff
    if (!wasInPrev && isNewByTime) {
      fresh.push(row)
    } else if (!wasInPrev) {
      fill.push(row)
    }
  }

  let selected: PersonalizedOpportunity[] = []
  if (fresh.length >= minNew) {
    selected = fresh.slice(0, limit)
  } else if (fresh.length > 0) {
    selected = fresh.concat(fill).slice(0, limit)
  } else {
    selected = []
  }

  const ids: string[] = []
  const seen: { [key: string]: boolean } = {}
  for (let i = 0; i < selected.length; i += 1) {
    const id = selected[i]?.opportunity?.id ? String(selected[i].opportunity.id) : ''
    if (!id || seen[id]) continue
    seen[id] = true
    ids.push(id)
  }

  return {
    items: selected,
    ids,
    freshCount: fresh.length,
  }
}

export function shouldKeepExistingSameDaySnapshot(options: {
  newIds: string[]
  previousIds: string[]
  previousRunAt?: string | null
  nowMs?: number
}): boolean {
  if ((options.newIds || []).length > 0) return false
  const prev = parseIdList(options.previousIds)
  if (prev.length === 0) return false
  const runAt = Date.parse(String(options.previousRunAt || ''))
  if (!Number.isFinite(runAt)) return false
  const nowMs = options.nowMs ?? Date.now()
  return nowMs - runAt < MS_24H
}
