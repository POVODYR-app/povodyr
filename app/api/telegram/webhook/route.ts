import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const botToken = process.env.TELEGRAM_BOT_TOKEN || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!botToken) return
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    }),
  })
}

export async function POST(req: Request) {
  try {
    const update = await req.json()

    if (update?.message?.text) {
      const chatId = update.message.chat.id
      const text = update.message.text.trim()

      if (text.startsWith('/start')) {
        const parts = text.split(' ')
        const userId = parts[1]

        if (userId) {
          const { error } = await supabase
            .from('profiles')
            .update({ telegram_chat_id: String(chatId) })
            .eq('id', userId)

          if (!error) {
            await sendTelegramMessage(
              chatId,
              '✅ Ваш акаунт POVODYR успішно підключено! Тепер ви отримуватимете персональні сповіщення сюди.'
            )
          } else {
            await sendTelegramMessage(
              chatId,
              '⚠️ Не вдалося прив’язати акаунт. Спробуйте ще раз за посиланням із дашборду.'
            )
          }
        } else {
          await sendTelegramMessage(
            chatId,
            'Вітаємо! Щоб підключити сповіщення, перейдіть за посиланням із вашого особистого кабінету POVODYR.'
          )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
