import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

export async function GET() {
  try {
    const { data: allNotifs, error: allErr } = await supabase
      .from('notifications')
      .select('*');

    if (allErr) {
      return NextResponse.json({ success: false, error: `Помилка Supabase: ${allErr.message}` }, { status: 500 });
    }

    const pendingNotifications = allNotifs ? allNotifs.filter((n) => !n.sent_email) : [];

    if (pendingNotifications.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0, 
        emailCount: 0, 
        totalInDb: allNotifs?.length || 0,
        message: 'У базі немає сповіщень зі статусом sent_email = false' 
      });
    }

    let emailCount = 0;
    const logs: any[] = [];

    for (const item of pendingNotifications) {
      let targetEmail = '';

      if (item.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', item.user_id)
          .maybeSingle();

        if (profile?.email) {
          targetEmail = profile.email;
        }
      }

      if (!targetEmail) {
        const { data: anyProfile } = await supabase
          .from('profiles')
          .select('email')
          .not('email', 'is', null)
          .limit(1)
          .maybeSingle();

        if (anyProfile?.email) {
          targetEmail = anyProfile.email;
        }
      }

      if (RESEND_API_KEY && targetEmail) {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'POVODYR <onboarding@resend.dev>',
              to: [targetEmail],
              subject: `Нова можливість: ${item.title}`,
              html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>${item.title}</h2>
                <p>${item.message}</p>
                <a href="${item.link_url || 'https://povodyr.vercel.app/dashboard'}" style="background: #2563eb; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 8px;">Переглянути деталі</a>
              </div>`,
            }),
          });

          const resData = await emailResponse.json();

          if (emailResponse.ok) {
            await supabase
              .from('notifications')
              .update({ sent_email: true })
              .eq('id', item.id);
            emailCount++;
            logs.push({ status: 'sent', email: targetEmail, resend_id: resData.id });
          } else {
            logs.push({ status: 'error', email: targetEmail, error: resData });
          }
        } catch (eErr: any) {
          logs.push({ status: 'exception', email: targetEmail, error: eErr.message });
        }
      } else {
        logs.push({ status: 'skipped', reason: !RESEND_API_KEY ? 'No RESEND_API_KEY' : 'No target email' });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: pendingNotifications.length, 
      emailCount,
      totalInDb: allNotifs?.length || 0,
      details: logs
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET();
}
