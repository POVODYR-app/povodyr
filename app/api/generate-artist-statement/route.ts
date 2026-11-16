import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { completeCheap, AiBudgetExceededError } from '../../../lib/ai/client'
import { accessReason } from '../../../lib/access'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

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
      // not JSON
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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      userId,
      language = 'uk',
      tone = 'neutral',
      additionalText = '',
    } = body

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Не вказано userId' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Профіль не знайдено' }, { status: 404 })
    }

    const reason = accessReason({
      billing_exempt: profile.billing_exempt,
      subscription_status: profile.subscription_status,
      subscription_end: profile.subscription_end,
      created_at: profile.created_at,
    })

    if (reason === 'locked') {
      return NextResponse.json(
        { success: false, error: 'Генерація доступна лише з активним доступом' },
        { status: 403 }
      )
    }

    const { data: artworks } = await supabase
      .from('artist_artworks')
      .select('title, styles, techniques_list, materials, themes, work_types, format_size')
      .eq('user_id', userId)
      .limit(8)

    const name = profile.full_name || 'Художник'
    const bio = profile.bio || ''
    const level = profile.artist_level || ''
    const techniques = uniqueStrings(toArray(profile.profile_techniques))
    const styles = uniqueStrings(toArray(profile.artistic_styles || []))
    const themes = uniqueStrings(toArray(profile.themes || []))

    const artworksBlock = (artworks || [])
      .map((w: any, i: number) => {
        const parts = []
        if (w.styles?.length) parts.push(`стилі: ${w.styles.join(', ')}`)
        if (w.techniques_list?.length) parts.push(`техніки: ${w.techniques_list.join(', ')}`)
        if (w.materials?.length) parts.push(`матеріали: ${w.materials.join(', ')}`)
        if (w.themes?.length) parts.push(`теми: ${w.themes.join(', ')}`)
        return `${i + 1}. «${w.title}»${parts.length ? ' — ' + parts.join('; ') : ''}`
      })
      .join('\n')

    const langInstruction = language === 'en'
      ? 'Write the entire Artist Statement in English.'
      : 'Напиши весь Artist Statement українською мовою.'

    const toneInstruction = {
      neutral: 'Тон нейтральний, збалансований, без зайвої емоційності.',
      professional: 'Тон професійний, чіткий, орієнтований на кураторів і галереї.',
      emotional: 'Тон емоційний, особистий, з акцентом на внутрішні переживання.',
      short: 'Максимально короткий і лаконічний (до 150 слів).',
    }[tone] || 'Тон нейтральний.'

    const prompt = `
Ти — арт-менеджер, який допомагає художнику написати сильний Artist Statement.

${langInstruction}
${toneInstruction}

Дані художника:
- Ім'я: ${name}
- Рівень: ${level || 'не вказано'}
- Біо: ${bio || 'не вказано'}
- Техніки (профіль): ${techniques.join(', ') || 'не вказано'}
- Стилі: ${styles.join(', ') || 'не вказано'}
- Теми: ${themes.join(', ') || 'не вказано'}

Роботи з портфоліо:
${artworksBlock || 'робіт немає'}

Додатковий текст від художника:
${additionalText || 'не додано'}

Правила:
- Пиши від першої особи ("Я").
- 2–3 абзаци, до ~250 слів.
- Перший абзац: головна ідея практики + медіуми.
- Другий: техніка, матеріали, процес (як це зроблено).
- Третій: актуальний контекст / поточна серія / мета для глядача.
- Уникай кліше ("шукаю сенс життя", "моє мистецтво змушує задуматися").
- Використовуй лише реальні дані з профілю та робіт. Не вигадуй нагороди, виставки, серії.
- Проста, зрозуміла мова.

Згенеруй лише текст Artist Statement, без заголовків і пояснень.
`

    let resultText = ''
    try {
      const completion = await completeCheap('artist_statement', {
        messages: [
          {
            role: 'system',
            content: 'Пиши лише на основі наданих фактів. Не вигадуй. Від першої особи. Дотримуйся структури 2-3 абзаци.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        maxTokens: 800,
        userId,
        source: 'artist-statement',
      })
      resultText = completion.text || ''
    } catch (err: any) {
      if (err instanceof AiBudgetExceededError) {
        return NextResponse.json({ success: false, error: 'Тимчасово недоступно (ліміт AI).' }, { status: 429 })
      }
      throw err
    }

    return NextResponse.json({ success: true, text: resultText })
  } catch (error: any) {
    console.error('Помилка генерації Artist Statement:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Помилка сервера' },
      { status: 500 }
    )
  }
}
