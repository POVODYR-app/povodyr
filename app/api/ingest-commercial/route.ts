import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { completeCheap } from '../../../lib/ai/client'
import {
  hasArtPurchaseObject,
  hasDemandSignal,
  hasStrongBuyerSignal,
  isJunkText,
  isRealBuyerRequest,
  isSellerOrPlanText,
  isWallTradeNotArt,
  isArtistSaleEvent,
  normalizeCommercialSourceUrl,
  shouldSkipSearchResult,
  titleFingerprint,
} from '../../../lib/commercialDemandGate'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)



type CommercialItem = {
  title: string
  description: string
  what_is_needed: string
  organization: string
  city?: string
  country?: string
  subtype: string
  budget?: string | number | null
  currency?: string | null
  source_url: string
  contact_person?: string | null
  contact_method?: string | null
  deadline?: string | null
}

type SearchLocale = {
  gl: string
  hl: string
}

type SearchQuery = {
  q: string
  locale: SearchLocale
}

const ALLOWED_SUBTYPES = [
  'interior_designer',
  'gallery',
  'hotel',
  'restaurant',
  'corporate_space',
  'collector',
  'art_consultant',
  'developer',
  'commercial_project',
  'commission',
  'art_rental',
  'exhibition_for_sale',
  'collaboration',
  'other',
] as const

const CURATED_SOURCES: { url: string; name: string }[] = [
  
  {
    url: 'https://www.nsw.gov.au/departments-and-agencies/health-infrastructure/news/call-for-artists-to-help-shape-bathurst-hospital-redevelopment',
    name: 'Bathurst Hospital Redevelopment — 2D artworks for health facility',
  },
  {
    url: 'https://artafricamagazine.org/the-theatre-of-light-an-international-call-for-a-site-specific-artwork/',
    name: 'Teatro Goldoni Livorno — international site-specific artwork (no nationality limit)',
  },
]

const SEARCH_EXCLUDES =
  '-facebook -instagram -etsy -amazon -olx -pinterest -shop -blog -prints -muralist -"wall painting" -coatings -"painting contractors" -"paint by numbers" -"картини за номерами" -"artist bio" -"available works" -"represented by" -forecast -trend'

const SEARCH_QUERIES: SearchQuery[] = [
  {
    q: `site:prozorro.gov.ua/uk/tender (живопис OR "оригінальні картини" OR "твори мистецтва" OR "художні полотна") 2026 -фарба -емаль -малярний ${SEARCH_EXCLUDES}`,
    locale: { gl: 'ua', hl: 'uk' },
  },
  {
    q: `"закупівля" (живопис OR "оригінальні картини") (готель OR лікарня OR університет OR офіс OR холл OR лобі) 2026 ${SEARCH_EXCLUDES}`,
    locale: { gl: 'ua', hl: 'uk' },
  },
  {
    q: `"оформлення" (інтер'єру OR простору OR лобі OR холу OR офісу OR готелю OR лікарні) (картинами OR живописом OR полотнами) ${SEARCH_EXCLUDES}`,
    locale: { gl: 'ua', hl: 'uk' },
  },
  {
    q: `"international call" OR "open to international artists" OR "no nationality restriction" (artwork OR paintings OR "site-specific") (hotel OR hospital OR theatre OR library OR lobby) 2026 ${SEARCH_EXCLUDES}`,
    locale: { gl: 'us', hl: 'en' },
  },
  {
    q: `(RFQ OR RFP OR EOI OR "request for qualifications") ("original paintings" OR "fine art" OR "site-specific artwork") (hotel OR hospital OR library OR lobby OR theatre) 2026 ${SEARCH_EXCLUDES}`,
    locale: { gl: 'us', hl: 'en' },
  },
  {
    q: `"art for interiors" OR "artwork for commercial spaces" OR "lobby artwork" ("original paintings" OR "fine art") (hotel OR hospital OR office) ${SEARCH_EXCLUDES}`,
    locale: { gl: 'uk', hl: 'en' },
  },
  {
    q: `site:ted.europa.eu ("works of art" OR "original paintings") (acquisition OR commission OR supply) 2026 ${SEARCH_EXCLUDES}`,
    locale: { gl: 'de', hl: 'en' },
  },
  
  {
    q: `"site-specific artwork" (RFQ OR EOI OR "expression of interest") (library OR hospital OR theatre OR "community centre") 2026 -facebook -instagram -etsy -amazon -directory`,
    locale: { gl: 'us', hl: 'en' },
  },
]

