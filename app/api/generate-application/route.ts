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

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      opportunityId,
      opportunityTitle,
      opportunityDescription,
      matchReasons = [],
      userId,                    // бажано передавати з фронту
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

    // === 1. Отримуємо профіль художника ===
    let artistProfile: any = null

    if (userId) {
      const { data: profile } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      artistProfile = profile
    }

    // Fallback, якщо профіль не знайдено
    if (!artistProfile) {
      artistProfile = {
        name: 'Художник',
        artistic_styles: [],
        techniques: [],
        materials: [],
        themes: [],
        series: [],
        professional_level: 'Professional',
        target_countries: ['Україна'],
      }
    }

    // === 2. Отримуємо feedback користувача (останні 8 записів) ===
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

    // === 3. Отримуємо останні успішні заявки / генерації (для few-shot) ===
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

    // === 4. Формуємо персоналізований промпт ===
    const profileBlock = `
ІНФОРМАЦІЯ ПРО ХУДОЖНИКА (використовуй тільки ці дані):
- Ім'я: ${artistProfile.name || 'Художник'}
- Країна / місто: ${artistProfile.country || 'Україна'}${artistProfile.city ? `, ${artistProfile.city}` : ''}
- Художні стилі: ${(artistProfile.artistic_styles || []).join(', ') || 'не вказано'}
- Техніки: ${(artistProfile.techniques || []).join(', ') || 'не вказано'}
- Матеріали: ${(artistProfile.materials || []).join(', ') || 'не вказано'}
- Теми: ${(artistProfile.themes || []).join(', ') || 'не вказано'}
- Серії робіт: ${(artistProfile.series || []).join(', ') || 'не вказано'}
- Професійний рівень: ${artistProfile.professional_level || 'Professional'}
- Цільові країни: ${(artistProfile.target_countries || ['Україна']).join(', ')}
`

    const matchBlock = matchReasons?.length
      ? `\nЧОМУ ЦЯ МОЖЛИВІСТЬ ПІДХОДИТЬ (використовуй у мотивації):\n${matchReasons.map((r: string) => `• ${r}`).join('\n')}`
      : ''

    const feedbackBlock = userFeedback.length > 0
      ? `\nЗВОРОТНИЙ ЗВ'ЯЗОК ВІД ХУДОЖНИКА (враховуй стиль і побажання):\n${userFeedback
          .map((f: any) => `• ${f.comment || f.feedback_text || f.note || JSON.stringify(f)}`)
          .join('\n')}`
      : ''

    const historyBlock = previousSuccessful.length > 0
      ? `\nПРИКЛАДИ РАНІШЕ УСПІШНИХ / ВИКОРИСТАНИХ ТЕКСТІВ ЦЬОГО ХУДОЖНИКА (наслідуй тон і структуру):\n${previousSuccessful
          .map((p: any, i: number) => `--- Приклад ${i + 1} ---\n${(p.generated_text || '').slice(0, 600)}...`)
          .join('\n\n')}`
      : ''

    const commercialNote = isCommercial || organization
      ? `\nЦе комерційний / B2B запит.
Замовник: ${organization || 'не вказано'}
Контактна особа: ${contactPerson || 'не вказано'}
Зроби текст більш діловим, конкретним і орієнтованим на співпрацю.`
      : ''

    const prompt = `
Ти — досвідчений арт-менеджер і персональний асистент саме цього художника.
Твоє завдання — згенерувати максимально релевантний і сильний пакет документів.

${profileBlock}
${matchBlock}
${feedbackBlock}
${historyBlock}
${commercialNote}

ІНФОРМАЦІЯ ПРО МОЖЛИВІСТЬ / ЗАПИТ:
- Назва: ${opportunityTitle}
- Опис: ${opportunityDescription || 'Детальний опис відсутній'}

Згенеруй українською мовою структурований пакет:

1. **Motivation Letter / Супровідний лист** (переконливий, особистий, з прив'язкою до профілю)
2. **Artist Statement** (коротка творча позиція художника стосовно цієї можливості)
3. **Project Description / Опис проєкту або пропозиції**
4. **Рекомендований перелік робіт** (конкретні назви серій і картин з профілю, які найкраще підходять)
5. **Короткі рекомендації** — що підкреслити і на що звернути увагу при подачі.

Важливо:
- Пиши живою, професійною, але не канцелярською мовою.
- Максимально використовуй реальні дані з профілю художника.
- Якщо є feedback — обов'язково враховуй побажання щодо тону і стилю.
- Не вигадуй нагород і виставок, яких немає в профілі.
`

    // === 5. Запит до OpenAI ===
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // можна змінити на 'gpt-4o' для вищої якості
      messages: [
        {
          role: 'system',
          content: 'Ти — професійний арт-менеджер і куратор з глибоким розумінням сучасного українського та європейського арт-ринку. Ти завжди пишеш від імені конкретного художника, використовуючи тільки надані факти.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.65,
      max_tokens: 2500,
    })

    const resultText = completion.choices[0]?.message?.content || 'Не вдалося згенерувати документ.'

    // === 6. (Опціонально) зберігаємо генерацію для майбутньої історії ===
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
