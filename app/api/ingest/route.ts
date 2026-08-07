import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface IngestRequestBody {
  sourceId?: string;
  rawText: string;
  originalUrl: string;
}

interface ParsedOpportunity {
  title: string;
  description_uk: string;
  category: string;
  subcategories: string[];
  country: string;
  deadline: string | null;
  is_free: boolean;
  fee_amount: string | null;
  genres: string[];
  techniques: string[];
  professional_level: string[];
  languages: string[];
  accepts_ukrainians: boolean;
}

export async function POST(request: Request) {
  try {
    const body: IngestRequestBody = await request.json();
    const { sourceId, rawText, originalUrl } = body;

    if (!rawText || !originalUrl) {
      return NextResponse.json(
        { error: 'Параметри rawText та originalUrl є обов’язковими' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Ключ OPENAI_API_KEY не налаштовано у змінних оточення' },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ти — експерт-аналітик у сфері образотворчого мистецтва. Проаналізуй текст оголошення та поверни відповідь СТРОГО у форматі JSON за схемою:
{
  "title": "Назва події або гранту",
  "description_uk": "Стислий виклад умов українською мовою (2-3 речення)",
  "category": "одне значення: open_call | grants | residencies | contests | commercial | educational",
  "subcategories": ["виставки", "бієнале"],
  "country": "Країна проведення або Міжнародний",
  "deadline": "YYYY-MM-DDTHH:mm:ssZ або null, якщо дедлайн відсутній",
  "is_free": true/false (чи безкоштовна подача),
  "fee_amount": "сума оргвнеску або Безкоштовно",
  "genres": ["живопис", "скульптура"],
  "techniques": ["олія", "акрил"],
  "professional_level": ["Початковий", "Професійний / Emerging"],
  "languages": ["англійська", "українська"],
  "accepts_ukrainians": true/false
}`,
        },
        {
          role: 'user',
          content: `Текст оголошення:\n${rawText}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const parsedContent = completion.choices[0]?.message?.content;
    if (!parsedContent) {
      return NextResponse.json(
        { error: 'Не вдалося отримати відповідь від OpenAI' },
        { status: 500 }
      );
    }

    const parsedData: ParsedOpportunity = JSON.parse(parsedContent);

    const { data: insertedData, error: dbError } = await supabase
      .from('opportunities')
      .upsert(
        {
          source_id: sourceId || null,
          title: parsedData.title,
          description_uk: parsedData.description_uk,
          original_url: originalUrl,
          category: parsedData.category,
          subcategories: parsedData.subcategories,
          country: parsedData.country,
          deadline: parsedData.deadline,
          is_free: parsedData.is_free,
          fee_amount: parsedData.fee_amount,
          genres: parsedData.genres,
          techniques: parsedData.techniques,
          professional_level: parsedData.professional_level,
          languages: parsedData.languages,
          accepts_ukrainians: parsedData.accepts_ukrainians,
        },
        { onConflict: 'original_url' }
      )
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, opportunity: insertedData });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Невідома помилка';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
