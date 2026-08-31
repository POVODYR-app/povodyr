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
      // рядок не JSON — далі як csv
    }
    return trimmed
      .split(/[,;|/]/)
      .map((item) => item.trim())
      .filter(Boolean)
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

function buildCanonicalProfile(
  userProfile: any,
  artistRow: any,
  artworksRaw: any[]
): CanonicalProfile {
  const artworkList: CanonicalArtwork[] = []
  const rawWorks = Array.isArray(artworksRaw) ? artworksRaw : []

  rawWorks.forEach((work) => {
    const title = String(work?.title || '').trim()
    if (!title) return
    artworkList.push({
      title,
      styles: uniqueStrings(toArray(work.styles)),
      techniques: uniqueStrings(toArray(work.techniques_list || work.techniques)),
      materials: uniqueStrings(toArray(work.materials)),
      themes: uniqueStrings(toArray(work.themes)),
      workTypes: uniqueStrings(toArray(work.work_types)),
      formatSize: String(work.format_size || work.size_category || '').trim(),
    })
  })

  const name = firstNonEmpty(userProfile?.full_name, artistRow?.name)
  const nameKnown = Boolean(name) && name.toLowerCase() !== NAME_PLACEHOLDER.toLowerCase()

  const artisticStyles = uniqueStrings(
    toArray(artistRow?.artistic_styles).concat(
      artworkList.reduce((acc: string[], work) => acc.concat(work.styles), [])
    )
  )
  const techniques = uniqueStrings(
    toArray(userProfile?.profile_techniques)
      .concat(toArray(userProfile?.techniques))
      .concat(toArray(artistRow?.techniques))
      .concat(artworkList.reduce((acc: string[], work) => acc.concat(work.techniques), []))
  )
  const materials = uniqueStrings(
    toArray(artistRow?.materials).concat(
      artworkList.reduce((acc: string[], work) => acc.concat(work.materials), [])
    )
  )
  const themes = uniqueStrings(
    toArray(artistRow?.themes).concat(
      artworkList.reduce((acc: string[], work) => acc.concat(work.themes), [])
    )
  )
  const series = uniqueStrings(toArray(artistRow?.series))
  const targetCountries = uniqueStrings(
    toArray(userProfile?.search_countries).concat(toArray(artistRow?.target_countries))
  )
  const preferredOpportunityTypes = uniqueStrings(
    toArray(artistRow?.preferred_opportunity_types)
  )

  const missingFields: string[] = []
  if (!nameKnown) missingFields.push("ім'я / повне ім'я (profiles.full_name)")
  if (!firstNonEmpty(userProfile?.city, artistRow?.city)) missingFields.push('місто')
  if (artisticStyles.length === 0) missingFields.push('стилі')
  if (techniques.length === 0) missingFields.push('техніки')
  if (themes.length === 0) missingFields.push('теми')
  if (artworkList.length === 0) missingFields.push('назви робіт у портфоліо')
  if (series.length === 0 && artworkList.length === 0) missingFields.push('серії робіт')

  return {
    name: nameKnown ? name : '',
    nameKnown,
    bio: String(userProfile?.bio || artistRow?.bio || '').trim(),
    city: firstNonEmpty(userProfile?.city, artistRow?.city),
    country: firstNonEmpty(userProfile?.country, artistRow?.country, 'Україна'),
    professionalLevel: firstNonEmpty(
      userProfile?.artist_level,
      artistRow?.professional_level
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
    return 'РЕАЛЬНІ РОБОТИ З ПОРТФОЛІО: немає жодної назви в artist_artworks. Не вигадуй назви. У блоці «Перелік робіт» чесно напиши, що конкретні назви в профілі відсутні.'
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
    } = body

    if (!opportunityTitle) {
      return NextResponse.json(
        { success: false, error: 'Не вказано назву можливості' },
        { status: 400 }
      )
    }

    // === 1. Канонічний профіль: profiles + artist_profiles + artist_artworks ===
    let userProfile: any = null
    let artistRow: any = null
    let artworksRaw: any[] = []

    if (userId) {
      const [profileRes, artistRes, artworksRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('artist_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase
          .from('artist_artworks')
          .select('title, styles, techniques_list, techniques, materials, themes, work_types, format_size, size_category')
          .eq('user_id', userId)
          .limit(MAX_ARTWORKS),
      ])

      userProfile = profileRes.data || null
      artistRow = artistRes.data || null
      artworksRaw = artworksRes.data || []
    }

    const canonical = buildCanonicalProfile(userProfile, artistRow, artworksRaw)

    // === 2. Feedback користувача (останні 8 записів) ===
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

    // === 3. Останні успішні заявки / генерації (few-shot) ===
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

    // === 4. Персоналізований промпт ===
    const displayName = canonical.nameKnown
      ? canonical.name
      : "ім'я в профілі не вказано — НЕ підставляй слово «Художник» і НЕ вигадуй ім'я"

    const locationParts: string[] = []
    if (canonical.city) locationParts.push(canonical.city)
    if (canonical.country) locationParts.push(canonical.country)

    const profileBlock = `
ІНФОРМАЦІЯ ПРО ХУДОЖНИКА (використовуй ТІЛЬКИ ці дані, нічого не дописуй):
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
- Полів бракує: ${canonical.missingFields.length ? canonical.missingFields.join(', ') : 'немає критичних прогалин'}

${formatArtworksBlock(canonical.artworks)}
`

    const matchBlock = Array.isArray(matchReasons) && matchReasons.length
      ? `\nЧОМУ ЦЯ МОЖЛИВІСТЬ ПІДХОДИТЬ (використовуй у мотивації, не перефразовуй у вигадані факти):\n${matchReasons.map((r: string) => `• ${r}`).join('\n')}`
      : ''

    const feedbackBlock = userFeedback.length > 0
      ? `\nЗВОРОТНИЙ ЗВ'ЯЗОК ВІД ХУДОЖНИКА (враховуй стиль і побажання):\n${userFeedback
          .map((f: any) => `• ${f.comment || f.feedback_text || f.note || JSON.stringify(f)}`)
          .join('\n')}`
      : ''

    const historyBlock = previousSuccessful.length > 0
      ? `\nПРИКЛАДИ РАНІШЕ УСПІШНИХ / ВИКОРИСТАНИХ ТЕКСТІВ ЦЬОГО ХУДОЖНИКА (наслідуй тон і структуру, не копіюй факти з інших програм):\n${previousSuccessful
          .map((p: any, i: number) => `--- Приклад ${i + 1} ---\n${(p.generated_text || '').slice(0, 600)}...`)
          .join('\n\n')}`
      : ''

    const commercialNote = isCommercial
      ? `\nЦе комерційний / B2B запит.
Замовник: ${organization || 'не вказано'}
Контактна особа: ${contactPerson || 'не вказано'}
Зроби текст діловим, конкретним і орієнтованим на співпрацю. Не роздувай грантовий пафос.`
      : `\nЦе заявка на open call / грант / резиденцію / виставку / конкурс — не комерційна пропозиція продажу.
Організатор (якщо відомий з опису): ${organization || 'не витягай і не вигадуй назву, якщо її немає в даних можливості'}.
Контактна особа (якщо є): ${contactPerson || 'не вказано'}.`

    const sparseNote = canonical.missingFields.length > 0
      ? `\nДАНИХ МАЛО. Не заповнюй прогалини водою на кшталт «культурний діалог», «досліджуйте ідентичність», «Інша Освіта». У блоці рекомендацій чесно перелічи, яких полів бракує, і дай 2–3 конкретні питання, що дописати в профіль (наприклад: «вкажіть 3 назви робіт», «уточніть техніку»).`
      : ''

    const prompt = `
Ти — досвідчений арт-менеджер і персональний асистент саме цього художника.
Згенеруй пакет документів під цю конкретну можливість і під ці конкретні факти профілю.

${profileBlock}
${matchBlock}
${feedbackBlock}
${historyBlock}
${commercialNote}
${sparseNote}

ІНФОРМАЦІЯ ПРО МОЖЛИВІСТЬ / ЗАПИТ:
- Назва: ${opportunityTitle}
- Опис: ${opportunityDescription || 'Детальний опис відсутній'}

Згенеруй українською мовою структурований пакет рівно з 5 блоків:

1. **Супровідний лист**
   - Якщо ім'я відоме — підпиши / звертайся цим ім'ям.
   - Якщо ім'я невідоме — обійдися без звернення «Художник» і без вигаданого ПІБ.
   - Звернення під організатора береться лише з назви/опису можливості.
   - 1–2 речення: чому саме цей автор × чому саме ця програма. Без загальних фраз.

2. **Artist Statement**
   - Стилі / техніки / теми тільки з профілю і робіт.
   - Без канцеляриту і без універсальних абзаців про «міжкультурний діалог».

3. **Опис проєкту**
   - Підлаштуй під тип можливості з назви та опису (резиденція ≠ грант ≠ виставка ≠ open call).
   - Медіум і формат лише з профілю/робіт. Не підсовуй інсталяцію, якщо в даних живопис / графіка / інша техніка.

4. **Перелік робіт**
   - Лише реальні title з блоку «РЕАЛЬНІ РОБОТИ» і/або серії з профілю.
   - Якщо робіт 0 — так і напиши. Жодних вигаданих назв на кшталт «Серія I», «Без назви №3», якщо їх немає в даних.

5. **Короткі рекомендації**
   - Конкретні, під цю можливість (дедлайн, акцент у листі, яких робіт бракує).
   - Не універсальні поради на кшталт «підкресліть готовність до співпраці».

Жорсткі заборони:
- Не використовуй заглушку «Художник», якщо в даних є ім'я.
- Не вигадуй ім'я, виставки, резиденції, нагороди, серії, назви робіт, організації.
- Не хардкодь імена інших художників і назви сторонніх програм.
- Якщо факт не передано — напиши, що його немає в профілі, а не додумай.
`

    // === 5. Запит до OpenAI ===
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "Ти — професійний арт-менеджер. Пишеш лише від наданих фактів. Заборонено ім'я-заглушку «Художник», якщо передано інше ім'я. Заборонено вигадувати роботи, серії, виставки й нагороди.",
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 2500,
    })

    const resultText = completion.choices[0]?.message?.content || 'Не вдалося згенерувати документ.'

    // === 6. Зберігаємо генерацію для історії (як було) ===
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
