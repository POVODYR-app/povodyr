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

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const rawParam = parts[1] // Це може бути UUID з посилання

      console.log('Start command received. Telegram ID:', telegramIdStr, 'Param:', rawParam, 'Chat ID:', chatId)

      let updateError = null

      if (rawParam) {
        // Якщо посилання містило UUID профілю (перший вхід)
        const { error } = await supabase
          .from('profiles')
          .update({ telegram_chat_id: String(chatId) })
          .eq('id', rawParam)
        
        updateError = error
      } else {
        // Якщо параметр не передався (бот вже відкривався раніше),
        // шукаємо профіль за telegram_id, який вже прив'язаний до цього юзера на сайті
        const { error } = await supabase
          .from('profiles')
          .update({ telegram_chat_id: String(chatId) })
          .eq('telegram_id', telegramIdStr)

        updateError = error
      }

      if (!updateError) {
        await sendTelegramMessage(
          chatId,
          '✅ Ваш акаунт POVODYR успішно підключено! Тепер ви отримуватимете персональні сповіщення сюди.'
        )
      } else {
        // Якщо в базі ще немає запису з цим telegram_id або сталася помилка
        await sendTelegramMessage(
          chatId,
          `Вітаємо у POVODYР! Ваш Telegram ID: <code>${telegramIdStr}</code>. Будь ласка, переконайтеся, що ви авторизовані на сайті через цей акаунт.`
        )
      }
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
