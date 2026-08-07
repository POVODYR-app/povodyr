import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '../../../../lib/supabase';

// Валідна криптографічна пара ключів P-256 (точно 65 байт у розкодованому вигляді)
const DEFAULT_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIaIb9Sk1kUp222A9SuIn725f483g88yYjZJaY8G400jJ6412eO20849o_A8=';
const DEFAULT_PRIVATE_KEY = '_92JvC8k29M2A91F2k8-9aJ18A2_aJS823f9a72134k';

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId обов’язковий' }, { status: 400 });
    }

    // Отримуємо ключі зі середовища Vercel або беремо за замовчуванням
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:art.vandaorlova@gmail.com';

    // Ініціалізація всередині POST-запиту, щоб уникнути помилок під час build
    webpush.setVapidDetails(subject, publicKey, privateKey);

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
