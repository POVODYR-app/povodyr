import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ParsedOpportunity {
  source_name: string
  title: string
  link: string
  opportunity_type: string
  deadline: string | null
  country: string
  is_free: boolean
  cost_amount: number
  cost_currency: string
  genres: string[]
  techniques: string[]
  artist_levels: string[]
  age_restrictions: string
  languages: string[]
  ukrainians_eligible: boolean
  raw_description: string
}

export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('active', true)

  const opportunities: ParsedOpportunity[] = []

  if (!sources || sources.length === 0) {
    return opportunities
  }

  return opportunities
}
import * as cheerio from 'cheerio';
import { ParsedOpportunity } from './parser';

/**
 * Парсер для сторінки Open Call арт-агенції Art Fine Nation
 */
export async function parseArtFineNation(): Promise<ParsedOpportunity[]> {
  const url = 'https://artfinenation.com/open-call';
  const opportunities: ParsedOpportunity[] = [];

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PovodyrBot/1.0 (+https://povodyr.app)',
      },
      next: { revalidate: 3600 } // Кешування на 1 годину
    });

    if (!response.ok) {
      console.error(`Помилка завантаження ArtFineNation: ${response.statusText}`);
      return opportunities;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Селектори підлаштовуються під структуру блоків на artfinenation.com
    $('.open-call-item, article, .post').each((_, element) => {
      const title = $(element).find('h2, h3, .title').text().trim();
      const linkRel = $(element).find('a').attr('href');
      const link = linkRel ? (linkRel.startsWith('http') ? linkRel : `https://artfinenation.com${linkRel}`) : url;
      const description = $(element).find('p, .description').text().trim();
      const deadlineText = $(element).find('.deadline, .date').text().trim();

      if (title) {
        opportunities.push({
          source_name: 'Art Fine Nation',
          title: title,
          link: link,
          opportunity_type: 'Open Call',
          deadline: parseDeadline(deadlineText),
          country: 'Україна',
          is_free: true,
          cost_amount: 0,
          cost_currency: 'UAH',
          genres: ['Образотворче мистецтво', 'Живопис'],
          techniques: [],
          artist_levels: ['Emerging', 'Mid-Career', 'Established'],
          age_restrictions: 'None',
          languages: ['uk'],
          ukrainians_eligible: true,
          raw_description: description || title,
        });
      }
    });
  } catch (error) {
    console.error('Помилка при парсингу ArtFineNation:', error);
  }

  return opportunities;
}

function parseDeadline(dateStr: string): string | null {
  if (!dateStr) return null;
  const parsedDate = new Date(dateStr);
  return isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}
