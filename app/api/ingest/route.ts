import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchFromApprovedSources, ParsedOpportunity } from '../../../lib/parser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const logs: string[] = [];
  const errors: string[] = [];

  try {
    // Захист від випадкового виклику
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    logs.push(`[${new Date().toISOString()}] Запуск ingest...`);

    // 1. Збираємо можливості
    const fetchedItems: ParsedOpportunity[] = await fetchFromApprovedSources(logs);
    logs.push(`Отримано елементів з парсера: ${fetchedItems.length}`);

    if (!fetchedItems || fetchedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Парсер не знайшов жодної можливості',
        total_fetched: 0,
        new_inserted: 0,
        updated: 0,
        execution_logs: logs,
      });
    }

    let newInserted = 0;
    let updated = 0;
    let skipped = 0;

    // 2. Обробляємо кожну можливість
    for (const item of fetchedItems) {
      const link = item.link || item.source_url;
      if (!link) {
        logs.push(`Пропущено (немає link): ${item.title}`);
        skipped++;
        continue;
      }

      // Нормалізація під реальну структуру таблиці opportunities
      const record = {
        title: (item.title || 'Без назви').substring(0, 300),
        source_name: item.source_name || 'Unknown',
        source_url: item.source_url || link,
        link: link,
        type: item.type || 'Open Call',
        category: item.type || 'Open Call',
        country: item.country || 'International',
        is_free: item.is_free ?? true,
        cost_amount: item.cost_amount ?? 0,
        fee_amount: item.cost_amount ?? 0,
        cost_currency: item.cost_currency || 'EUR',
        techniques: Array.isArray(item.techniques) ? item.techniques : [],
        genres: Array.isArray(item.genres) ? item.genres : [],
        artist_levels: Array.isArray(item.artist_levels) ? item.artist_levels : [],
        languages: Array.isArray(item.languages) ? item.languages : ['en'],
        ukrainians_eligible: item.ukrainians_eligible ?? true,
        accepts_ukrainians: item.ukrainians_eligible ?? true,
        raw_description: item.raw_description || '',
        description: item.raw_description || '',
        description_uk: item.raw_description || '',
        deadline: item.deadline || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      // Перевіряємо, чи вже є запис
      const { data: existing, error: selectError } = await supabase
        .from('opportunities')
        .select('id')
        .eq('link', link)
        .maybeSingle();

      if (selectError) {
        errors.push(`Select error (${link}): ${selectError.message}`);
        continue;
      }

      if (existing?.id) {
        // Оновлюємо існуючий запис
        const { error: updateError } = await supabase
          .from('opportunities')
          .update(record)
          .eq('id', existing.id);

        if (updateError) {
          errors.push(`Update error (${item.title}): ${updateError.message}`);
        } else {
          updated++;
          logs.push(`Оновлено: ${item.title}`);
        }
      } else {
        // Вставляємо новий
        const { error: insertError } = await supabase
          .from('opportunities')
          .insert({
            ...record,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          if (insertError.code === '23505') {
            // Конфлікт унікальності — просто пропускаємо
            skipped++;
            logs.push(`Вже існує (unique): ${link}`);
          } else {
            errors.push(`Insert error (${item.title}): ${insertError.message}`);
          }
        } else {
          newInserted++;
          logs.push(`Успішно збережено: ${item.title}`);
        }
      }
    }

    logs.push(`Готово. Нових: ${newInserted}, оновлено: ${updated}, пропущено: ${skipped}`);

    return NextResponse.json(
      {
        success: true,
        total_fetched: fetchedItems.length,
        new_inserted: newInserted,
        updated,
        skipped,
        execution_logs: logs,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Ingest fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        execution_logs: logs,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
