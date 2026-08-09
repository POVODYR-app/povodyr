import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isForArtists(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();

  // Обов'язкові мистецькі слова
  const mustHave = [
    'художник', 'художниц', 'artist', 'живопис', 'painting', 'картин',
    'скульптур', 'мистецтв', 'арт-', 'art ', 'виставка', 'exhibition',
    'галере', 'gallery', 'бієнале', 'open call', 'opencall',
    'резиденція', 'residence', 'арт-резиденція'
  ];

  // Слова, які точно НЕ підходять (відсікаємо)
  const exclude = [
    'тендер', 'закупівля', 'перепідготовки', 'водіїв', 'транспорт',
    'харчування', 'логістич', 'гігієніч', 'навчання з працевлаштуванням',
    'програми проекту', 'водопостачання', 'санітарії'
  ];

  const hasArtistWord = mustHave.some(word => text.includes(word));
  const hasExcludeWord = exclude.some(word => text.includes(word));

  return hasArtistWord && !hasExcludeWord;
}

function detectType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  if (text.includes('horeca') || text.includes('готель') || text.includes('ресторан') || 
      text.includes('кафе') || text.includes('інтер\'єр') || text.includes('interior') ||
      text.includes('hotel') || text.includes('restaurant')) {
    return 'horeca';
  }
  if (text.includes('grant') || text.includes('грант') || text.includes('фінансування') || text.includes('стипендія')) {
    return 'grant';
  }
  if (text.includes('residence') || text.includes('резиденція') || text.includes('art residence')) {
    return 'art_residence';
  }
  return 'open_call';
}

async function fetchOpportunities() {
  const targetHashtags = [
    '#opencall', 'open call', 'opencall',
    'конкурс для художників', 'грант для художників',
    'арт-резиденція', 'art residency', 'artist residence',
    'виставка', 'exhibition call', 'call for artists'
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

        const title = titleMatch ? titleMatch[1].trim().substring(0, 150) : 'Нова можливість';
        const link = linkMatch ? linkMatch[1].trim() : source.url;
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 600) : '';

        if (!isForArtists(title, desc)) continue;

        results.push({
          title,
          description: desc,
          link_url: link,
          source_name: source.name,
          source_url: source.url
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
      source: item.source_name,
      source_name: item.source_name,
      source_url: item.source_url,          // ← обов'язкове поле
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
