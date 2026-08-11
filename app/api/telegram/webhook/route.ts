import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString();
      const text = body.message.text.trim();

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const userId = parts[1];

        if (userId) {
          const { error } = await supabase
            .from('profiles')
            .update({ telegram_chat_id: chatId })
            .eq('id', userId);

          const botToken = process.env.TELEGRAM_BOT_TOKEN;

          if (!error && botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '✅ Ваш акаунт POVODYR успішно підключено! Тепер ви отримуватимете персональні сповіщення сюди.'
              })
            });
          }
        } else {
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: 'Привіт! Щоб підключити сповіщення, будь ласка, скористайтеся кнопкою "Підключити Telegram" в особистому кабінеті POVODYR.'
              })
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Telegram Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
