import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import {
  hasDemandSignal,
  isJunkText,
  isRealBuyerRequest,
  normalizeCommercialSourceUrl,
  shouldSkipSearchResult,
} from '../../../lib/commercialDemandGate'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

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

const CURATED_SOURCES: { url: string; name: string }[] = []

const SEARCH_QUERIES = [
  'куплю картину Україна',
  'шукаю картини для інтер’єру купити Україна',
  'шукаємо картини для готелю Україна',
  'ресторан шукає картини на замовлення Україна',
  'дизайнер інтер’єру шукає художника картини на замовлення',
  'галерея шукає художника купівля робіт Україна',
  'офіс шукає картини купити Україна',
  'corporate art collection looking for artists Ukraine',
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

function isKeepableCommercialItem(item: CommercialItem) {
  if (!isValidHttpUrl(item.source_url)) return false
  return isRealBuyerRequest({
    title: item.title,
    description: item.description,
    what_is_needed: item.what_is_needed,
    organization: item.organization,
    source_url: item.source_url,
    deadline: item.deadline,
  })
}

async function fetchPageText(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
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

async function searchSerper(query: string): Promise<{ title: string; url: string; content: string }[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5, gl: 'ua', hl: 'uk' }),
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
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
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

async function searchWeb(query: string): Promise<{ title: string; url: string; content: string }[]> {
  const serper = await searchSerper(query)
  if (serper.length) return serper
  const brave = await searchBrave(query)
  if (brave.length) return brave
  return []
}

async function extractCommercialItems(sourceName: string, sourceUrl: string, text: string): Promise<CommercialItem[]> {
  if (!process.env.OPENAI_API_KEY || text.length < 120) return []

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `Ти аналітик арт-ринку для сервісу POVODYR.
З тексту витягни ЛИШЕ реальні комерційні запити покупця/замовника: купівля картин, комісії, арт для готелів/ресторанів/офісів, галерейний запит робіт художника, оренда мистецтва, колаборації з бізнесом.
Ігноруй новини, open call без продажу, гранти, резиденції, вакансії, магазини рамок/готових картин, каталоги продавців, вітрини «купити картину», маркетплейси продавця, плани закупівель і сторінки на кшталт e-lot /plans/ або UA-P- за минулі роки.
source_url має бути прямим http/https посиланням на оголошення або сторінку замовника. Не вигадуй URL.
Поверни JSON:
{ "items": [{
  "title": "коротка назва запиту",
  "description": "1-3 речення",
  "what_is_needed": "що саме потрібно",
  "organization": "організація або автор оголошення",
  "city": "місто або порожньо",
  "country": "Україна або інша країна",
  "subtype": "один з: interior_designer|gallery|hotel|restaurant|corporate_space|collector|art_consultant|developer|commercial_project|commission|art_rental|exhibition_for_sale|collaboration|other",
  "budget": "сума або null",
  "currency": "UAH|EUR|USD|null",
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
  })

  const raw = completion.choices[0]?.message?.content || '{"items":[]}'
  try {
    const parsed = JSON.parse(raw)
    const items = parsed.items || parsed.opportunities || []
    return (items as any[])
      .filter((item) => item && item.title && String(item.title).trim().length > 6)
      .map((item) => {
        const extractedUrl = canonicalSourceUrl(item.source_url)
        const source_url = extractedUrl || canonicalSourceUrl(sourceUrl) || sourceUrl
        return {
          title: String(item.title).slice(0, 220),
          description: String(item.description || item.what_is_needed || '').slice(0, 1200),
          what_is_needed: String(item.what_is_needed || item.description || '').slice(0, 800),
          organization: String(item.organization || sourceName).slice(0, 180),
          city: item.city ? String(item.city).slice(0, 80) : '',
          country: item.country ? String(item.country).slice(0, 80) : 'Україна',
          subtype: normalizeSubtype(item.subtype),
          budget: item.budget ?? null,
          currency: item.currency || 'UAH',
          source_url: String(source_url).slice(0, 500),
          contact_person: item.contact_person || null,
          contact_method: item.contact_method || null,
          deadline: item.deadline ? String(item.deadline).slice(0, 40) : null,
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
    country: item.country || 'Україна',
    subtype: item.subtype,
    opportunity_type: 'commercial',
    budget: item.budget,
    currency: item.currency || 'UAH',
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
      if (isJunkText(text) && !hasDemandSignal(text)) {
        logs.push(`сирих: 1 сторінка → після фільтра: 0 (сміття/не запит покупця)`)
        continue
      }
      if (shouldSkipSearchResult(source.name, text.slice(0, 500), source.url)) {
        logs.push(`сирих: 1 сторінка → після фільтра: 0 (вітрина/план/не попит)`)
        continue
      }
      const items = await extractCommercialItems(source.name, source.url, text)
      logs.push(`сирих: 1 сторінка → після фільтра: ${items.length}`)
      collected.push(...items)
    }

    const hasSearch = !!(process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY)
    if (hasSearch) {
      logs.push(process.env.SERPER_API_KEY ? 'Пошук через Serper' : 'Пошук через Brave')
      for (const query of SEARCH_QUERIES) {
        logs.push(`Пошук: ${query}`)
        const results = await searchWeb(query)
        logs.push(`сирих результатів: ${results.length}`)
        let kept = 0
        let skippedJunk = 0
        for (const result of results.slice(0, 3)) {
          if (!isValidHttpUrl(result.url)) {
            skippedJunk++
            logs.push(`пропуск без URL: ${result.title}`)
            continue
          }
          if (shouldSkipSearchResult(result.title, result.content, result.url)) {
            skippedJunk++
            logs.push(`пропуск сміття: ${result.title}`)
            continue
          }
          const snippetBlob = `${result.title}\n${result.content}`.trim()
          const pageText = await fetchPageText(result.url)
          const blob = (pageText
            ? `${snippetBlob}\n\n${pageText}`
            : snippetBlob
          ).slice(0, 8000)

          logs.push(
            pageText
              ? `сторінка: ${result.url} (${pageText.length} символів)`
              : `сторінка порожня, snippet: ${result.url}`
          )

          const items = await extractCommercialItems(result.title || query, result.url, blob)
          kept += items.length
          logs.push(`після фільтра GPT: ${items.length}`)
          collected.push(...items)
        }
        logs.push(`запит «${query}»: raw=${results.length}, skipped_junk=${skippedJunk}, kept=${kept}`)
      }
    } else {
      logs.push('SERPER_API_KEY / BRAVE_API_KEY немає — працюємо лише по списку джерел')
    }

    const unique = new Map<string, CommercialItem>()
    for (const item of collected) {
      if (!isKeepableCommercialItem(item)) continue
      item.source_url = canonicalSourceUrl(item.source_url) || item.source_url
      const key = item.source_url || item.title
      if (!unique.has(key)) unique.set(key, item)
    }

    let inserted = 0
    let updated = 0
    const errors: string[] = []

    for (const item of Array.from(unique.values())) {
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