const FALLBACK_QUERIES: SearchQuery[] = [
  {
    q: `(hotel OR hospital OR university OR municipality) ("purchase original artwork" OR "commission original paintings" OR "art for lobby") ${SEARCH_EXCLUDES}`,
    locale: { gl: 'us', hl: 'en' },
  },
  {
    q: `"картини для" (готелю OR лікарні OR офісу OR ресторану OR холу) (закупівля OR замовити OR потрібні) ${SEARCH_EXCLUDES}`,
    locale: { gl: 'ua', hl: 'uk' },
  },
]

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return authHeader === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

function normalizeSubtype(raw: string | undefined) {
  const value = String(raw || 'other').trim()
  return (ALLOWED_SUBTYPES as readonly string[]).includes(value) ? value : 'other'
}

function cleanText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 9000)
}

function isValidHttpUrl(raw: string | undefined | null): raw is string {
  if (!raw) return false
  try {
    const parsed = new URL(raw.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function canonicalSourceUrl(raw: string | undefined | null): string {
  const normalized = normalizeCommercialSourceUrl(raw)
  if (normalized) return normalized
  return isValidHttpUrl(raw) ? String(raw).trim() : ''
}

function inferCountry(rawCountry: string | undefined, sourceUrl: string, queryLocale?: SearchLocale): string {
  const value = String(rawCountry || '').trim()
  if (value) return value.slice(0, 80)

  const url = sourceUrl.toLowerCase()
  if (/akimbo\.ca/.test(url)) return 'Canada'
  if (/nsw\.gov\.au/.test(url)) return 'Australia'
  if (/goldoni|livorno|artafricamagazine/.test(url)) return 'Italy'
  if (/\.ua\b|ukraine|україн/.test(url)) return 'Україна'
  if (/\.uk\b|united kingdom|\.de\b|\.fr\b|\.it\b|\.nl\b|\.pl\b|europe|eu\b/.test(url)) return 'Europe'
  if (/\.us\b|united states|usa/.test(url)) return 'USA'
  if (queryLocale?.gl === 'ua') return 'Україна'
  if (queryLocale?.gl === 'us') return 'USA'
  if (queryLocale?.gl === 'uk' || queryLocale?.gl === 'de' || queryLocale?.gl === 'fr') return 'Europe'
  if (queryLocale?.gl === 'au') return 'Australia'
  return 'International'
}

function inferCurrency(rawCurrency: string | undefined, country: string): string | null {
  const value = String(rawCurrency || '').trim().toUpperCase()
  if (value === 'UAH' || value === 'EUR' || value === 'USD' || value === 'GBP' || value === 'AUD') return value
  if (country === 'Україна') return 'UAH'
  if (country === 'USA') return 'USD'
  if (country === 'Australia') return 'AUD'
  if (country === 'Europe') return 'EUR'
  return null
}
function sourceNameSafe(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}
function stripListingChrome(text: string) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/Akimbo Art Close Listings|Akimblog|Subscribe|Advertise|Contact|About Us|Terms of Service|Privacy Policy|Back to Listings|Skip to (navigation|content|main content)|Open Menu|Close Menu/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDeadlineFromBlob(text: string): string | null {
  const raw = String(text || '')
  const iso = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const m = raw.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i)
  if (!m) return null
  const month = months[m[1].toLowerCase().replace(/\./g, '')]
  if (!month) return null
  const day = m[2].length === 1 ? `0${m[2]}` : m[2]
  return `${m[3]}-${month}-${day}`
}

function extractBudgetFromBlob(text: string): { budget: string | null; currency: string | null } {
  const raw = String(text || '')
  const cad = raw.match(/\$\s*([\d,]{3,})(?:\s*CAD)?/i)
  if (cad && /cad|canada|akimbo/i.test(raw)) return { budget: cad[1].replace(/,/g, ''), currency: 'CAD' }
  const usd = raw.match(/\$\s*([\d,]{3,})/)
  if (usd) return { budget: usd[1].replace(/,/g, ''), currency: 'USD' }
  const eur = raw.match(/€\s*([\d.,]{3,})/)
  if (eur) return { budget: eur[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', ''), currency: 'EUR' }
  return { budget: null, currency: null }
}

function isKeepableCommercialItem(item: CommercialItem) {
  if (!isValidHttpUrl(item.source_url)) return false
  if (/facebook\.com|fb\.com|instagram\.com/i.test(item.source_url)) return false
  if (/akimbo\.ca/i.test(item.source_url)) return false
  if (/gsa\.acgov\.org\/do-business-with-us\/contracting-opportunities\/?$/i.test(item.source_url)) return false
  return isRealBuyerRequest({
    title: item.title,
    description: item.description,
    what_is_needed: item.what_is_needed,
    organization: item.organization,
    source_url: item.source_url,
    deadline: item.deadline,
  })
}

function isHardSkipUrl(title: string, snippet: string, url: string): boolean {
  const combined = `${title}\n${snippet}\n${url}`
  if (!isValidHttpUrl(url)) return true
  if (/facebook\.com|fb\.com|instagram\.com/i.test(url)) return true
  if (isSellerOrPlanText(combined)) return true
  if (isWallTradeNotArt(combined)) return true
  return shouldSkipSearchResult(title, snippet, url)
}

async function fetchPageText(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 7000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; POVODYRBot/1.0; +https://povodyr.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    return cleanText(html)
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

async function searchSerper(query: string, locale: SearchLocale): Promise<{ title: string; url: string; content: string }[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 8, gl: locale.gl, hl: locale.hl }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.organic || []).map((item: any) => ({
      title: String(item.title || ''),
      url: String(item.link || ''),
      content: String(item.snippet || ''),
    }))
  } catch {
    return []
  }
}

async function searchBrave(query: string): Promise<{ title: string; url: string; content: string }[]> {
  const key = process.env.BRAVE_API_KEY
  if (!key) return []
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': key,
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.web?.results || []).map((item: any) => ({
      title: String(item.title || ''),
      url: String(item.url || ''),
      content: String(item.description || ''),
    }))
  } catch {
    return []
  }
}

