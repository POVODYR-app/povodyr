import { personalizeOpportunities, PersonalizedOpportunity } from './personalizeOpportunities'

export const LISTING_TITLE_RE =
  /актуальний open call та події|актуальні гранти та конкурсні програми|worldwide network open calls|grants database|eu supports ukraine through culture|swiss arts council residencies|selected artists in residence|selected projects|bar laika|presents playback|ghosts\s*-\s*readers|топ світових програм|open calls and opportunities|september \d{4} opportunities|august \d{4}:?\s*open calls|arts opportunities \| arizona|river of stories|time, place & practice|100 emerging artworks|artist and curatorial fellowships at gasworks|summer sessions:\s*art and technology|exhibition programme 2026|le garage moderne|international residencies & open calls|kunsthaus z/i

const KNOWN_DEAD_URL_PARTS = [
  'prohelvetia.ch/en/sundry/residencies',
  'e-flux.com/events/',
  'e-flux.com/readers/',
  'e-flux.com/journal/',
  'on-the-move.org/news/summer-sessions',
  'e-flux.com/announcements/6787818/artist-and-curatorial-fellowships-at-gasworks',
    't.me/s/gdeart',
  't.me/gdeart',
  '.ru/',
  '.рф/',
  '.by/',
    'e-flux.com/announcements/6784702/exhibition-programme-2026',
  'legaragemoderne.org',
]

const MS_24H = 24 * 60 * 60 * 1000

function norm(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
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

const BANNED_REGION_RE =
  /росі[яи]|россия|россий|russia|russian federation|рф\b|москва|moscow|беларус|білорус|belarus|минск|мінськ|гомель|гродно|\.ru\b|\.by\b|t\.me\/s\/gdeart|t\.me\/gdeart|где выставка/i

export function isBannedRegionOpportunity(opp: any): boolean {
  const blob = norm(
    [
      opp?.country,
      opp?.eligible_countries,
      opp?.title,
      opp?.source_name,
      opp?.description,
      opp?.raw_description,
      pickOpportunityUrl(opp),
    ].join(' ')
  )
  if (!blob) return false
  if (/україн|ukraine|artfinenation/.test(blob) && !/росі|russia|беларус|білорус|belarus/.test(blob)) {
    return false
  }
  return BANNED_REGION_RE.test(blob)
}

export function isUsableOpportunityUrl(opp: any): boolean {
  const url = pickOpportunityUrl(opp)
  if (!isValidHttpUrl(url)) return false
  if (isKnownDeadUrl(url)) return false
  if (isBannedRegionOpportunity(opp)) return false
  const title = String(opp?.title || '')
  if (LISTING_TITLE_RE.test(title) && !/artfinenation/i.test(title)) return false
  if (/где выставка|gdeart/i.test(title)) return false
  if (/t\.me\//i.test(url)) return false
  return true
}

function isArtFineNationOpp(opp: any): boolean {
  if (!opp) return false
  const blob = norm(
    `${opp.source_url || ''} ${opp.link || ''} ${opp.title || ''} ${opp.source_name || ''}`
  )
  return (
    blob.indexOf('sites.google.com/view/artfinenation') !== -1 ||
    blob.indexOf('art fine nation') !== -1 ||
    blob.indexOf('artfinenation') !== -1
  )
}

function profileWantsUkraine(profile: any): boolean {
  const blob = norm(
    [
      profile?.search_countries,
      profile?.target_countries,
      profile?.country,
      profile?.residency_country,
      profile?.citizenship,
    ].join(' ')
  )
  return (
    blob.indexOf('україн') !== -1 ||
    blob.indexOf('ukraine') !== -1 ||
    /(^|[^a-zа-яіїєґ])ua([^a-zа-яіїєґ]|$)/.test(blob)
  )
}

function findAfnInPool(pool: any[]): any | null {
  const list = pool || []
  for (let i = 0; i < list.length; i += 1) {
    if (isArtFineNationOpp(list[i])) return list[i]
  }
  return null
}

function pinAfnIfUkraine(
  selected: PersonalizedOpportunity[],
  pool: any[],
  profile: any
): PersonalizedOpportunity[] {
  if (!profileWantsUkraine(profile)) return selected
  if (!selected.length) return selected

  const afnOpp = findAfnInPool(pool)
  if (!afnOpp || !afnOpp.id) return selected

  const afnId = String(afnOpp.id)
  const without: PersonalizedOpportunity[] = []
  for (let i = 0; i < selected.length; i += 1) {
    const row = selected[i]
    const id = row?.opportunity?.id ? String(row.opportunity.id) : ''
    if (id === afnId || isArtFineNationOpp(row?.opportunity)) continue
    without.push(row)
  }

  const pinned: PersonalizedOpportunity = {
    opportunity: afnOpp,
    score: 99,
    reasons: ['Гарантоване джерело для України: Art Fine Nation'],
  }
  return [pinned].concat(without)
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
    if (isBannedRegionOpportunity(item)) continue
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

export function formatOpportunityCountry(opp: any): string {
  const country = String(opp?.country || '').trim()
  const url = pickOpportunityUrl(opp)
  const title = String(opp?.title || '')
  const blob = norm([country, title, url].join(' '))

  const forcedIntl =
    blob.indexOf('culturehelpssolidarity') !== -1 ||
    blob.indexOf('art4mental') !== -1 ||
    blob.indexOf('prohelvetia') !== -1 ||
    blob.indexOf('culture helps') !== -1

  if (forcedIntl) return 'Міжнародна'
  if (isUkraineToken(country) && !forcedIntl) return 'Україна'
  if (country) return country
  return 'Онлайн'
}

function itemTimestamp(opp: any): number {
  const created = Date.parse(String(opp?.created_at || ''))
  return Number.isFinite(created) ? created : NaN
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
  } else if (previousIds.length === 0) {
    selected = ranked.slice(0, limit)
  } else {
    selected = []
  }

  selected = pinAfnIfUkraine(selected, pool, options.profile)
  const ids: string[] = []
  const seen: { [key: string]: boolean } = {}
  for (let i = 0; i < selected.length; i += 1) {
    const id = selected[i]?.opportunity?.id ? String(selected[i].opportunity.id) : ''
    if (!id || seen[id]) return selected as any
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
