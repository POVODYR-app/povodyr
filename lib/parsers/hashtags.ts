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

export async function fetchOpportunitiesByHashtags(): Promise<HashtagOpportunity[]> {
  const targetHashtags = ['#opencall', '#мистецькийконкурс'];
  const results: HashtagOpportunity[] = [];

  for (const tag of targetHashtags) {
    try {
      // Логіка запиту до джерел за хештегом
    } catch (err) {
      console.error(`Помилка парсингу за хештегом ${tag}:`, err);
    }
  }

  return results;
}

export async function saveHashtagOpportunitiesToDb(items: HashtagOpportunity[]) {
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
