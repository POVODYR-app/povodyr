import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Допоміжна функція нормалізації технік
function parseArrayField(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(i => String(i).toLowerCase().trim());
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(i => String(i).toLowerCase().trim());
    } catch {
      return raw.split(',').map(i => i.toLowerCase().trim());
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    // Авторизація за запитом для захисту Cron (опціонально перевіряє CRON_SECRET)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Отримуємо активні профілі користувачів
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('profile_completed', true)
      .eq('notifications_enabled', true);

    if (usersError) {
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Немає користувачів з заповненим профілем та увімкненими сповіщеннями', 
        sent: 0 
      });
    }

    // 2. Отримуємо актуальні можливості (створені/оновлені нещодавно чи з діючим дедлайном)
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (oppError) {
      return NextResponse.json({ success: false, error: oppError.message }, { status: 500 });
    }

    let sentCount = 0;
    const logs: any[] = [];

    // 3. Матчинг можливостей під кожен профіль
    for (const user of users) {
      const userCountries = parseArrayField(user.search_countries);
      const userTechniques = parseArrayField(user.techniques);
      const orgFeeMax = Number(user.org_fee_max) || 0;
      const regFeeMax = Number(user.reg_fee_max) || 0;

      // Фільтрація відповідних можливостей
      const matchedOpps = (opportunities || []).filter(opp => {
        // Перевірка країни
        if (userCountries.length > 0 && opp.country) {
          const oppCountry = String(opp.country).toLowerCase();
          const countryMatch = userCountries.some(c => oppCountry.includes(c) || c.includes(oppCountry));
          if (!countryMatch && !oppCountry.includes('онлайн') && !oppCountry.includes('світ')) {
            return false;
          }
        }

        // Перевірка технік / категорій
        if (userTechniques.length > 0 && opp.techniques) {
          const oppTechs = parseArrayField(opp.techniques);
          if (oppTechs.length > 0) {
            const techMatch = userTechniques.some(ut => oppTechs.some(ot => ot.includes(ut) || ut.includes(ot)));
            if (!techMatch) return false;
          }
        }

        // Перевірка бюджетних обмежень (якщо вказано в можливості)
        if (opp.org_fee && Number(opp.org_fee) > orgFeeMax && orgFeeMax > 0) return false;
        if (opp.reg_fee && Number(opp.reg_fee) > regFeeMax && regFeeMax > 0) return false;

        return true;
      });

      // 4. Формування тексту сповіщення
      let title = 'POVODYR: нові можливості для вас';
      let message = '';

      if (matchedOpps.length > 0) {
        const oppList = matchedOpps.slice(0, 3).map(o => `• ${o.title || 'Мистецька можливість'}`).join('\n');
        message = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nЗнайдено ${matchedOpps.length} нових можливостей під ваш профіль:\n\n${oppList}\n\nПерегляньте деталі в особистому кабінеті.`;
      } else {
        title = 'POVODYR сьогодні перевірив можливості';
        message = `Привіт${user.full_name ? ', ' + user.full_name : ''}!\n\nPOVODYR сьогодні перевірив нові можливості.\nНаразі нових оновлень під ваш профіль не знайдено.\nПошук триває щодня.`;
      }

      // 5. Запис у базу даних
      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: user.id,
        title,
        message,
        link_url: 'https://povodyr.vercel.app/dashboard',
        is_read: false,
        sent_push: false,
        sent_email: false,
        created_at: new Date().toISOString()
      });

      if (!insertError) {
        sentCount++;
        logs.push({ user: user.full_name || user.id, matched: matchedOpps.length, status: 'sent' });
      } else {
        logs.push({ user: user.full_name || user.id, status: 'error', error: insertError.message });
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

export async function POST(request: NextRequest) {
  return GET(request);
}
