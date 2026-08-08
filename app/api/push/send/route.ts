import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY || 'BIN2Jc5Vmkmy-S3AUrcMlpKxJpLeVRAfu9WBqUbJ70SJOCWGCGXKY-Xzyh7HDr6KbRDGYHjqZ06OcS3BjD7uAm8';
const PRIVATE_VAPID_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(
    'mailto:support@povodyr.vercel.app',
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY
  );
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET() {
  try {
    const { data: pendingNotifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .or('sent_push.eq.false,sent_email.eq.false')
      .limit(50);

    if (notifError || !pendingNotifications) {
      return NextResponse.json({ success: false, error: notifError?.message || 'No pending notifications' });
    }

    let pushCount = 0;
    let emailCount = 0;

    for (const item of pendingNotifications) {
      const userId = item.user_id;

      if (!item.sent_push && PRIVATE_VAPID_KEY) {
        const { data: subData } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', userId)
          .single();

        if (subData?.subscription) {
          try {
            const pushPayload = JSON.stringify({
              title: item.title,
              body: item.message,
              url: item.link_url || '/'
            });
            await webpush.sendNotification(subData.subscription, pushPayload);
            await supabase
              .from('notifications')
              .update({ sent_push: true })
              .eq('id', item.id);
            pushCount++;
          } catch (pErr) {
            console.error('Push error:', pErr);
          }
        }
      }

      if (!item.sent_email && resend) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (profile?.email) {
          try {
            await resend.emails.send({
              from: 'POVODYR <notifications@povodyr.vercel.app>',
              to: profile.email,
              subject: `Нова можливість: ${item.title}`,
              html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>${item.title}</h2>
                <p>${item.message}</p>
                <a href="${item.link_url || 'https://povodyr.vercel.app/dashboard'}" style="background: #2563eb; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 8px;">Переглянути деталі</a>
              </div>`
            });
            await supabase
              .from('notifications')
              .update({ sent_email: true })
              .eq('id', item.id);
            emailCount++;
          } catch (eErr) {
            console.error('Email error:', eErr);
          }
        }
      }
    }

    return NextResponse.json({ success: true, processed: pendingNotifications.length, pushCount, emailCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
