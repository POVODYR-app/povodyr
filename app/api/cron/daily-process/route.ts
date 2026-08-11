import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@povodyr.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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

async function sendTelegramMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text, 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const testEmail = request.nextUrl.searchParams.get('test_email');

    let query = supabase.from('profiles').select('*').eq('notifications_enabled', true);
    if (testEmail) {
      query = query.eq('email', testEmail);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'Немає користувачів для розсилки', sent: 0 });
    }

    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (oppError) {
      return NextResponse.json({ success: false, error: oppError.message }, { status: 500 });
    }

    let sentCount = 0;
    const logs: any[] = [];

    for (const user of users) {
      const userCountries = parseArrayField(user.search_countries);
      const userTechniques = parseArrayField(user.techniques);
      const orgFeeMax = Number(user.org_fee_max || user.max_fee_amount) || 0;

      const matchedOpps = (opportunities || []).filter(opp => {
        if (userCountries.length > 0 && opp.country) {
          const oppCountry = String(opp.country).toLowerCase();
          const countryMatch = userCountries.some(c => oppCountry.includes(c) || c.includes(oppCountry));
          if (!countryMatch && !oppCountry.includes('онлайн') && !oppCountry.includes('світ') && !oppCountry.includes('international')) {
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

        const fee = Number(opp.cost_amount || opp.fee_amount || opp.org_fee) || 0;
        if (fee > orgFeeMax && orgFeeMax > 0 && !opp.is_free) return false;

        return true;
      });

      if (matchedOpps.length === 0) {
        logs.push({ user: user.full_name || user.id, matched: 0, status: 'skipped_no_matches' });
        continue;
      }

      const title = 'POVODYR: нові можливості для вас';

      // 1. Повідомлення для Telegram (з HTML-тегами посилань)
      const oppListTelegram = matchedOpps.slice(0, 5).map(o => {
        const url = o.source_url || o.link || o.link_url || 'https://povodyr.vercel.app/dashboard';
        return `• <a href="${url}">${o.title || 'Мистецька можливість'}</a> (${o.country || 'Онлайн'})`;
      }).join('\n');

      const telegramMessage = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗнайдено ${matchedOpps.length} нових можливостей під ваш профіль:\n\n${oppListTelegram}\n\n<a href="https://povodyr.vercel.app/dashboard">Перегляньте деталі в особистому кабінеті</a>.`;

      // 2. Повідомлення для бази даних / додатка (чистий текст без HTML-тегів)
      const oppListPlain = matchedOpps.slice(0, 5).map(o => {
        return `• ${o.title || 'Мистецька можливість'} (${o.country || 'Онлайн'})`;
      }).join('\n');

      const appMessage = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗнайдено ${matchedOpps.length} нових можливостей під ваш профіль:\n\n${oppListPlain}\n\nПерегляньте деталі в особистому кабінеті.`;

      // 3. Шаблон для Email
      const htmlItems = matchedOpps.slice(0, 5).map(o => {
        const url = o.source_url || o.link || o.link_url || 'https://povodyr.vercel.app/dashboard';
        return `<li><a href="${url}"><strong>${o.title}</strong></a> (${o.country || 'Онлайн'})</li>`;
      }).join('');
      const emailHtml = `<p>Привіт${user.full_name ? ', ' + user.full_name : ''}!</p><p>Знайдено ${matchedOpps.length} нових можливостей під ваш профіль:</p><ul>${htmlItems}</ul><p><a href="https://povodyr.vercel.app/dashboard">Переглянути в кабінеті</a></p>`;

      let emailSent = false;
      let pushSent = false;
      let telegramSent = false;

      // Відправка Email
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

      // Відправка Push
      if (user.push_subscription && process.env.VAPID_PRIVATE_KEY) {
        try {
          const sub = typeof user.push_subscription === 'string' 
            ? JSON.parse(user.push_subscription) 
            : user.push_subscription;
          await webpush.sendNotification(sub, JSON.stringify({
            title,
            body: `Знайдено ${matchedOpps.length} нових можливостей!`,
            url: 'https://povodyr.vercel.app/dashboard'
          }));
          pushSent = true;
        } catch (e) {
          console.error('Web Push error:', e);
        }
      }

      // Відправка Telegram
      if (user.telegram_chat_id) {
        telegramSent = await sendTelegramMessage(user.telegram_chat_id, `<b>${title}</b>\n\n${telegramMessage}`);
      }

      // Запис у базу даних Supabase для додатка (використовуємо чистий appMessage)
      const firstUrl = matchedOpps[0]?.source_url || matchedOpps[0]?.link || 'https://povodyr.vercel.app/dashboard';
      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: user.id,
        title,
        message: appMessage,
        link_url: firstUrl,
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
