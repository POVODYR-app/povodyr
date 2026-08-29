import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

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

const CURATED_SOURCES = [
  { url: 'https://prozorro.gov.ua/uk/search?query=%D0%BA%D0%B0%D1%80%D1%82%D0%B8%D0%BD%D0%B8', name: 'Prozorro — картини' },
  { url: 'https://prozorro.gov.ua/uk/search?query=%D0%BE%D1%84%D0%BE%D1%80%D0%BC%D0%BB%D0%B5%D0%BD%D0%BD%D1%8F%20%D1%96%D0%BD%D1%82%D0%B5%D1%80%27%D1%94%D1%80%D1%83', name: 'Prozorro — інтер’єр' },
  { url: 'https://www.olx.ua/uk/hobbi-otdyh-i-sport/iskusstvo/', name: 'OLX — мистецтво' },
  { url: 'https://prom.ua/ua/Kartiny', name: 'Prom.ua — картини' },
  { url: 'https://www.work.ua/jobs-ukraine-dizajner+inter-eru/', name: 'Work.ua — дизайнери інтер’єру' },
  { url: 'https://houseofeurope.org.ua/', name: 'House of Europe' },
  { url: 'https://ucf.in.ua/', name: 'Український культурний фонд' },
]

const SEARCH_QUERIES = [
  'шукаємо картини для готелю Україна',
  'закупівля картин для офісу тендер',
  'дизайнер інтер’єру шукає художника картини на замовлення',
  'галерея open call продаж картин Україна 2026',
  'art for hotel interiors call for artists',
  'commission original paintings restaurant interior',
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
З тексту витягни ЛИШЕ реальні комерційні запити: купівля картин, комісії, арт для готелів/ресторанів/офісів, галерейний продаж, оренда мистецтва, колаборації з бізнесом.
Ігноруй новини, open call без продажу, гранти, резиденції, вакансії без закупівлі мистецтва, рекламу магазинів «продаємо рамки».
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
  "contact_method": "email/телефон якщо є"
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
      .map((item) => ({
        title: String(item.title).slice(0, 220),
        description: String(item.description || item.what_is_needed || '').slice(0, 1200),
        what_is_needed: String(item.what_is_needed || item.description || '').slice(0, 800),
        organization: String(item.organization || sourceName).slice(0, 180),
        city: item.city ? String(item.city).slice(0, 80) : '',
        country: item.country ? String(item.country).slice(0, 80) : 'Україна',
        subtype: normalizeSubtype(item.subtype),
        budget: item.budget ?? null,
        currency: item.currency || 'UAH',
        source_url: String(item.source_url || sourceUrl).slice(0, 500),
        contact_person: item.contact_person || null,
        contact_method: item.contact_method || null,
      }))
  } catch {
    return []
  }
}

async function upsertItem(item: CommercialItem) {
  const { data: existing } = await supabase
    .from('commercial_opportunities')
    .select('id')
    .eq('source_url', item.source_url)
    .maybeSingle()

  const record = {
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
    date_added: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabase.from('commercial_opportunities').update(record).eq('id', existing.id)
    return error ? { status: 'error', error: error.message } : { status: 'updated' }
  }

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
        logs.push(`порожня відповідь: ${source.url}`)
        continue
      }
      const items = await extractCommercialItems(source.name, source.url, text)
      logs.push(`знайдено ${items.length} запитів`)
      collected.push(...items)
    }

    const hasSearch = !!(process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY)
    if (hasSearch) {
      logs.push(process.env.SERPER_API_KEY ? 'Пошук через Serper' : 'Пошук через Brave')
      for (const query of SEARCH_QUERIES) {
        logs.push(`Пошук: ${query}`)
        const results = await searchWeb(query)
        logs.push(`результатів: ${results.length}`)
        for (const result of results.slice(0, 3)) {
          if (!result.url) continue
          const blob = `${result.title}\n${result.content}`.slice(0, 4000)
          const items = await extractCommercialItems(result.title || query, result.url, blob)
          collected.push(...items)
        }
      }
    } else {
      logs.push('SERPER_API_KEY / BRAVE_API_KEY немає — працюємо лише по списку джерел')
    }

    const unique = new Map<string, CommercialItem>()
    for (const item of collected) {
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
    return NextResponse.json({ success: false, error: err.message || 'Unknown error', logs }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
