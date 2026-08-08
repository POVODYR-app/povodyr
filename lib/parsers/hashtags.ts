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

  // Приклад підключення до Telegram API, RSS-стрічок або зовнішнього Scraper API
  for (const tag of targetHashtags) {
    try {
      // Тут виконується запит до вашого джерела даних за хештегом
      // const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(tag)}`);
      // const posts = await response.json();
      
      // Логіка обробки отриманих дописів
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
    // Перевіряємо, чи немає вже такого посилання в базі
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
