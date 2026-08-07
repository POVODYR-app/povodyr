import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId обов’язковий' }, { status: 400 });
    }

    // Перевірка наявності ключів
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:art.vandaorlova@gmail.com';

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: 'VAPID ключі відсутні у Vercel' }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    // Отримуємо підписку користувача з Supabase
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Підписку не знайдено у базі даних. Спочатку натисніть 🔔 Сповіщення' }, { status: 404 });
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
