import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

export async function GET() {
  try {
    const { data: pendingNotifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .or('sent_email.is.null,sent_email.eq.false')
      .limit(50);

    if (notifError) {
      return NextResponse.json({ success: false, error: notifError.message }, { status: 500 });
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return NextResponse.json({ success: true, processed: 0, emailCount: 0, message: 'Немає нових сповіщень для відправки' });
    }

    let emailCount = 0;

    for (const item of pendingNotifications) {
      const userId = item.user_id;

      let targetEmail = '';

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.email) {
        targetEmail = profile.email;
      } else {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        if (authUser?.user?.email) {
          targetEmail = authUser.user.email;
        }
      }

      if (targetEmail && RESEND_API_KEY) {
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

          if (emailResponse.ok) {
            await supabase
              .from('notifications')
              .update({ sent_email: true })
              .eq('id', item.id);
            emailCount++;
          }
        } catch (eErr) {
          console.error('Помилка відправки email:', eErr);
        }
      } else if (!RESEND_API_KEY) {
        await supabase
          .from('notifications')
          .update({ sent_email: true })
          .eq('id', item.id);
      }
    }

    return NextResponse.json({ success: true, processed: pendingNotifications.length, emailCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET();
}
