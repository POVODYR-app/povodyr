import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import webpush from 'web-push';
import { personalizeOpportunities } from '../../../lib/personalizeOpportunities';

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

const PRIORITY_SOURCES = [
    {
    url: 'https://sites.google.com/view/artfinenation/open-call',
    title: 'Art Fine Nation Перша українська мистецька агенція — Open Call виставки, конкурси, пленери',
    type: 'open_call',
    country: 'Україна',
    description: 'Перша українська мистецька агенція Art Fine Nation. Open call: виставки, конкурси, пленери для художників України.'
  },
  {
    url: 'https://houseofeurope.org.ua/',
    title: 'House of Europe — Гранти та можливості для культурного сектору',
    type: 'grant',
    country: 'Україна',
    description: 'Грантові програми, резиденції та професійні можливості для митців в Україні та ЄС.'
  },
  {
    url: 'https://insha-osvita.org/',
    title: 'Інша Освіта — Резиденції, гранти та освітні програми',
    type: 'residency',
    country: 'Україна',
    description: 'Програми культурної співпраці, творчі резиденції та гранти.'
  },
  {
    url: 'https://legaragemoderne.org/',
    title: 'Le Garage Moderne — International Residencies & Open Calls',
    type: 'residency',
    country: 'Франція / International',
    description: 'Міжнародні художні резиденції та відкриті конкурси для мистецьких проєктів.'
  }
];

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
        await supabase
      .from('opportunities')
      .update({ deadline: null })
      .ilike('source_url', '%artfinenation%')
      .not('deadline', 'is', null)
        await supabase
      .from('opportunities')
      .update({ deadline: null })
      .ilike('source_url', '%artfinenation%')
      .not('deadline', 'is', null)
        {
      const listingTitlePatterns = [
        '%Актуальний Open Call та події%',
        '%Актуальні гранти та конкурсні програми%',
      ]
      for (let i = 0; i < listingTitlePatterns.length; i += 1) {
        const { data: listingRows } = await supabase
          .from('opportunities')
          .select('id, title')
          .ilike('title', listingTitlePatterns[i])
          .eq('is_active', true)
          .limit(50)

        const rows = listingRows || []
        for (let j = 0; j < rows.length; j += 1) {
          const title = String(rows[j].title || '')
          if (/artfinenation/i.test(title)) continue
          await supabase
            .from('opportunities')
            .update({ is_active: false })
            .eq('id', rows[j].id)
        }
      }
    }

        for (const source of PRIORITY_SOURCES) {
      const isAfn = /artfinenation/i.test(source.url);
      let existingOpp: { id: string } | null = null;

      const { data: exactOpp } = await supabase
        .from('opportunities')
        .select('id')
        .eq('source_url', source.url)
        .maybeSingle();

      existingOpp = exactOpp || null;

      if (!existingOpp && isAfn) {
        const { data: afnOpps } = await supabase
          .from('opportunities')
          .select('id, source_url')
          .ilike('source_url', '%artfinenation%')
          .limit(5);

        if (afnOpps && afnOpps.length > 0) {
          existingOpp = afnOpps[0];
        }
      }

      const record = {
        title: source.title,
        description: source.description,
        raw_description: source.description,
        source_url: source.url,
        type: source.type,
        country: source.country,
        eligible_countries: ['Україна', 'International'],
        ukrainians_eligible: true,
        is_active: true,
        deadline: isAfn ? null : null,
      };

      if (!existingOpp) {
        await supabase.from('opportunities').insert([
          {
            ...record,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        await supabase
          .from('opportunities')
                    .update({
            is_active: true,
            title: source.title,
            description: source.description,
            raw_description: source.description,
            source_url: source.url,
            deadline: isAfn ? null : null,
          })
          .eq('id', existingOpp.id);
      }
    }

    {
      const canonicalUrl = 'https://sites.google.com/view/artfinenation/open-call';
      const collected: any[] = [];

      const q1 = await supabase
        .from('opportunities')
        .select('id, source_url, title, is_active')
        .ilike('source_url', '%artfinenation%');
      const q2 = await supabase
        .from('opportunities')
        .select('id, source_url, title, is_active')
        .ilike('title', '%Art Fine Nation%');
      const q3 = await supabase
        .from('opportunities')
        .select('id, source_url, title, is_active')
        .ilike('title', '%Всеукраїнський Open Call%');
      const q4 = await supabase
        .from('opportunities')
        .select('id, source_url, title, is_active')
        .ilike('title', '%Календар конкурсів%');

      const packs = [q1.data, q2.data, q3.data, q4.data];
      for (let p = 0; p < packs.length; p += 1) {
        const pack = packs[p] || [];
        for (let i = 0; i < pack.length; i += 1) {
          collected.push(pack[i]);
        }
      }

      const byId = new Map();
      for (let i = 0; i < collected.length; i += 1) {
        const row = collected[i];
        if (row && row.id) byId.set(row.id, row);
      }
      const rows = Array.from(byId.values());

      let keeperId: string | null = null;
      for (let i = 0; i < rows.length; i += 1) {
        const url = String(rows[i].source_url || '');
        if (url.indexOf('sites.google.com/view/artfinenation/open-call') !== -1) {
          keeperId = rows[i].id;
          break;
        }
      }
      if (!keeperId && rows.length > 0) keeperId = rows[0].id;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row.id === keeperId) {
          await supabase
            .from('opportunities')
            .update({
              source_url: canonicalUrl,
              title: 'Art Fine Nation Перша українська мистецька агенція — Open Call виставки, конкурси, пленери',
              description: 'Пріоритетний постійний open call для українських художників, виставок та проєктів.',
              raw_description: 'Офіційна сторінка open call Першої української мистецької агенції Art Fine Nation.',
              country: 'Україна',
              is_active: true,
              deadline: '2026-12-31T00:00:00.000Z',
              ukrainians_eligible: true,
            })
            .eq('id', row.id);
        } else {
          await supabase
            .from('opportunities')
            .update({ is_active: false })
            .eq('id', row.id);
        }
      }
    }

    let query = supabase.from('profiles').select('*');
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

    const nowISO = new Date().toISOString();
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('is_active', true)
      .or(`deadline.gte.${nowISO},deadline.is.null`)
      .order('created_at', { ascending: false })
      .limit(250);

    if (oppError) {
      return NextResponse.json({ success: false, error: oppError.message }, { status: 500 });
    }

    let sentCount = 0;
    const logs: any[] = [];
    const runAt = new Date().toISOString();

        const listingTitleRe = /актуальний open call та події|актуальні гранти та конкурсні програми|worldwide network open calls|grants database|eu supports ukraine through culture|swiss arts council residencies|selected artists in residence|selected projects/i
    const cleanOpportunities = (opportunities || []).filter((item: any) => {
      const title = String(item?.title || '')
      if (/artfinenation/i.test(title)) return true
      return !listingTitleRe.test(title)
    })
    for (const user of users) {
      const personalized = personalizeOpportunities(user, opportunities || [], {
        minScore: 48,
        limit: 20,
      });

      const matchedOpps = personalized.map((item) => item.opportunity);
      const digestIds = Array.from(
        new Set(
          matchedOpps
            .map((o: any) => o && o.id)
            .filter((id: any) => typeof id === 'string' && id.length > 0)
        )
      );

      const { error: digestError } = await supabase
        .from('profiles')
        .update({
          digest_opportunity_ids: digestIds,
          digest_run_at: runAt,
        })
        .eq('id', user.id);

      if (digestError) {
        logs.push({
          user: user.full_name || user.id,
          matched: digestIds.length,
          status: 'digest_update_failed',
          error: digestError.message,
        });
      }

      if (matchedOpps.length === 0 || user.notifications_enabled !== true) {
        logs.push({
          user: user.full_name || user.id,
          matched: digestIds.length,
          status: matchedOpps.length === 0 ? 'skipped_no_matches' : 'digest_saved_notifications_off',
        });
        continue;
      }

      const title = 'POVODYR: нові можливості для вас';

      const oppListTelegram = matchedOpps.slice(0, 5).map((o: any) => {
        const url = o.source_url || o.link || o.link_url || 'https://povodyr.vercel.app/dashboard';
        return `• <a href="${url}">${o.title || 'Мистецька можливість'}</a> (${o.country || 'Онлайн'})`;
      }).join('\n');

      const telegramMessage = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗнайдено ${matchedOpps.length} нових можливостей під ваш профіль:\n\n${oppListTelegram}\n\n<a href="https://povodyr.vercel.app/dashboard">Перегляньте деталі в особистому кабінеті</a>.`;

      const oppListPlain = matchedOpps.slice(0, 5).map((o: any) => {
        return `• ${o.title || 'Мистецька можливість'} (${o.country || 'Онлайн'})`;
      }).join('\n');

      const appMessage = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗнайдено ${matchedOpps.length} нових можливостей під ваш профіль:\n\n${oppListPlain}\n\nПерегляньте деталі в особистому кабінеті.`;

      const htmlItems = matchedOpps.slice(0, 5).map((o: any) => {
        const url = o.source_url || o.link || o.link_url || 'https://povodyr.vercel.app/dashboard';
        return `<li><a href="${url}"><strong>${o.title}</strong></a> (${o.country || 'Онлайн'})</li>`;
      }).join('');
      const emailHtml = `<p>Привіт${user.full_name ? ', ' + user.full_name : ''}!</p><p>Знайдено ${matchedOpps.length} нових можливостей під ваш профіль:</p><ul>${htmlItems}</ul><p><a href="https://povodyr.vercel.app/dashboard">Переглянути в кабінеті</a></p>`;

      let emailSent = false;
      let pushSent = false;
      let telegramSent = false;

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

      if (user.telegram_chat_id) {
        telegramSent = await sendTelegramMessage(user.telegram_chat_id, `<b>${title}</b>\n\n${telegramMessage}`);
      }

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
          top_scores: personalized.slice(0, 5).map((item) => ({
            title: item.opportunity?.title,
            score: item.score
          })),
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
      digest_run_at: runAt,
      details: logs
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
