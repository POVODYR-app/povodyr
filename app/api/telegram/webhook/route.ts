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

export async function POST(req: Request) {
  try {
    const update = await req.json()
    console.log('Incoming webhook update:', JSON.stringify(update))

    if (update?.message?.text) {
      const chatId = update.message.chat.id
      const text = update.message.text.trim()

      if (text.startsWith('/start')) {
        const parts = text.split(/\s+/)
        const userId = parts[1] // Отримуємо UUID, якщо він є після пробілу
        console.log('Parsed start command. User ID from link:', userId, 'Chat ID:', chatId)

        if (userId) {
          // Якщо параметр є — прив'язуємо до бази
          const { data, error } = await supabase
            .from('profiles')
            .upsert({ 
              id: userId, 
              telegram_chat_id: String(chatId) 
            }, { onConflict: 'id' })
            .select()

          console.log('Supabase upsert result:', { data, error })

          if (!error) {
            await sendTelegramMessage(
              chatId,
              '✅ Ваш акаунт POVODYR успішно підключено! Тепер ви отримуватимете персональні сповіщення сюди.'
            )
          } else {
            await sendTelegramMessage(
              chatId,
              '⚠️ Не вдалося прив’язати акаунт. Спробуйте скопіювати команду з особистого кабінету.'
            )
          }
        } else {
          // Якщо параметр відсутній (чистий /start)
          await sendTelegramMessage(
            chatId,
            'Вітаємо у POVODYR! Для підключення персональних сповіщень, будь ласка, скористайтеся кнопкою «Підключити Telegram-бота» у вашому особистому кабінеті в додатку.'
          )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
