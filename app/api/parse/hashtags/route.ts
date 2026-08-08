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

  // Джерела публічних Telegram-каналів з мистецькими можливостями
  const publicChannels = [
    'https://t.me/s/culture_ukraine',
    'https://t.me/s/art_opportunities_ua'
  ];

  for (const channelUrl of publicChannels) {
    try {
      const res = await fetch(channelUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cache: 'no-store'
      });

      if (!res.ok) continue;

      const html = await res.text();

      // Базовий розбір блоків повідомлень
      const posts = html.split('js-widget_message');

      for (const postHtml of posts) {
        const lowerHtml = postHtml.toLowerCase();
        
        // Перевіряємо наявність потрібних хештегів
        const matchedTags = targetHashtags.filter(tag => lowerHtml.includes(tag.toLowerCase()));

        if (matchedTags.length > 0) {
          // Витягуємо текст допису
          const textMatch = postHtml.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
          if (!textMatch) continue;

          const rawText = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
          if (!rawText) continue;

          // Витягуємо посилання на допис
          const linkMatch = postHtml.match(/href="(https:\/\/t\.me\/[^"]+\/\d+)"/);
          const linkUrl = linkMatch ? linkMatch[1] : channelUrl;

          // Формуємо заголовок з першого рядка
          const firstLine = rawText.split('\n')[0].replace(/[^\w\sа-яА-ЯєєіїґҐ#–—-]/gi, '').trim();
          const title = firstLine.length > 5 ? firstLine.substring(0, 100) : `Open Call за хештегом ${matchedTags.join(', ')}`;

          results.push({
            title,
            description: rawText.substring(0, 500),
            link_url: linkUrl,
            source_platform: 'Telegram Hashtag Monitor',
            tags: matchedTags
          });
        }
      }
    } catch (err) {
      console.error(`Помилка отримання даних з ${channelUrl}:`, err);
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
