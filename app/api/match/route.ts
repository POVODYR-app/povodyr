import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface MatchRequestBody {
  userId: string;
}

interface ScoringResult {
  match_score: number;
  reasons_uk: string[];
  potential_benefit: string;
  application_complexity: string;
  estimated_time: string;
  commercial_fit?: number;
  best_matching_artwork?: string; // Назва найкращої картини для цієї можливості
}

export async function POST(request: Request) {
  try {
    const body: MatchRequestBody = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Параметр userId є обов’язковим' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Ключ OPENAI_API_KEY не налаштовано' }, { status: 500 });
    }

    // 1. Отримуємо профіль художника
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Профіль художника не знайдено' }, { status: 404 });
    }

    // 1.1. Отримуємо розширене портфоліо робіт митця
    const { data: artworks, error: artError } = await supabase
      .from('artist_artworks')
      .select('*')
      .eq('user_id', userId);

    if (artError) {
      console.error('Помилка завантаження портфоліо:', artError.message);
    }

    // 2. Актуальні можливості
    const nowISO = new Date().toISOString();
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('is_active', true)
      .or(`deadline.gte.${nowISO},deadline.is.null`)
      .order('created_at', { ascending: false })
      .limit(25);

    if (oppError) {
      return NextResponse.json({ error: oppError.message }, { status: 500 });
    }

    if (!opportunities || opportunities.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Немає актуальних можливостей для оцінки',
        matchesCreated: 0,
      });
    }

    let createdMatchesCount = 0;
    const errors: string[] = [];

    // Форматуємо портфоліо для передачі в AI
    const formattedArtworks = artworks && artworks.length > 0 
      ? artworks.map((art, idx) => `
        [Робота ${idx + 1}]
        - Назва: "${art.title}"
        - Посилання на фото: ${art.image_url || 'не вказано'}
        - Стилі: ${JSON.stringify(art.styles || [])}
        - Техніки: ${JSON.stringify(art.techniques_list || [])}
        - Матеріали: ${JSON.stringify(art.materials || [])}
        - Теми: ${JSON.stringify(art.themes || [])}
        - Типи робіт: ${JSON.stringify(art.work_types || [])}
        - Формати: категорія "${art.size_category}", основний формат: ${art.format_size}, мін: ${art.min_size}, макс: ${art.max_size || 'не вказано'}, великі формати можливі: ${art.large_format_possible ? 'так' : 'ні'}
        - Підходящі комерційні простори: ${JSON.stringify(art.suitable_spaces || [])}
      `).join('\n')
      : 'Портфоліо робіт ще не заповнено.';

    // 3. AI-скоринг з урахуванням конкретних картин
    for (const opp of opportunities) {
      try {
        const isCommercial = opp.opportunity_type === 'commercial_opportunity';

        const systemContent = isCommercial
          ? `Ти — головний куратор та AI-асистент арт-агенції POVODYR. Проаналізуй сумісність портфоліо робіт митця та КОМЕРЦІЙНОГО запиту. Зістав параметри конкретних картин (стилі, матеріали як сусальне золоте, техніки, формати, комерційні простори на кшталт готелів чи офісів) із запитом замовника.
Поверни відповідь СТРОГО у форматі JSON:
{
  "match_score": число від 0 до 100 (Commercial Fit),
  "commercial_fit": число від 0 до 100,
  "reasons_uk": ["пункт чому підходить 1", "пункт 2", "пункт 3"],
  "potential_benefit": "Опис потенційної комерційної вигоди (1 речення українською)",
  "application_complexity": "Низька | Середня | Висока",
  "estimated_time": "Наприклад: 1-2 години",
  "best_matching_artwork": "Назва найкращої картини з портфоліо для цього запиту або загальний висновок"
}`
          : `Ти — AI-асистент арт-агенції POVODYR. Проаналізуй сумісність профілю українського митця та його конкретних робіт із арт-можливістю (Open Call, резиденція, виставка).
Поверни відповідь СТРОГО у форматі JSON:
{
  "match_score": число від 0 до 100,
  "reasons_uk": ["короткий пункт чому підходить 1", "короткий пункт 2", "короткий пункт 3"],
  "potential_benefit": "Опис потенційної користі для кар'єри (1 речення українською)",
  "application_complexity": "Низька | Середня | Висока",
  "estimated_time": "Наприклад: 1-2 години або 2-3 дні",
  "best_matching_artwork": "Назва найбільш релевантної картини з портфоліо (якщо застосовно)"
}`;

        const userContent = isCommercial
          ? `Профіль художника:
- ПІБ: ${profile.full_name || 'Не вказано'}
- Біографія / Концепція: ${profile.bio || 'Не вказано'}
- Рівень митця: ${profile.artist_level || 'Не вказано'}
- Країни інтересу: ${JSON.stringify(profile.search_countries || [])}

ДЕТАЛЬНЕ ПОРТФОЛІО РОБІТ МИТЦЯ:
${formattedArtworks}

Комерційна можливість:
- Назва: ${opp.title}
- Підтип: ${opp.subtype || 'Не вказано'}
- Організація: ${opp.organization || 'Не вказано'}
- Опис: ${opp.description || opp.raw_description || ''}
- Що потрібно: ${opp.what_is_needed || 'Не вказано'}
- Бюджет / ціна: ${opp.budget || opp.price_range || 'Не вказано'}
- Бажані техніки: ${JSON.stringify(opp.preferred_techniques || opp.techniques) || '[]'}`
          : `Профіль художника:
- ПІБ: ${profile.full_name || 'Не вказано'}
- Біографія: ${profile.bio || 'Не вказано'}
- Рівень митця: ${profile.artist_level || 'Не вказано'}
- Країни інтересу: ${JSON.stringify(profile.search_countries || [])}

ДЕТАЛЬНЕ ПОРТФОЛІО РОБІТ МИТЦЯ:
${formattedArtworks}

Картка можливості:
- Назва: ${opp.title}
- Тип: ${opp.type || opp.category || 'Open Call'}
- Опис: ${opp.raw_description || opp.description || ''}
- Країна: ${opp.country || 'International'}
- Техніки: ${JSON.stringify(opp.techniques) || '[]'}
- Жанри: ${JSON.stringify(opp.genres) || '[]'}
- Дедлайн: ${opp.deadline || 'Не вказано'}
- Приймають українців: ${opp.ukrainians_eligible || opp.accepts_ukrainians ? 'Так' : 'Невідомо'}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        const parsedContent = completion.choices[0]?.message?.content;
        if (!parsedContent) continue;

        const scoreData: ScoringResult = JSON.parse(parsedContent);
        const finalScore = Math.max(0, Math.min(100, Math.round(scoreData.match_score)));
        const commercialFitVal = isCommercial
          ? Math.max(0, Math.min(100, Math.round(scoreData.commercial_fit || finalScore)))
          : null;

        const { error: upsertError } = await supabase
          .from('user_opportunity_matches')
          .upsert(
            {
              user_id: userId,
              opportunity_id: opp.id,
              match_score: finalScore,
              commercial_fit: commercialFitVal,
              reasons_uk: scoreData.reasons_uk || [],
              potential_benefit: scoreData.potential_benefit || '',
              application_complexity: scoreData.application_complexity || 'Середня',
              estimated_time: scoreData.estimated_time || '',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,opportunity_id' }
          );

        if (!upsertError) {
          createdMatchesCount++;
        } else {
          errors.push(`Upsert: ${opp.title} — ${upsertError.message}`);
        }
      } catch (err: any) {
        errors.push(`AI: ${opp.title} — ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      matchesProcessed: opportunities.length,
      matchesCreated: createdMatchesCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Невідома помилка';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
