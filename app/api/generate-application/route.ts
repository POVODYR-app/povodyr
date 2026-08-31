import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const NAME_PLACEHOLDER = 'Художник'
const MAX_ARTWORKS = 8

type CanonicalArtwork = {
  title: string
  styles: string[]
  techniques: string[]
  materials: string[]
  themes: string[]
  workTypes: string[]
  formatSize: string
}

type CanonicalProfile = {
  name: string
  nameKnown: boolean
  bio: string
  city: string
  country: string
  professionalLevel: string
  artisticStyles: string[]
  techniques: string[]
  materials: string[]
  themes: string[]
  series: string[]
  targetCountries: string[]
  preferredOpportunityTypes: string[]
  artworks: CanonicalArtwork[]
  missingFields: string[]
}

function toArray(raw: any): string[] {
  if (raw === null || raw === undefined || raw === '') return []
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {
      // не JSON
    }
    return trimmed.split(/[,;|/]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function uniqueStrings(values: string[]): string[] {
  const seen: Record<string, boolean> = {}
  const result: string[] = []
  values.forEach((value) => {
    const key = value.toLowerCase()
    if (!key || seen[key]) return
    seen[key] = true
    result.push(value)
  })
  return result
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (let i = 0; i < values.length; i += 1) {
    const value = String(values[i] || '').trim()
    if (value) return value
  }
  return ''
}

function joinOrMissing(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'не вказано'
}

function normalizeArtwork(work: any): CanonicalArtwork | null {
  const title = String(work?.title || '').trim()
  if (!title) return null
  return {
    title,
    styles: uniqueStrings(toArray(work.styles)),
    techniques: uniqueStrings(toArray(work.techniques_list || work.techniques)),
    materials: uniqueStrings(toArray(work.materials)),
    themes: uniqueStrings(toArray(work.themes)),
    workTypes: uniqueStrings(toArray(work.work_types)),
    formatSize: String(work.format_size || work.size_category || '').trim(),
  }
}

function mergeArtworks(primary: any[], secondary: any[]): CanonicalArtwork[] {
  const seen: Record<string, boolean> = {}
  const result: CanonicalArtwork[] = []
  const all = (Array.isArray(primary) ? primary : []).concat(Array.isArray(secondary) ? secondary : [])
  all.forEach((work) => {
    const item = normalizeArtwork(work)
    if (!item) return
    const key = item.title.toLowerCase()
    if (seen[key]) return
    seen[key] = true
    result.push(item)
  })
  return result.slice(0, MAX_ARTWORKS)
}

function buildCanonicalProfile(
  userProfile: any,
  artistRow: any,
  artworksRaw: any[],
  snapshot: any
): CanonicalProfile {
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {}
  const artworkList = mergeArtworks(
    artworksRaw,
    snap.artworks || snap.artist_artworks || []
  )

  const name = firstNonEmpty(
    userProfile?.full_name,
    artistRow?.name,
    snap.full_name,
    snap.name
  )
  const nameKnown = Boolean(name) && name.toLowerCase() !== NAME_PLACEHOLDER.toLowerCase()

  const artisticStyles = uniqueStrings(
    toArray(artistRow?.artistic_styles)
      .concat(toArray(snap.artistic_styles))
      .concat(artworkList.reduce((acc: string[], work) => acc.concat(work.styles), []))
  )
  const techniques = uniqueStrings(
    toArray(userProfile?.profile_techniques)
      .concat(toArray(userProfile?.techniques))
      .concat(toArray(artistRow?.techniques))
      .concat(toArray(snap.techniques))
      .concat(toArray(snap.profile_techniques))
      .concat(artworkList.reduce((acc: string[], work) => acc.concat(work.techniques), []))
  )
  const materials = uniqueStrings(
    toArray(artistRow?.materials)
      .concat(toArray(snap.materials))
      .concat(artworkList.reduce((acc: string[], work) => acc.concat(work.materials), []))
  )
  const themes = uniqueStrings(
    toArray(artistRow?.themes)
      .concat(toArray(snap.themes))
      .concat(artworkList.reduce((acc: string[], work) => acc.concat(work.themes), []))
  )
  const series = uniqueStrings(toArray(artistRow?.series).concat(toArray(snap.series)))
  const targetCountries = uniqueStrings(
    toArray(userProfile?.search_countries)
      .concat(toArray(artistRow?.target_countries))
      .concat(toArray(snap.search_countries))
      .concat(toArray(snap.target_countries))
  )
  const preferredOpportunityTypes = uniqueStrings(
    toArray(artistRow?.preferred_opportunity_types).concat(toArray(snap.preferred_opportunity_types))
  )

  const missingFields: string[] = []
  if (!nameKnown) missingFields.push("ім'я / повне ім'я")
  if (!firstNonEmpty(userProfile?.city, artistRow?.city, snap.city)) missingFields.push('місто')
  if (artisticStyles.length === 0) missingFields.push('стилі')
  if (techniques.length === 0) missingFields.push('техніки')
  if (themes.length === 0) missingFields.push('теми')
  if (artworkList.length === 0) missingFields.push('назви робіт у портфоліо')

  return {
    name: nameKnown ? name : '',
    nameKnown,
    bio: firstNonEmpty(userProfile?.bio, artistRow?.bio, snap.bio),
    city: firstNonEmpty(userProfile?.city, artistRow?.city, snap.city),
    country: firstNonEmpty(userProfile?.country, artistRow?.country, snap.country, 'Україна'),
    professionalLevel: firstNonEmpty(
      userProfile?.artist_level,
      artistRow?.professional_level,
      snap.artist_level,
      snap.professional_level
    ),
    artisticStyles,
    techniques,
    materials,
    themes,
    series,
    targetCountries,
    preferredOpportunityTypes,
    artworks: artworkList,
    missingFields,
  }
}

function formatArtworksBlock(artworks: CanonicalArtwork[]): string {
  if (artworks.length === 0) {
    return 'РЕАЛЬНІ РОБОТИ З ПОРТФОЛІО: немає жодної назви. Не вигадуй назви.'
  }
  const lines = artworks.map((work, index) => {
    const details: string[] = []
    if (work.workTypes.length) details.push(work.workTypes.join(', '))
    if (work.techniques.length) details.push(work.techniques.join(', '))
    if (work.materials.length) details.push(work.materials.join(', '))
    if (work.styles.length) details.push(work.styles.join(', '))
    if (work.themes.length) details.push('теми: ' + work.themes.join(', '))
    if (work.formatSize) details.push(work.formatSize)
    return `${index + 1}. «${work.title}»${details.length ? ' — ' + details.join('; ') : ''}`
  })
  return `РЕАЛЬНІ РОБОТИ З ПОРТФОЛІО (можна згадувати ЛИШЕ ці назви):\n${lines.join('\n')}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      opportunityId,
      opportunityTitle,
      opportunityDescription,
      matchReasons = [],
      userId,
      contactPerson,
      organization,
      isCommercial = false,
      profileSnapshot = null,
    } = body

    if (!opportunityTitle) {
      return NextResponse.json(
        { success: false, error: 'Не вказано назву можливості' },
        { status: 400 }
      )
    }

    let userProfile: any = null
    let artistRow: any = null
    let artworksRaw: any[] = []

    if (userId) {
      const [profileById, artistById, artistByUserId, artworksRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('artist_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('artist_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase
          .from('artist_artworks')
          .select('title, styles, techniques_list, techniques, materials, themes, work_types, format_size, size_category')
          .eq('user_id', userId)
          .limit(MAX_ARTWORKS),
      ])

      userProfile = profileById.data || null
      artistRow = artistById.data || artistByUserId.data || null
      artworksRaw = artworksRes.data || []
    }

    const canonical = buildCanonicalProfile(userProfile, artistRow, artworksRaw, profileSnapshot)

    let userFeedback: any[] = []
    if (userId) {
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(8)
      userFeedback = feedbackData || []
    }

    let previousSuccessful: any[] = []
    if (userId) {
      const { data: apps } = await supabase
        .from('user_applications')
        .select('title, generated_text, status')
        .eq('user_id', userId)
        .in('status', ['submitted', 'accepted', 'used'])
        .order('created_at', { ascending: false })
        .limit(3)
      previousSuccessful = apps || []
    }

    const displayName = canonical.nameKnown
      ? canonical.name
      : "ім'я в профілі не вказано — НЕ підставляй слово «Художник» і НЕ вигадуй ім'я"

    const locationParts: string[] = []
    if (canonical.city) locationParts.push(canonical.city)
    if (canonical.country) locationParts.push(canonical.country)

    const profileBlock = `
ІНФОРМАЦІЯ ПРО ХУДОЖНИКА (використовуй ТІЛЬКИ ці дані):
- Ім'я: ${displayName}
- Країна / місто: ${locationParts.length ? locationParts.join(', ') : 'не вказано'}
- Коротке біо: ${canonical.bio || 'не вказано'}
- Художні стилі: ${joinOrMissing(canonical.artisticStyles)}
- Техніки: ${joinOrMissing(canonical.techniques)}
- Матеріали: ${joinOrMissing(canonical.materials)}
- Теми: ${joinOrMissing(canonical.themes)}
- Серії з профілю: ${joinOrMissing(canonical.series)}
- Професійний рівень: ${canonical.professionalLevel || 'не вказано'}
- Цільові країни: ${joinOrMissing(canonical.targetCountries)}
- Бажані типи можливостей: ${joinOrMissing(canonical.preferredOpportunityTypes)}

${formatArtworksBlock(canonical.artworks)}
`

    const matchBlock = Array.isArray(matchReasons) && matchReasons.length
      ? `\nЧОМУ ЦЯ МОЖЛИВІСТЬ ПІДХОДИТЬ:\n${matchReasons.map((r: string) => `• ${r}`).join('\n')}`
      : ''

    const feedbackBlock = userFeedback.length > 0
      ? `\nЗВОРОТНИЙ ЗВ'ЯЗОК:\n${userFeedback
          .map((f: any) => `• ${f.comment || f.feedback_text || f.note || JSON.stringify(f)}`)
          .join('\n')}`
      : ''

    const historyBlock = previousSuccessful.length > 0
      ? `\nПРИКЛАДИ РАНІШИХ ТЕКСТІВ:\n${previousSuccessful
          .map((p: any, i: number) => `--- Приклад ${i + 1} ---\n${(p.generated_text || '').slice(0, 600)}...`)
          .join('\n\n')}`
      : ''

    const commercialNote = isCommercial
      ? `\nЦе комерційний / B2B запит.
Замовник: ${organization || 'не вказано'}
Контактна особа: ${contactPerson || 'не вказано'}
Текст діловий і конкретний.`
      : `\nЦе заявка на open call / грант / резиденцію / виставку / конкурс.
Організатор лише з назви/опису можливості: ${organization || 'не вигадуй назву'}.
Контактна особа: ${contactPerson || 'не вказано'}.`

    const sparseNote = canonical.missingFields.length > 0
      ? `\nБРАКУЄ: ${canonical.missingFields.join(', ')}. Не заповнюй водою. У рекомендаціях дай 2–3 питання в профіль.`
      : ''

    const prompt = `
Ти — арт-менеджер цього конкретного автора. Пиши лише з фактів нижче.

${profileBlock}
${matchBlock}
${feedbackBlock}
${historyBlock}
${commercialNote}
${sparseNote}

МОЖЛИВІСТЬ:
- Назва: ${opportunityTitle}
- Опис: ${opportunityDescription || 'Детальний опис відсутній'}

Рівно 5 блоків українською:

1. **Супровідний лист** — якщо ім'я відоме, використай його. 1–2 речення «чому я × чому ця програма».
2. **Artist Statement** — стилі / техніки / теми тільки з даних.
3. **Опис проєкту** — під тип можливості з назви/опису. Медіум лише з профілю/робіт.
4. **Перелік робіт** — лише title з блоку реальних робіт і/або серії. Якщо 0 — так і напиши.
5. **Короткі рекомендації** — конкретні, під цю можливість.

Заборони: заглушка «Художник» якщо є ім'я; вигадані роботи, серії, виставки, нагороди, організації.
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "Пиши лише від наданих фактів. Заборонено «Художник», якщо передано інше ім'я. Заборонено вигадувати роботи й нагороди.",
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    })

    const resultText = completion.choices[0]?.message?.content || 'Не вдалося згенерувати документ.'

    if (userId && opportunityId) {
      await supabase.from('user_applications').insert({
        user_id: userId,
        opportunity_id: opportunityId,
        title: opportunityTitle,
        generated_text: resultText,
        status: 'generated',
        created_at: new Date().toISOString(),
      }).select().maybeSingle()
    }

    return NextResponse.json({
      success: true,
      text: resultText,
    })
  } catch (error: any) {
    console.error('Помилка генерації заявки:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Помилка сервера' },
      { status: 500 }
    )
  }
}
