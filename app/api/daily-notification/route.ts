import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Ініціалізація Resend
const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Налаштування Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@povodyr.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Допоміжна функція нормалізації масивів
function parseArrayField(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(i => String(i).toLowerCase().trim());
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(i => String(i).toLowerCase().trim());
    } catch {
      return raw.split(',').map(i => i.toLowerCase().trim());
    }
  }
  return [];
}

// Функція надсилання повідомлення у Telegram
async function sendTelegramMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Авторизація за запитом для Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Отримуємо користувачів
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('profile_completed', true)
      .eq('notifications_enabled', true);

    if (usersError) {
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'Немає користувачів для розсилки', sent: 0 });
    }

    // 2. Отримуємо актуальні можливості
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (oppError) {
      return NextResponse.json({ success: false, error: oppError.message }, { status: 500 });
    }

    let sentCount = 0;
    const logs: any[] = [];

    // 3. Обробка кожного користувача
    for (const user of users) {
      const userCountries = parseArrayField(user.search_countries);
      const userTechniques = parseArrayField(user.techniques);
      const orgFeeMax = Number(user.org_fee_max) || 0;
      const regFeeMax = Number(user.reg_fee_max) || 0;

      // Матчинг можливостей
      const matchedOpps = (opportunities || []).filter(opp => {
        if (userCountries.length > 0 && opp.country) {
          const oppCountry = String(opp.country).toLowerCase();
          const countryMatch = userCountries.some(c => oppCountry.includes(c) || c.includes(oppCountry));
          if (!countryMatch && !oppCountry.includes('онлайн') && !oppCountry.includes('світ')) {
            return false;
          }
        }

        if (userTechniques.length > 0 && opp.techniques) {
          const oppTechs = parseArrayField(opp.techniques);
          if (oppTechs.length > 0) {
            const techMatch = userTechniques.some(ut => oppTechs.some(ot => ot.includes(ut) || ut.includes(ot)));
            if (!techMatch) return false;
          }
        }

        if (opp.org_fee && Number(opp.org_fee) > orgFeeMax && orgFeeMax > 0) return false;
        if (opp.reg_fee && Number(opp.reg_fee) > regFeeMax && regFeeMax > 0) return false;

        return true;
      });

      // Тексти сповіщень
      let title = 'POVODYR: нові можливості для вас';
      let textMessage = '';
      let emailHtml = '';

      if (matchedOpps.length > 0) {
        const oppList = matchedOpps.slice(0, 3).map(o => `• ${o.title || 'Мистецька можливість'}`).join('\n');
        textMessage = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗнайдено ${matchedOpps.length} нових можливостей під ваш профіль:\n\n${oppList}\n\nПерегляньте деталі в особистому кабінеті.`;
        
        const htmlItems = matchedOpps.slice(0, 5).map(o => `<li><strong>${o.title}</strong> (${o.country || 'Онлайн'})</li>`).join('');
        emailHtml = `<p>Привіт${user.full_name ? ', ' + user.full_name : ''}!</p><p>Знайдено ${matchedOpps.length} нових можливостей під ваш профіль:</p><ul>${htmlItems}</ul><p><a href="https://povodyr.vercel.app/dashboard">Переглянути всі в кабінеті</a></p>`;
      } else {
        title = 'POVODYR сьогодні перевірив можливості';
        textMessage = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗа вашими параметрами нових оновлень сьогодні не знайдено. Пошук триває.`;
        emailHtml = `<p>Привіт${user.full_name ? ', ' + user.full_name : ''}!</p><p>POVODYR сьогодні перевірив бази. Нових пропозицій під ваш профіль поки немає.</p>`;
      }

      let emailSent = false;
      let pushSent = false;
      let telegramSent = false;

      // Канал 1: Email (через Resend)
      if (resend && user.email) {
        try {
          const res = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'POVODYR <notifications@povodyr.app>',
            to: [user.email],
            subject: title,
            html: emailHtml
          });
          if (res.data?.id) emailSent = true;
        } catch (e) {
          console.error('Resend error:', e);
        }
      }

      // Канал 2: Web Push (через web-push)
      if (user.push_subscription && process.env.VAPID_PRIVATE_KEY) {
        try {
          const sub = typeof user.push_subscription === 'string' 
            ? JSON.parse(user.push_subscription) 
            : user.push_subscription;
          await webpush.sendNotification(sub, JSON.stringify({
            title,
            body: textMessage.slice(0, 120),
            url: 'https://povodyr.vercel.app/dashboard'
          }));
          pushSent = true;
        } catch (e) {
          console.error('Web Push error:', e);
        }
      }

      // Канал 3: Telegram (через Bot API)
      if (user.telegram_chat_id) {
        telegramSent = await sendTelegramMessage(user.telegram_chat_id, `<b>${title}</b>\n\n${textMessage}`);
      }

      // 4. Запис статусу в таблицю notifications
      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: user.id,
        title,
        message: textMessage,
        link_url: 'https://povodyr.vercel.app/dashboard',
        is_read: false,
        sent_push: pushSent,
        sent_email: emailSent,
        created_at: new Date().toISOString()
      });

      if (!insertError) {
        sentCount++;
        logs.push({ 
          user: user.full_name || user.id, 
          matched: matchedOpps.length, 
          email: emailSent, 
          push: pushSent, 
          telegram: telegramSent 
        });
      } else {
        logs.push({ user: user.full_name || user.id, status: 'error', error: insertError.message });
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total_users: users.length,
      details: logs
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
