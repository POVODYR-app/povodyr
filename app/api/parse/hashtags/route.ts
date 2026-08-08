import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface HashtagOpportunity {
  title: string;
  description: string;
  link_url: string;
  source_platform: string;
  tags: string[];
}

async function fetchOpportunitiesByHashtags(): Promise<HashtagOpportunity[]> {
  const targetHashtags = ['#opencall', '#мистецькийконкурс'];
  const results: HashtagOpportunity[] = [];

  for (const tag of targetHashtags) {
    try {
      // Тут виконується збір даних за відповідним хештегом
    } catch (err) {
      console.error(`Помилка парсингу за хештегом ${tag}:`, err);
    }
  }

  return results;
}

async function saveHashtagOpportunitiesToDb(items: HashtagOpportunity[]) {
  if (!items || items.length === 0) return 0;

  let insertedCount = 0;

  for (const item of items) {
    const { data: existing } = await supabase
      .from('opportunities')
      .select('id')
      .eq('link_url', item.link_url)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('opportunities').insert({
        title: item.title,
        description: item.description,
        link_url: item.link_url,
        source: item.source_platform,
        category: 'Open Call',
        is_active: true,
        created_at: new Date().toISOString(),
      });

      if (!error) {
        insertedCount++;
      }
    }
  }

  return insertedCount;
}

export async function GET() {
  try {
    const fetchedItems = await fetchOpportunitiesByHashtags();
    const savedCount = await saveHashtagOpportunitiesToDb(fetchedItems);

    return NextResponse.json({
      success: true,
      found: fetchedItems.length,
      saved: savedCount,
      hashtags: ['#opencall', '#мистецькийконкурс'],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET();
}
