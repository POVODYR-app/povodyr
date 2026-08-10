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
// lib/parsers/hashtags.ts

export const SEARCH_KEYWORDS = {
  ua: [
    // Загальні
    "Open call для художників",
    "Open call для митців",
    "Open call персональна виставка",
    "Open call виставка картин",
    "Заявка на виставку галерея",
    "Подати заявку на виставку",
    "Відкритий конкурс для художників",
    // Резиденції, гранти та конкурси
    "Мистецька резиденція Україна",
    "Арт-резиденція для живописців",
    "Гранти для художників",
    "Гранти на культурні проєкти",
    "Фінансування мистецьких проєктів",
    "Конкурс образотворчого мистецтва",
    "Живописний конкурс",
    // Інституції та майданчики
    "Арт-простір співпраця з художниками",
    "Галерея сучасного мистецтва виставки",
    "Музей сучасного мистецтва open call",
    "Незалежний арт-простір виставка"
  ],
  en: [
    // General & Open Calls
    "Open call for artists",
    "Open call visual arts",
    "Open call painting exhibition",
    "Solo exhibition open call",
    "Call for artists submission",
    "Gallery submission guidelines",
    "Artist proposal submission",
    // Residencies & Grants
    "Artist residency programs",
    "Visual artist residency Europe",
    "Visual artist residency USA",
    "Art grants for international artists",
    "Grants for visual artists",
    "Emergency grants for Ukrainian artists",
    "Art funding programs",
    "Artist-in-residence opportunities",
    // Competitions & Exhibitions
    "Fine art competition",
    "International painting contest",
    "Juried art exhibition",
    "Art prize visual arts",
    "Emerging artist award",
    // Venues & Spaces
    "Contemporary art gallery submissions",
    "Museum open call artists",
    "Independent art space proposals",
    "Artist-run space open call"
  ]
};

export const HASHTAGS_LIST = [
  // Українські хештеги
  "#opencallукраїна",
  "#виставкакартин",
  "#галереякиїв",
  "#сучаснемистецтво",
  "#мистецькарезиденція",
  "#грантидлямигців",
  "#конкурсживопису",
  "#укрмистецтво",
  "#персональнавиставка",
  
  // Міжнародні хештеги
  "#opencallforartists",
  "#artistresidency",
  "#artgrants",
  "#callforartists",
  "#fineartcompetition",
  "#juriedexhibition",
  "#visualartgrant",
  "#gallerysubmission",
  "#soloexhibitionopencall",
  "#ukrainianartists",
  "#artistinresidence",
  "#contemporaryartgallery"
];

/**
 * Генератор оптимізованих пошукових запитів з часовими операторами
 */
export function buildSearchQueries(year: number = 2026): string[] {
  const queries: string[] = [];

  // Формування запитів для англійських фраз із часовими операторами
  SEARCH_KEYWORDS.en.forEach((keyword) => {
    queries.push(`${keyword} ${year}`);
    queries.push(`${keyword} deadline ${year}`);
  });

  // Формування запитів для українських фраз
  SEARCH_KEYWORDS.ua.forEach((keyword) => {
    queries.push(`${keyword} ${year}`);
    queries.push(`${keyword} дедлайн`);
  });

  return queries;
}
