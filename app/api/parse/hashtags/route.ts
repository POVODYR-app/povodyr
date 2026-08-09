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

function isForArtists(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();

  const artistKeywords = [
    'художник', 'художниц', 'artist', 'visual artist', 'contemporary art',
    'живопис', 'painting', 'картин', 'скульптур', 'sculpture', 'мистецтв', 'арт',
    'виставка', 'exhibition', 'галере', 'gallery', 'музей', 'museum',
    'бієнале', 'biennale', 'open call', 'opencall',
    'арт-резиденція', 'art residence', 'residency',
    'visual arts', 'fine art', 'інтер\'єр', 'interior', 'horeca',
    'готель', 'ресторан', 'кафе', 'hotel', 'restaurant', 'cafe'
  ];

  return artistKeywords.some(keyword => text.includes(keyword));
}

function detectOpportunityType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  if (
    text.includes('horeca') ||
    text.includes('готель') ||
    text.includes('ресторан') ||
    text.includes('кафе') ||
    text.includes('hotel') ||
    text.includes('restaurant') ||
    text.includes('cafe') ||
    text.includes('інтер\'єр') ||
    text.includes('interior') ||
    text.includes('для інтер\'єру') ||
    text.includes('дизайн інтер\'єру') ||
    text.includes('оформлення') ||
    text.includes('закупівл') ||
    text.includes('придбання картин') ||
    text.includes('купити картину')
  ) {
    return 'horeca';
  }

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
    '#opencall',
    '#мистецькийконкурс',
    'open call',
    'конкурс',
    'grant',
    'грант',
    'residence',
    'резиденція',
    'artist',
    'художник',
    '#horeca',
    'horeca',
    'готель',
    'ресторан',
    'кафе',
    'інтер\'єр',
    'interior',
    'дизайн інтер\'єру',
    'картини для готелю',
    'картини для ресторану',
    'закупівлі мистецтва',
    'art for hotels',
    'art for restaurants'
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

          if (!isForArtists(rawTitle, rawDesc)) {
            continue;
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
      console.error(`Помилка парсингу джерела ${source
