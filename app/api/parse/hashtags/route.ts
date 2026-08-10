import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildSearchQueries, HASHTAGS_LIST } from '../../../lib/parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isForArtists(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();

  const artistWords = [
    'artist', 'artists', 'художник', 'художниц',
    'painting', 'живопис', 'sculpture', 'скульптур',
    'exhibition', 'виставка', 'gallery', 'галере',
    'residency', 'резиденція', 'open call', 'opencall',
    'grant', 'грант', 'call for artists', 'visual art',
    'contemporary art', 'fine art', 'арт', 'funding'
  ];

  const badWords = [
    'тендер', 'закупівля', 'водіїв', 'транспорт',
    'харчування', 'логістич', 'гігієніч', 'працевлаштуванням'
  ];

  const hasGood = artistWords.some(w => text.includes(w));
  const hasBad = badWords.some(w => text.includes(w));

  return hasGood && !hasBad;
}

function detectType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  if (text.includes('horeca') || text.includes('hotel') || text.includes('restaurant') || 
      text.includes('interior') || text.includes('готель') || text.includes('ресторан') || 
      text.includes('інтер\'єр')) {
    return 'horeca';
  }
  if (text.includes('grant') || text.includes('грант') || text.includes('funding') || 
      text.includes('стипендія') || text.includes('fellowship')) {
    return 'grant';
  }
  if (text.includes('residency') || text.includes('residence') || text.includes('резиденція') || 
      text.includes('art residence')) {
    return 'art_residence';
  }
  return 'open_call';
}

async function fetchOpportunities() {
  const results: any[] = [];

  const sources = [
    { url: 'https://www.resartis.org/feed/', name: 'Res Artis' },
    { url: 'https://www.transartists.org/en/rss.xml', name: 'TransArtists' },
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; POVODYR/1.0)' },
        next: { revalidate: 0 }
      });

      if (!res.ok) {
        console.log(`Джерело ${source.name} недоступне: ${res.status}`);
        continue;
      }

      const xml = await res.text();
      const items = xml.split(/<item[\s>]/i);

      for (let i = 1; i < items.length; i++) {
        const item = items[i];

        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

        const title = titleMatch ? titleMatch[1].trim().substring(0, 150) : '';
        const link = linkMatch ? linkMatch[1].trim() : '';
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 600) : '';

        if (!title || !link) continue;
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
      console.error(`Помилка джерела ${source.name}:`, err);
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
      source_url: item.source_url,
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

    const generatedQueries = buildSearchQueries(2026);
    const hashtags = HASHTAGS_LIST;

    return NextResponse.json({
      success: true,
      found: items.length,
      saved: inserted,
      hashtags_count: hashtags.length,
      queries_count: generatedQueries.length,
      hashtags: hashtags,
      queries: generatedQueries,
      details: logs
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
