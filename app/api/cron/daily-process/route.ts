import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import * as webpush from 'web-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ініціалізація VAPID ключів
    if (
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
    ) {
      try {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT,
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
      } catch (vError) {
        console.error('Помилка конфігурації VAPID ключів:', vError);
      }
    }

    // 1. Отримуємо всі активні профілі користувачів
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profileError || !profiles) {
      return NextResponse.json({ error: 'Не вдалося отримати профілі' }, { status: 500 });
    }

    let totalNotificationsSent = 0;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    for (const user of profiles) {
      // 2. Запускаємо AI Match
      try {
        await fetch(`${baseUrl}/api/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch (e) {
        console.error(`Помилка match для ${user.id}:`, e);
      }

      // 3. Отримуємо збережені збіги з деталями та датами дедлайнів
      const { data: matches } = await supabase
        .from('user_opportunity_matches')
        .select(`
          id,
          opportunity_id,
          match_score,
          opportunities (
            title,
            description,
            link,
            deadline
          )
        `)
        .eq('user_id', user.id)
        .gte('match_score', 70);

      if (matches && matches.length > 0) {
        const today = new Date();
        
        for (const match of matches) {
          const opp = match.opportunities as any;
          if (!opp) continue;

          // Збереження нового збігу
          await supabase.from('notifications').insert([
            {
              user_id: user.id,
              title: opp.title || 'Нова арт-можливість',
              message: opp.description || `Відповідність профілю: ${match.match_score}%`,
              link_url: opp.link || '',
              is_read: false,
            },
          ]);

          // 4. Перевірка наближення дедлайнів (3 дні та 1 день)
          if (opp.deadline) {
            const deadlineDate = new Date(opp.deadline);
            const timeDiff = deadlineDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

            if (daysLeft === 3 || daysLeft === 1) {
              const deadlineMessage = daysLeft === 1
                ? `⚠️ Завтра дедлайн подачі на "${opp.title}"!`
                : `⏳ Залишилося 3 дні до дедлайну на "${opp.title}"!`;

              // Запис нагадування про дедлайн у внутрішню базу сповіщень
              await supabase.from('notifications').insert([
                {
                  user_id: user.id,
                  title: '⏰ Нагадування про дедлайн',
                  message: deadlineMessage,
                  link_url: opp.link || '',
                  is_read: false,
                },
              ]);

              // Надсилання Push-сповіщення на пристрій
              const { data: subData } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', user.id)
                .single();

              if (subData?.subscription) {
                try {
                  await webpush.sendNotification(
                    subData.subscription as any,
                    JSON.stringify({
                      title: '⏰ Дедлайн наближається!',
                      body: deadlineMessage,
                      url: '/dashboard',
                    })
                  );
                  totalNotificationsSent++;
                } catch (pushErr) {
                  console.error('Помилка відправки push-нагадування:', pushErr);
                }
              }
            }
          }
        }

        // 5. Загальне Push-сповіщення про нові пропозиції
        const { data: subData } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .eq('user_id', user.id)
          .single();

        if (subData?.subscription) {
          try {
            await webpush.sendNotification(
              subData.subscription as any,
              JSON.stringify({
                title: 'Нові арт-можливості!',
                body: `Доброго ранку! Знайдено ${matches.length} нових пропозицій з високим відсотком відповідності.`,
                url: '/dashboard',
              })
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