async function searchWeb(query: SearchQuery): Promise<{ title: string; url: string; content: string }[]> {
  const serper = await searchSerper(query.q, query.locale)
  if (serper.length) return serper
  const brave = await searchBrave(query.q)
  if (brave.length) return brave
  return []
}

async function extractCommercialItems(
  sourceName: string,
  sourceUrl: string,
  text: string,
  queryLocale?: SearchLocale
): Promise<CommercialItem[]> {
  if (!process.env.OPENAI_API_KEY || text.length < 80) return []

   // Навіщо: той самий промпт і json, але облік токенів/USD через шлюз.
  // Гейти й пошукові запити не змінюємо.
  let raw = '{"items":[]}'
  try {
    const completion = await completeCheap('commercial_extract', {
      messages: [
        {
          role: 'system',
          content: `Ти аналітик арт-ринку для сервісу POVODYR.
З тексту витягни ЛИШЕ реальні комерційні запити покупця/замовника на картини або оригінальний живопис:
купівля картин, комісії, тендери, RFP, оформлення картинами громадських і комерційних просторів (готель, лікарня, офіс, лобі, університет, ресторан), корпоративні колекції.
Географія: будь-яка країна. Україна, Європа, США, Канада, Азія, Близький Схід, Австралія — без обмежень.
Ігноруй Facebook, Instagram, новини, виставки «to display» без гонорару, гранти на навчання, резиденції без комісії, вакансії, магазини, блоги художників, картини за номерами, плани закупівель e-lot /plans/ і UA-P- за минулі роки.
НЕ ігноруй RFQ / RFP / EOI / request for qualifications / site-specific / public art, якщо інституція платить fee, production budget або бере роботу в колекцію.
Ігноруй «looking for artist / шукаємо художника», якщо немає купівлі, комісії, RFQ або гонорару за роботу.
Ігноруй малярні тендери (фарба, емаль, wall painting, coatings, framing services, graffiti, мураліст як вакансія).
source_url має бути прямим http/https посиланням на тендер, RFP або сторінку замовника. Не вигадуй URL.
Поверни JSON:
{ "items": [{
  "title": "коротка назва запиту",
  "description": "1-3 речення",
  "what_is_needed": "що саме потрібно (бажано картини / живопис)",
  "organization": "організація або автор оголошення",
  "city": "місто або порожньо",
  "country": "країна (Україна, USA, Germany, France, Australia, International тощо)",
  "subtype": "один з: interior_designer|gallery|hotel|restaurant|corporate_space|collector|art_consultant|developer|commercial_project|commission|art_rental|exhibition_for_sale|collaboration|other",
  "budget": "сума або null",
  "currency": "UAH|EUR|USD|GBP|AUD|null",
  "source_url": "пряме посилання якщо є, інакше джерело",
  "contact_person": "якщо є",
  "contact_method": "email/телефон якщо є",
  "deadline": "ISO-дата дедлайну якщо явно є, інакше null"
}]}
Якщо комерційних запитів немає — { "items": [] }.`,
        },
        {
          role: 'user',
          content: `Джерело: ${sourceName}\nURL: ${sourceUrl}\n\nТекст:\n${text}`,
        },
      ],
      temperature: 0.2,
      json: true,
      source: sourceUrl,
    })
    raw = completion.text || '{"items":[]}'
  } catch (err) {
    console.warn('[ingest-commercial] completeCheap', err)
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    const items = parsed.items || parsed.opportunities || []
    return (items as any[])
      .filter((item) => item && item.title && String(item.title).trim().length > 6)
      .map((item) => {
                const extractedUrl = canonicalSourceUrl(item.source_url)
        const fetchedUrl = canonicalSourceUrl(sourceUrl) || sourceUrl
        const sameHost =
          extractedUrl &&
          fetchedUrl &&
          (() => {
            try {
              return new URL(extractedUrl).host === new URL(fetchedUrl).host
            } catch {
              return false
            }
          })()
        const source_url = sameHost ? extractedUrl : fetchedUrl
        const country = inferCountry(item.country, String(source_url), queryLocale)
        return {
          title: stripListingChrome(String(item.title)).slice(0, 220),
          description: stripListingChrome(String(item.description || item.what_is_needed || '')).slice(0, 1200),
          what_is_needed: String(item.what_is_needed || item.description || '').slice(0, 800),
          organization: String(item.organization || sourceName).slice(0, 180),
          city: item.city ? String(item.city).slice(0, 80) : '',
          country,
          subtype: normalizeSubtype(item.subtype),
          budget: item.budget ?? extractBudgetFromBlob(`${item.title} ${item.description} ${item.what_is_needed}`).budget,
          currency: inferCurrency(item.currency, country) || extractBudgetFromBlob(`${item.title} ${item.description}`).currency,
          source_url: String(source_url).slice(0, 500),
          contact_person: item.contact_person || null,
          contact_method: item.contact_method || null,
          deadline: item.deadline
            ? String(item.deadline).slice(0, 40)
            : extractDeadlineFromBlob(`${item.title} ${item.description} ${item.what_is_needed}`),
        }
      })
      .filter((item) => isKeepableCommercialItem(item))
  } catch {
    return []
  }
}

