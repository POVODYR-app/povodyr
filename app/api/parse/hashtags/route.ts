import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isForArtists(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();
  const keywords = [
    'художник', 'artist', 'живопис', 'painting', 'картин', 'мистецтв', 'арт',
    'виставка', 'exhibition', 'галере', 'gallery', 'open call', 'opencall',
    'резиденція', 'residence', 'grant', 'грант', 'horeca', 'готель', 'ресторан',
    'кафе', 'інтер\'єр', 'interior', 'hotel', 'restaurant'
  ];
  return keywords.some(k => text.includes(k));
}

function detectType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  if (text.includes('horeca') || text.includes('готель') || text.includes('ресторан') || 
      text.includes('кафе') || text.includes('інтер\'єр') || text.includes('interior') ||
      text.includes('hotel') || text.includes('restaurant') || text.includes('cafe')) {
    return 'horeca';
  }
  if (text.includes('grant') || text.includes('грант') || text.includes('фінансування')) {
    return 'grant';
  }
  if (text.includes('residence') || text.includes('резиденція') || text.includes('art residence')) {
    return 'art_residence';
  }
  return 'open_call';
}

async function fetchOpportunities() {
  const targetHashtags = [
    '#opencall', 'open call', 'конкурс', 'grant', 'грант', 'residence', 'резиденція',
    'художник', 'artist', 'horeca', 'готель', 'ресторан', 'кафе', 'інтер\'єр', 'interior'
  ];

  const results: any[] = [];
  const sources = [
    { url: 'https://prostir.ua/feed/', name: 'Громадський Простір' },
    { url: 'https://biggggidea.com/rss/', name: 'Велика Ідея' }
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 }
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = xml.split('<item>');

      for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const lower = item.toLowerCase();
        if (!targetHashtags.some(tag => lower.includes(tag.toLowerCase()))) continue;

        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

        const title = titleMatch ? titleMatch[1].trim().substring(0, 120) : 'Нова можливість';
        const link = linkMatch ? linkMatch[1].trim() : source.url;
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 500) : '';

        if (!isForArtists(title, desc)) continue;

        results.push({
          title,
          description: desc,
          link_url: link,
          source_platform: source.name
        });
      }
    } catch (err) {
      console.error('Помилка джерела:', source.name, err);
    }
  }

  return results;
}

async function saveToDb(items: any[]) {
  let inserted = 0;
  const logs: any[] = [];

  for (const item of items) {
    const { data: existing } = await supabase
      .from('opportunities')
      .select('id')
      .eq('link_url', item.link_url)
      .maybeSingle();

    if (existing) {
      logs.push({ title: item.title, status: 'exists' });
      continue;
    }

    const type = detectType(item.title, item.description);
    let category = 'Open Call';
    if (type === 'grant') category = 'Grant';
    if (type === 'art_residence') category = 'Art Residence';
    if (type === 'horeca') category = 'HoReCa';

    const { error } = await supabase.from('opportunities').insert({
      title: item.title,
      description: item.description,
      link_url: item.link_url,
      source: item.source_platform,
      category,
      type,
      is_active: true,
      created_at: new Date().toISOString()
    });

    if (!error) {
      inserted++;
      logs.push({ title: item.title, status: 'inserted', type });
    } else {
      logs.push({ title: item.title, status: 'error', error: error.message });
    }
  }

  return { inserted, logs };
}

export async function GET() {
  try {
    const items = await fetchOpportunities();
    const { inserted, logs } = await saveToDb(items);

    return NextResponse.json({
      success: true,
      found: items.length,
      saved: inserted,
      details: logs
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
