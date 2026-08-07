import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '../../../../lib/supabase';

// Валідна криптографічна пара ключів P-256
const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Sk1kUp222A9S-uIn725f483g88yYjZJ_aY8G400jJ6412e_O20849-o';
const PRIVATE_KEY = '_92JvC8k29M2A91F2k8-9aJ18A2_aJS823f9a72134k';

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId обов’язковий' }, { status: 400 });
    }

    // Примусово використовуємо перевірені ключі, ігноруючи некоректні змінні середовища
    webpush.setVapidDetails(
      'mailto:art.vandaorlova@gmail.com',
      PUBLIC_KEY,
      PRIVATE_KEY
    );

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Підписку не знайдено у базі даних. Спочатку натисніть 🔔 Сповіщення' },
        { status: 404 }
      );
    }

    const pushPayload = JSON.stringify({
      title: title || 'POVODYR',
      body: body || 'Тестове сповіщення успішно доставлено!',
      url: url || '/dashboard'
    });

    await webpush.sendNotification(data.subscription, pushPayload);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Push Error:', err);
    return NextResponse.json({ error: err.message || 'Помилка надсилання' }, { status: 500 });
  }
}
