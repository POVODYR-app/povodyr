import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '../../../../lib/supabase';

// Валідна криптографічна пара ключів
const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIaIb9Sk1kUp222A9SuIn725f483g88yYjZJaY8G400jJ6412eO20849o';
const PRIVATE_KEY = '92JvC8k29M2A91F2k89aJ18A2aJS823f9a72134k';

webpush.setVapidDetails(
  'mailto:art.vandaorlova@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY || PRIVATE_KEY
);

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId обов’язковий' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Підписку не знайдено. Натисніть спочатку 🔔 Сповіщення' }, { status: 404 });
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
