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

    const message = update?.message
    const chatId = message?.chat?.id
    const telegramUser = message?.from
    const text = message?.text?.trim() || ''

    if (!chatId || !telegramUser) {
      return NextResponse.json({ ok: true })
    }

    const telegramIdStr = String(telegramUser.id)

    // Обробка команди /start
    if (text.startsWith('/start')) {
      // Правильний split
      const parts = text.split(/\s+/)
      const rawParam = parts[1] // UUID користувача з посилання

      console.log('Start command received.', {
        telegramId: telegramIdStr,
        param: rawParam,
        chatId: chatId,
      })

      let targetProfileId: string | null = null

      // 1. Основний сценарій — передано UUID у /start
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

      // 2. Якщо параметра немає — шукаємо за вже збереженим chat_id
      if (!targetProfileId) {
        const { data: profileByTg } = await supabase
          .from('profiles')
          .select('id')
          .eq('telegram_chat_id', String(chatId))
          .maybeSingle()

        if (profileByTg) {
          targetProfileId = profileByTg.id
        }
      }

      // Якщо знайшли профіль — зберігаємо chat_id
      if (targetProfileId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            telegram_chat_id: String(chatId),
          })
          .eq('id', targetProfileId)

        if (!updateError) {
          await sendTelegramMessage(
            chatId,
            '✅ Ваш акаунт POVODYR успішно підключено!\n\nТепер ви отримуватимете персональні сповіщення про нові можливості прямо сюди.'
          )
          return NextResponse.json({ ok: true })
        } else {
          console.error('Database update error:', updateError)
          await sendTelegramMessage(
            chatId,
            '⚠️ Виникла помилка при збереженні. Спробуйте ще раз або зверніться в підтримку.'
          )
        }
      } else {
        // Профіль не знайдено
        await sendTelegramMessage(
          chatId,
          `Вітаємо у POVODYR!\n\nВаш Telegram ID: <code>${telegramIdStr}</code>\n\nБудь ласка, зайдіть у свій кабінет на сайті і натисніть кнопку «Підключити Telegram-бота».`
        )
      }
    } else {
      // Будь-яке інше повідомлення
      await sendTelegramMessage(
        chatId,
        'Отримав ваше повідомлення. Сповіщення від POVODYR налаштовано.'
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook critical error:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
