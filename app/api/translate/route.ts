import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const maxDuration = 30

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const text = String(body?.text || '').trim()
    if (!text) {
      return NextResponse.json({ success: false, error: 'Немає тексту' }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Переклади текст українською для художника. Збережи факти, назви організацій і дедлайни. Не додавай від себе. Прибери службове меню сайту на кшталт Subscribe, Privacy, Back to Listings, Advertise, Contact, Terms of Service, Akimblog. Відповідь — лише переклад.',
        },
        { role: 'user', content: text.slice(0, 4000) },
      ],
    })

    const translation = String(completion.choices[0]?.message?.content || '').trim()
    if (!translation) {
      return NextResponse.json({ success: false, error: 'Порожній переклад' }, { status: 500 })
    }

    return NextResponse.json({ success: true, translation })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Не вдалося перекласти' }, { status: 500 })
  }
}
