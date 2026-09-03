import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  fetchFromApprovedSources,
  type ParsedOpportunity,
} from '../../../lib/parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const AFN_CANONICAL_URL = 'https://sites.google.com/view/artfinenation/open-call'
const AFN_TITLE =
  'Art Fine Nation Перша українська мистецька агенція — Open Call виставки, конкурси, пленери'
const AFN_DESCRIPTION =
  'Перша українська мистецька агенція Art Fine Nation. Open call: виставки, конкурси, пленери для художників України.'

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return authHeader === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

function isArtFineNationUrl(raw: string | undefined | null): boolean {
  if (!raw) return false
  return /sites\.google\.com\/view\/artfinenation/i.test(raw) || /artfinenation/i.test(raw)
}

function normalizeUrl(raw: string | undefined | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''

  if (isArtFineNationUrl(value)) {
    return AFN_CANONICAL_URL
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    parsed.hash = ''
    parsed.searchParams.delete('read_current')
    parsed.searchParams.delete('utm_source')
    parsed.searchParams.delete('utm_medium')
    parsed.searchParams.delete('utm_campaign')
    parsed.searchParams.delete('utm_term')
    parsed.searchParams.delete('utm_content')
    parsed.hostname = parsed.hostname.toLowerCase()
    let href = parsed.toString()
    if (href.endsWith('/') && parsed.pathname !== '/') {
      href = href.slice(0, -1)
    }
    return href
  } catch {
    return value
  }
}

function buildAfnCard(): ParsedOpportunity {
  return {
    source_name: 'Art Fine Nation',
    title: AFN_TITLE,
    link: AFN_CANONICAL_URL,
    source_url: AFN_CANONICAL_URL,
    type: 'open_call',
    deadline: null,
    country: 'Україна',
    is_free: true,
    cost_amount: 0,
    cost_currency: 'UAH',
    genres: ['Образотворче мистецтво', 'Живопис', 'Графіка', 'Колаж', 'Скульптура'],
    techniques: ['Олія', 'Акрил', 'Змішана техніка'],
    artist_levels: ['Emerging', 'Mid-Career', 'Established'],
    age_restrictions: 'None',
    languages: ['uk'],
    ukrainians_eligible: true,
    raw_description: AFN_DESCRIPTION,
  }
}

function toRecord(item: ParsedOpportunity, sourceUrl: string, isAfn: boolean) {
  const now = new Date().toISOString()
  return {
    title: isAfn ? AFN_TITLE : String(item.title || '').slice(0, 280),
    description: isAfn ? AFN_DESCRIPTION : String(item.raw_description || item.title || '').slice(0, 2000),
    raw_description: isAfn ? AFN_DESCRIPTION : String(item.raw_description || '').slice(0, 4000),
    source_url: sourceUrl,
    type: isAfn ? 'open_call' : String(item.type || 'open_call').slice(0, 80),
    country: isAfn ? 'Україна' : String(item.country || 'International').slice(0, 120),
    eligible_countries: ['Україна', 'International'],
    ukrainians_eligible: item.ukrainians_eligible !== false,
    is_free: item.is_free !== false,
    cost_amount: item.cost_amount ?? 0,
    cost_currency: item.cost_currency || 'UAH',
    genres: item.genres || [],
    techniques: item.techniques || [],
    deadline: isAfn ? null : item.deadline || null,
    is_active: true,
    created_at: now,
  }
}

