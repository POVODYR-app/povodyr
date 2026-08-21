import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const botToken = process.env.TELEGRAM_BOT_TOKEN || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is missing!')
    return
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    console.log('Telegram send result:', data)
  } catch (err) {
    console.error('Error sending telegram message:', err)
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook is active' })
}

export async function POST(req: Request) {
  try {
    const update = await req.json()
    console.log('--- WEBHOOK RECEIVED ---', JSON.stringify(update))

    const chatId = update?.message?.chat?.id || update?.callback_query?.message?.chat?.id
    const telegramUser = update?.message?.from
    const text = update?.message?.text?.trim() || ''

    if (!chatId || !telegramUser) {
      return NextResponse.json({ ok: true })
    }

    const telegramIdStr = String(telegramUser.id)
    const telegramIdNum = Number(telegramUser.id)

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const rawParam = parts[1] // UUID з посилання, якщо він є

      console.log('Start command. Telegram ID:', telegramIdStr, 'Param:', rawParam, 'Chat ID:', chatId)

      let targetProfileId: string | null = null

      // 1. Шукаємо за параметром з посилання (UUID)
      if (rawParam) {
        const { data: profileByParam } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', rawParam)
          .maybeSingle()

        if (profileByParam) {
          targetProfileId = profileByParam.id
        }
      }

      // 2. Якщо через посилання не знайшли, шукаємо за telegram_id у базі
      if (!targetProfileId) {
        const { data: profileByTgId } = await supabase
          .from('profiles')
          .select('id')
          .or(`telegram_id.eq.${telegramIdStr},telegram_id.eq.${telegramIdNum}`)
          .maybeSingle()

        if (profileByTgId) {
          targetProfileId = profileByTgId.id
        }
      }

      // 3. Якщо профіль знайдено — оновлюємо чат ID
      if (targetProfileId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            telegram_chat_id: String(chatId),
            telegram_id: telegramIdStr 
          })
          .eq('id', targetProfileId)

        if (!updateError) {
          await sendTelegramMessage(
            chatId,
            '✅ Ваш акаунт POVODYR успішно підключено! Тепер ви отримуватимете персональні сповіщення сюди.'
          )
          return NextResponse.json({ ok: true })
        }
      }

      // Якщо профіль не знайдено жодним способом
      await sendTelegramMessage(
        chatId,
        `Вітаємо у POVODYР! Ваш Telegram ID: <code>${telegramIdStr}</code>. Будь ласка, переконайтеся, що ви авторизовані в додатку через цей акаунт.`
      )
    } else {
      await sendTelegramMessage(
        chatId,
        'Отримав ваше повідомлення. Сповіщення від POVODYR налаштовано успішно.'
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook critical error:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