async function saveIngestRun(payload: {
  success: boolean
  candidates?: number
  inserted?: number
  updated?: number
  error?: string
  logs: string[]
}) {
  try {
    await supabase.from('ingest_runs').insert({
      kind: 'commercial',
      success: payload.success,
      candidates: payload.candidates ?? 0,
      inserted_count: payload.inserted ?? 0,
      updated_count: payload.updated ?? 0,
      error: payload.error || null,
      logs: payload.logs.join('\n').slice(0, 20000),
    })
  } catch {
    // лог не повинен валити інжест
  }
}

async function upsertItem(item: CommercialItem) {
  const { data: existing } = await supabase
    .from('commercial_opportunities')
    .select('id')
    .eq('source_url', item.source_url)
    .maybeSingle()

  const record: Record<string, unknown> = {
    title: item.title,
    description: item.description,
    what_is_needed: item.what_is_needed,
    organization: item.organization,
    city: item.city || null,
    country: item.country || 'International',
    subtype: item.subtype,
    opportunity_type: 'commercial',
    budget: item.budget,
    currency: item.currency || null,
    source_url: item.source_url,
    contact_person: item.contact_person,
    contact_method: item.contact_method,
  }

  if (item.deadline) {
    record.deadline = item.deadline
  }

  if (existing?.id) {
    const { error } = await supabase.from('commercial_opportunities').update(record).eq('id', existing.id)
    return error ? { status: 'error', error: error.message } : { status: 'updated' }
  }

  record.date_added = new Date().toISOString()
  const { error } = await supabase.from('commercial_opportunities').insert(record)
  if (error) return { status: 'error', error: error.message }
  return { status: 'inserted' }
}

