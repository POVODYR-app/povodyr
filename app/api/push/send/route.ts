import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '../../../../lib/supabase';

// 100% валідна криптографічна пара ключів P-256
const PUBLIC_KEY = 'BIN2Jc5Vmkmy-S3AUrcMlpKxJpLeVRAfu9WBqUbJ70SJOCWGCGXKY-Xzyh7HDr6KbRDGYHjqZ06OcS3BjD7uAm8';
const PRIVATE_KEY = 'bdSiNzUhUP6piAxLH-tW88zfBlWWveIx0dAsDO66aVU';

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId обов’язковий' }, { status: 400 });
    }

    // Примусово використовуємо валідні ключі
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
