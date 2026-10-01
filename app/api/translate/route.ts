import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { completeCheap, AiBudgetExceededError } from '../../../lib/ai/client'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

function looksUkrainian(text: string) {
  const cyr = (text.match(/[А-Яа-яІіЇїЄєҐґ]/g) || []).length
  const lat = (text.match(/[A-Za-z]/g) || []).length
  return cyr >= 20 && cyr > lat
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const text = String(body?.text || '').trim()
    const userId = body?.userId ? String(body.userId) : null
    if (!text) {
      return NextResponse.json({ success: false, error: 'Немає тексту' }, { status: 400 })
    }

    if (looksUkrainian(text)) {
      return NextResponse.json({ success: true, translation: text, skipped: true })
    }

    if (userId) {
      const dayStart = new Date()
      dayStart.setUTCHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('task', 'translate')
        .gte('created_at', dayStart.toISOString())
      if ((count || 0) >= 10) {
        return NextResponse.json(
          { success: false, error: 'Ліміт 10 перекладів на день.' },
          { status: 429 }
        )
      }
    }

    const completion = await completeCheap('translate', {
      messages: [
        {
          role: 'system',
          content:
            'Переклади текст українською для художника. Збережи факти, назви організацій і дедлайни. Не додавай від себе. Прибери службове меню сайту на кшталт Subscribe, Privacy, Back to Listings. Відповідь — лише переклад.',
        },
        { role: 'user', content: text.slice(0, 4000) },
      ],
      temperature: 0.2,
      userId,
      source: 'translate',
    })

    const translation = String(completion.text || '').trim()
    if (!translation) {
      return NextResponse.json({ success: false, error: 'Порожній переклад' }, { status: 500 })
    }

    return NextResponse.json({ success: true, translation })
  } catch (error: any) {
    if (error instanceof AiBudgetExceededError) {
      return NextResponse.json({ success: false, error: 'Тимчасово недоступно (ліміт AI).' }, { status: 429 })
    }
    return NextResponse.json({ success: false, error: 'Не вдалося перекласти' }, { status: 500 })
  }
}
