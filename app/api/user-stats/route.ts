import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    const userId = request.nextUrl.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 });
    }

    // 1. Свіжі надходження за останню добу (для плашки статистики)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount, error: dailyError } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    if (dailyError) throw dailyError;

    // 2. Персональні можливості за останній місяць (30 днів) для Центру можливостей
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: monthlyOpps, error: monthlyError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('is_active', true)
      .gte('created_at', thirtyDaysAgo);

    if (monthlyError) throw monthlyError;

    let matchedCount = 0;
    if (profile && monthlyOpps) {
      const userCountries = parseArrayField(profile.search_countries);
      const userTechniques = parseArrayField(profile.techniques);
      const orgFeeMax = Number(profile.org_fee_max || profile.max_fee_amount) || 0;

      matchedCount = monthlyOpps.filter(opp => {
        if (userCountries.length > 0 && opp.country) {
          const oppCountry = String(opp.country).toLowerCase();
          
          // Перевіряємо чи це глобальна подія / онлайн / світ
          const isGlobal = oppCountry.includes('онлайн') || 
                           oppCountry.includes('світ') || 
                           oppCountry.includes('international') ||
                           oppCountry.includes('worldwide') ||
                           oppCountry.includes('усі');

          // Суворіший збіг країн: перевіряємо чи користувач шукає саме цю країну
          const countryMatch = userCountries.some(c => {
            const cleanC = c.trim();
            // Точний збіг або повне входження слова без хибних спрацьовувань коротких підрядків
            return oppCountry === cleanC || oppCountry.split(/[,/]/).map(item => item.trim()).includes(cleanC);
          });

          if (!countryMatch && !isGlobal) {
            return false;
          }
        }
        if (userTechniques.length > 0 && opp.techniques) {
          const oppTechs = parseArrayField(opp.techniques);
          if (oppTechs.length > 0) {
            const techMatch = userTechniques.some(ut => oppTechs.some(ot => ot.includes(ut) || ut.includes(ot)));
            if (!techMatch) return false;
          }
        }
        const fee = Number(opp.cost_amount || opp.fee_amount || opp.org_fee) || 0;
        if (fee > orgFeeMax && orgFeeMax > 0 && !opp.is_free) return false;
        return true;
      }).length;
    } else {
      matchedCount = monthlyOpps?.length || 0;
    }

    // 3. Збережені можливості та перевірка дедлайнів на найближчі 7 днів (для дзвіночка)
    const { data: bookmarks, error: bookmarkError } = await supabase
      .from('saved_opportunities')
      .select('id, opportunity_id, opportunities(*)')
      .eq('user_id', userId);

    if (bookmarkError) throw bookmarkError;

    const now = new Date();
    const upcomingDeadlines = (bookmarks || []).map((b: any) => b.opportunities).filter((opp: any) => {
      if (!opp || !opp.deadline) return false;
      const deadlineDate = new Date(opp.deadline);
      const diffDays = (deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    });

    return NextResponse.json({
      success: true,
      daily_count: dailyCount || 0,
      monthly_matched_count: matchedCount,
      upcoming_deadlines_count: upcomingDeadlines.length,
      upcoming_deadlines: upcomingDeadlines,
      saved_bookmarks: bookmarks || []
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
