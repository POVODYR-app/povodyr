import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // 1. Отримуємо всіх користувачів
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (usersError) {
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'Немає користувачів', sent: 0 });
    }

    let sentCount = 0;
    const logs: any[] = [];

    for (const user of users) {
      const title = 'POVODYR сьогодні перевірив можливості';
      const message = `Привіт${user.full_name ? ', ' + user.full_name : ''}!

POVODYR сьогодні перевірив нові можливості.
На жаль, нічого ідеально підходящого під ваш профіль не знайдено.
Я працюю і продовжую шукати.`;

      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: title,
        message: message,
        link_url: 'https://povodyr.vercel.app/dashboard',
        is_read: false,
        sent_push: false,
        sent_email: false,
        created_at: new Date().toISOString()
      });

      if (!error) {
        sentCount++;
        logs.push({ user: user.full_name || user.id, status: 'sent' });
      } else {
        logs.push({ user: user.full_name || user.id, status: 'error', error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total_users: users.length,
      details: logs
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