async function upsertOpportunity(item: ParsedOpportunity): Promise<{ status: string; error?: string }> {
  const isAfn = isArtFineNationUrl(item.link) || isArtFineNationUrl(item.source_url) || isArtFineNationUrl(item.title)
  const sourceUrl = isAfn ? AFN_CANONICAL_URL : normalizeUrl(item.source_url || item.link)
  if (!sourceUrl) return { status: 'skipped' }

  const record = toRecord(item, sourceUrl, isAfn)

  if (isAfn) {
    const { data: afnRows, error: afnError } = await supabase
      .from('opportunities')
      .select('id, source_url')
      .or('source_url.ilike.%artfinenation%,title.ilike.%Art Fine Nation%,title.ilike.%Всеукраїнський Open Call%,title.ilike.%Календар конкурсів%')
      .limit(20)

    if (afnError) return { status: 'error', error: afnError.message }

    const rows = afnRows || []
    let keeperId: string | null = null
    for (let i = 0; i < rows.length; i += 1) {
      if (normalizeUrl(rows[i].source_url) === AFN_CANONICAL_URL) {
        keeperId = rows[i].id
        break
      }
    }
    if (!keeperId && rows.length > 0) keeperId = rows[0].id

    if (keeperId) {
      const { error } = await supabase.from('opportunities').update(record).eq('id', keeperId)
      if (error) return { status: 'error', error: error.message }

      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].id !== keeperId) {
          await supabase.from('opportunities').update({ is_active: false }).eq('id', rows[i].id)
        }
      }
      return { status: 'updated' }
    }

    const { error } = await supabase.from('opportunities').insert(record)
    if (error) return { status: 'error', error: error.message }
    return { status: 'inserted' }
  }

  const { data: existing, error: findError } = await supabase
    .from('opportunities')
    .select('id')
    .eq('source_url', sourceUrl)
    .maybeSingle()

  if (findError) return { status: 'error', error: findError.message }

  if (existing?.id) {
    const { error } = await supabase.from('opportunities').update(record).eq('id', existing.id)
    if (error) return { status: 'error', error: error.message }
    return { status: 'updated' }
  }

  const { error } = await supabase.from('opportunities').insert(record)
  if (error) return { status: 'error', error: error.message }
  return { status: 'inserted' }
}

export async function GET(request: NextRequest) {
  const logs: string[] = []
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    logs.push('Календарний ingest: fetchFromApprovedSources')
    const rawItems = await fetchFromApprovedSources(logs)
    logs.push(`сирих: ${rawItems.length}`)

    const unique = new Map<string, ParsedOpportunity>()
    unique.set(AFN_CANONICAL_URL, buildAfnCard())

    for (let i = 0; i < rawItems.length; i += 1) {
      const item = rawItems[i]
      if (!item || !item.title) continue
      const isAfn = isArtFineNationUrl(item.link) || isArtFineNationUrl(item.source_url) || isArtFineNationUrl(item.title)
      if (isAfn) continue
      const key = normalizeUrl(item.source_url || item.link)
      if (!key) continue
      if (!unique.has(key)) unique.set(key, item)
    }

    const candidates = Array.from(unique.values())
    logs.push(`після фільтра / дедуп: ${candidates.length} (AFN = 1 картка, без дедлайну)`)

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < candidates.length; i += 1) {
      const item = candidates[i]
      const result = await upsertOpportunity(item)
      if (result.status === 'inserted') inserted += 1
      else if (result.status === 'updated') updated += 1
      else if (result.status === 'skipped') skipped += 1
      else if (result.status === 'error') {
        skipped += 1
        errors.push(`${item.title}: ${result.error}`)
      }
    }

    logs.push(`готово: inserted=${inserted}, updated=${updated}, skipped=${skipped}`)
        const listingTitlePatterns = [
      '%Актуальний Open Call та події%',
      '%Актуальні гранти та конкурсні програми%',
    ]
    let deactivatedListings = 0
    for (let i = 0; i < listingTitlePatterns.length; i += 1) {
      const { data: listingRows } = await supabase
        .from('opportunities')
        .select('id, title')
        .ilike('title', listingTitlePatterns[i])
        .eq('is_active', true)
        .limit(50)

      const rows = listingRows || []
      for (let j = 0; j < rows.length; j += 1) {
        const title = String(rows[j].title || '')
        if (/artfinenation/i.test(title)) continue
        await supabase
          .from('opportunities')
          .update({ is_active: false })
          .eq('id', rows[j].id)
        deactivatedListings += 1
      }
    }
    logs.push(`деактивовано лістингів: ${deactivatedListings}`)

    return NextResponse.json({
      success: true,
      raw: rawItems.length,
      after_filter: candidates.length,
      inserted,
      updated,
      skipped,
      errors: errors.length ? errors : undefined,
      logs,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error', logs },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