async function collectFromSearchQueries(
  queries: SearchQuery[],
  logs: string[]
): Promise<CommercialItem[]> {
  const collected: CommercialItem[] = []

  for (const query of queries) {
    logs.push(`Пошук [${query.locale.gl}/${query.locale.hl}]: ${query.q}`)
    const results = await searchWeb(query)
    logs.push(`сирих результатів: ${results.length}`)
    let kept = 0
    let skippedJunk = 0

    for (const result of results.slice(0, 4)) {
      if (!isValidHttpUrl(result.url)) {
        skippedJunk++
        logs.push(`пропуск без URL: ${result.title}`)
        continue
      }

      if (/facebook\.com|fb\.com|instagram\.com/i.test(result.url)) {
        skippedJunk++
        logs.push(`пропуск соцмережі: ${result.title}`)
        continue
      }

      if (shouldSkipSearchResult(result.title, result.content, result.url)) {
        skippedJunk++
        logs.push(`пропуск сміття (snippet): ${result.title}`)
        continue
      }

      if (isHardSkipUrl(result.title, result.content, result.url)) {
        skippedJunk++
        logs.push(`пропуск вітрини: ${result.title}`)
        continue
      }

      const snippetBlob = `${result.title}\n${result.content}`.trim()
      const pageText = await fetchPageText(result.url)
      const pageBlob = pageText ? `${snippetBlob}\n\n${pageText}` : snippetBlob
      const blob = pageBlob.slice(0, 8000)

      if (isSellerOrPlanText(blob) || isWallTradeNotArt(blob) || isJunkText(blob)) {
        skippedJunk++
        logs.push(`пропуск після сторінки (продавець/сміття): ${result.title}`)
        continue
      }

      if (!hasDemandSignal(blob) && !hasStrongBuyerSignal(blob) && !hasArtPurchaseObject(blob)) {
        skippedJunk++
        logs.push(`пропуск після сторінки (немає об'єкта купівлі): ${result.title}`)
        continue
      }

      logs.push(
        pageText
          ? `сторінка: ${result.url} (${pageText.length} символів)`
          : `сторінка порожня, snippet: ${result.url}`
      )

      let items = await extractCommercialItems(result.title || query.q, result.url, blob, query.locale)
      if (!items.length) {
        const dropReason = 'empty-or-filtered'
        const paid =
          /akimbo\.ca\/listings|request-for-qualifications|\/rfq|\/rfp/i.test(result.url) ||
          /RFQ|RFP|EOI|request for qualifications|site-specific|public art|artist[''`s]?\s*fee|production budget/i.test(blob)
        if (paid) {
          const country = inferCountry('', result.url, query.locale)
          const fallback: CommercialItem = {
            title: stripListingChrome(String(result.title || sourceNameSafe(result.url))).slice(0, 220),
            description: stripListingChrome(blob).slice(0, 600),
            what_is_needed: 'Public artwork / site-specific commission (RFQ / EOI)',
            organization: stripListingChrome(String(result.title || 'Institution')).slice(0, 180),
            city: '',
            country,
            subtype: 'commercial_project',
            budget: extractBudgetFromBlob(blob).budget,
            currency: extractBudgetFromBlob(blob).currency || inferCurrency(undefined, country),
            source_url: canonicalSourceUrl(result.url) || result.url,
            contact_person: null,
            contact_method: null,
            deadline: extractDeadlineFromBlob(blob),
          }
          if (isKeepableCommercialItem(fallback)) {
            items = [fallback]
            logs.push(`GPT дав 0 — картка зі сторінки (RFQ/commission): ${result.url}`)
          } else {
            logs.push(`drop after GPT: reason=${dropReason}, fallback rejected: ${result.url}`)
          }
        } else {
          logs.push(`drop after GPT: reason=${dropReason}: ${result.url}`)
        }
      }
      kept += items.length
      logs.push(`після фільтра GPT: ${items.length}`)
      collected.push(...items)
    }

    logs.push(`запит «${query.q}»: raw=${results.length}, skipped_junk=${skippedJunk}, kept=${kept}`)
  }

  return collected
}

export async function GET(request: NextRequest) {
  const logs: string[] = []
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY не налаштовано' }, { status: 500 })
    }

    const collected: CommercialItem[] = []

            for (const source of CURATED_SOURCES) {
      logs.push(`Джерело: ${source.name}`)
      const text = await fetchPageText(source.url)
      if (!text) {
        logs.push(`сирих: 0 → після фільтра: 0 (порожня відповідь)`)
        continue
      }
      if (isSellerOrPlanText(text) || isWallTradeNotArt(text) || isArtistSaleEvent(text)) {
        logs.push(`сирих: 1 сторінка → після фільтра: 0 (продавець/ярмарок)`)
        continue
      }

      let items = await extractCommercialItems(source.name, source.url, text)
      if (!items.length) {
        const country = inferCountry('', source.url)
        items = [
          {
            title: stripListingChrome(source.name).slice(0, 220),
            description: stripListingChrome(text).slice(0, 600),
            what_is_needed: 'Public artwork / site-specific commission (RFQ / EOI)',
            organization: stripListingChrome(source.name).slice(0, 180),
            city: '',
            country,
            subtype: 'commercial_project',
            budget: extractBudgetFromBlob(text).budget,
            currency: extractBudgetFromBlob(text).currency || inferCurrency(undefined, country),
            source_url: canonicalSourceUrl(source.url) || source.url,
            contact_person: null,
            contact_method: null,
            deadline: extractDeadlineFromBlob(text),
          },
        ]
        logs.push('GPT дав 0 — картка зібрана зі сторінки джерела')
      }

      logs.push(`сирих: 1 сторінка → після фільтра: ${items.length}`)
      collected.push(...items)
    }

    const curatedOnly = request.nextUrl.searchParams.get('mode') === 'curated'
    const hasSearch = !curatedOnly && !!(process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY)
    if (curatedOnly) {
      logs.push('mode=curated — пошук Serper пропущено')
    }
    if (hasSearch) {
      logs.push(process.env.SERPER_API_KEY ? 'Пошук через Serper (світ, без ліміту країни)' : 'Пошук через Brave')
      collected.push(...(await collectFromSearchQueries(SEARCH_QUERIES, logs)))

      if (collected.length === 0) {
        logs.push('0 кандидатів після основного пошуку — fallback-запити з тим самим гейтом')
        collected.push(...(await collectFromSearchQueries(FALLBACK_QUERIES, logs)))
      }
    } else {
      logs.push('SERPER_API_KEY / BRAVE_API_KEY немає — працюємо лише по списку джерел')
    }

    const unique = new Map<string, CommercialItem>()
    const seenTitles = new Map<string, string>()
    const incoming = collected.slice()
    for (let i = 0; i < incoming.length; i += 1) {
      const item = incoming[i]
      if (!isKeepableCommercialItem(item)) continue
      item.source_url = canonicalSourceUrl(item.source_url) || item.source_url
      const urlKey = item.source_url || ''
      const titleKey = titleFingerprint(item.title)
      if (!urlKey) continue
      if (unique.has(urlKey)) continue
      if (titleKey && seenTitles.has(titleKey)) continue
      unique.set(urlKey, item)
      if (titleKey) seenTitles.set(titleKey, urlKey)
    }

    let inserted = 0
    let updated = 0
    const errors: string[] = []
    const uniqueItems = Array.from(unique.values())

    for (let i = 0; i < uniqueItems.length; i += 1) {
      const item = uniqueItems[i]
      const result = await upsertItem(item)
      if (result.status === 'inserted') inserted++
      else if (result.status === 'updated') updated++
      else if (result.status === 'error') errors.push(`${item.title}: ${result.error}`)
    }

    logs.push(`готово: candidates=${unique.size}, inserted=${inserted}, updated=${updated}`)

    await saveIngestRun({
      success: true,
      candidates: unique.size,
      inserted,
      updated,
      logs,
    })

    return NextResponse.json({
      success: true,
      scanned_sources: CURATED_SOURCES.length,
      candidates: unique.size,
      inserted,
      updated,
      errors: errors.length ? errors : undefined,
      logs,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    await saveIngestRun({
      success: false,
      error: err.message || 'Unknown error',
      logs,
    })
    return NextResponse.json({ success: false, error: err.message || 'Unknown error', logs }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
