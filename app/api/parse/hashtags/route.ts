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

// Перевірка, чи можливість для художників
function isForArtists(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();

  const artistKeywords = [
    'художник', 'художниц', 'artist', 'visual artist', 'contemporary art',
    'живопис', 'painting', 'скульптур', 'sculpture', 'мистецтв', 'арт',
    'виставка', 'exhibition', 'галере', 'gallery', 'музей', 'museum',
    'бієнале', 'biennale', 'трієнале', 'open call', 'opencall',
    'арт-резиденція', 'art residence', 'residency', 'грант для художників',
    'visual arts', 'fine art', 'contemporary artist'
  ];

  // Якщо є хоча б одне ключове слово — підходить
  return artistKeywords.some(keyword => text.includes(keyword));
}

// Визначення типу можливості
function detectOpportunityType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  if (
    text.includes('grant') ||
    text.includes('грант') ||
    text.includes('фінансування') ||
    text.includes('funding') ||
    text.includes('стипендія')
  ) {
    return 'grant';
  }

  if (
    text.includes('residence') ||
    text.includes('резиденція') ||
    text.includes('арт-резиденція') ||
    text.includes('art residence') ||
    text.includes('residency')
  ) {
    return 'art_residence';
  }

  return 'open_call';
}

async function fetchOpportunitiesByHashtags(): Promise<HashtagOpportunity[]> {
  const targetHashtags = [
    '#opencall', '#мистецькийконкурс', 'open call', 'конкурс',
    'grant', 'грант', 'residence', 'резиденція', 'artist', 'художник'
  ];

  const results: HashtagOpportunity[] = [];

  const sources = [
    { url: 'https://prostir.ua/feed/', name: 'Громадський Простір' },
    { url: 'https://biggggidea.com/rss/', name: 'Велика Ідея' }
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 0 }
      });

      if (!res.ok) continue;

      const xmlText = await res.text();
      const items = xmlText.split('<item>');

      for (let i = 1; i < items.length; i++) {
        const itemXml = items[i];
        const lowerXml = itemXml.toLowerCase();

        const hasMatch = targetHashtags.some(tag => lowerXml.includes(tag.toLowerCase()));

        if (hasMatch) {
          const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
          const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
          const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

          const rawTitle = titleMatch ? titleMatch[1].trim() : 'Нова можливість';
          const linkUrl = linkMatch ? linkMatch[1].trim() : source.url;
          const rawDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

          // Головна перевірка: тільки для художників
          if (!isForArtists(rawTitle, rawDesc)) {
            continue; // пропускаємо, якщо не для художників
          }

          results.push({
            title: rawTitle.substring(0, 120),
            description: rawDesc.substring(0, 500),
            link_url: linkUrl,
            source_platform: source.name,
            tags: ['#opencall', '#дляхудожників']
          });
        }
      }
    } catch (err) {
      console.error(`Помилка парсингу джерела ${source.name}:`, err);
    }
  }

  if (results.length === 0) {
    results.push({
      title: 'Моніторинг можливостей для художників активовано',
      description: 'Система POVODYR шукає open call, гранти та резиденції виключно для художників.',
      link_url: `https://povodyr.vercel.app/dashboard?tag_check=${Date.now()}`,
      source_platform: 'Hashtag System Monitor',
      tags: ['#opencall']
    });
  }

  return results;
}

async function saveHashtagOpportunitiesToDb(items: HashtagOpportunity[]) {
  if (!items || items.length === 0) return { insertedCount: 0, logs: [] };

  let insertedCount = 0;
  const logs: any[] = [];

  for (const item of items) {
    const { data: existing, error: selectErr } = await supabase
      .from('opportunities')
      .select('id')
      .eq('link_url', item.link_url)
      .maybeSingle();

    if (selectErr) {
      logs.push({ title: item.title, status: 'error_select', error: selectErr.message });
      continue;
    }

    if (!existing) {
      const detectedType = detectOpportunityType(item.title, item.description);

      const { error: insertErr } = await supabase.from('opportunities').insert({
        title: item.title,
        description: item.description,
        link_url: item.link_url,
        source: item.source_platform,
        category: detectedType === 'grant' ? 'Grant' : detectedType === 'art_residence' ? 'Art Residence' : 'Open Call',
        type: detectedType,
        is_active: true,
        created_at: new Date().toISOString(),
      });
