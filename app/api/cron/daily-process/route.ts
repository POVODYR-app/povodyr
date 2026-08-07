import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import webpush from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Налаштування VAPID ключів
if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function GET() {
  try {
    // 1. Отримуємо всі активні профілі користувачів
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profileError || !profiles) {
      return NextResponse.json({ error: 'Не вдалося отримати профілі' }, { status: 500 });
    }

    let totalNotificationsSent = 0;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // 2. Для кожного користувача запускаємо AI Match
    for (const user of profiles) {
      try {
        await fetch(`${baseUrl}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch (e) {
        console.error(`Помилка match для ${user.id}:`, e);
      }

      // 3. Перевіряємо наявність збереженої Push-підписки
      const { data: subData } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', user.id)
        .single();

      if (subData?.subscription) {
        // Отримуємо кількість високих збігів (match_score >= 70)
        const { count } = await supabase
          .from('user_opportunity_matches')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('match_score', 70);

        if (count && count > 0) {
          const payload = JSON.stringify({
            title: 'Нові арт-можливості!',
            body: `Доброго ранку! Знайдено ${count} нових пропозицій з високим відсотком відповідності.`,
            url: '/dashboard',
          });

          try {
            await webpush.sendNotification(
              subData.subscription as unknown as webpush.PushSubscription,
              payload
            );
            totalNotificationsSent++;
          } catch (pushErr) {
            console.error('Помилка відправки push:', pushErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedUsers: profiles.length,
      notificationsSent: totalNotificationsSent,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Невідома помилка';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
