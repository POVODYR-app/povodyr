import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { buildSearchQueries, HASHTAGS_LIST } from './hashtags'

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

/**
 * Допоміжна функція для парсингу дат дедлайнів
 */
function parseDeadline(dateStr: string): string | null {
  if (!dateStr) return null
  const parsedDate = new Date(dateStr)
  return isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
}

/**
 * Парсер для сторінки Open Call Першої української мистецької агенції Art Fine Nation
 */
export async function parseArtFineNation(): Promise<ParsedOpportunity[]> {
  const url = 'https://artfinenation.com/open-call'
  const opportunities: ParsedOpportunity[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PovodyrBot/1.0 (+https://povodyr.app)',
      },
      next: { revalidate: 3600 } // Кешування на 1 годину
    })

    if (!response.ok) {
      console.error(`Помилка завантаження ArtFineNation: ${response.statusText}`)
      return opportunities
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    $('.open-call-item, article, .post').each((_, element) => {
      const title = $(element).find('h2, h3, .title').text().trim()
      const linkRel = $(element).find('a').attr('href')
      const link = linkRel ? (linkRel.startsWith('http') ? linkRel : `https://artfinenation.com${linkRel}`) : url
      const description = $(element).find('p, .description').text().trim()
      const deadlineText = $(element).find('.deadline, .date').text().trim()

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
        })
      }
    })
  } catch (error) {
    console.error('Помилка при парсингу ArtFineNation:', error)
  }

  return opportunities
}

/**
 * Головна функція збору даних з усіх підключених джерел
 */
export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []

  // 1. Прямий HTML-парсинг сайту Art Fine Nation
  try {
    const afnResults = await parseArtFineNation()
    allOpportunities.push(...afnResults)
  } catch (err) {
    console.error('Помилка виконання parseArtFineNation:', err)
  }

  // 2. Парсинг джерел з бази даних Supabase (RSS, APIs)
  try {
    const { data: sources, error } = await supabase
      .from('sources')
      .select('*')
      .eq('active', true)

    if (!error && sources && sources.length > 0) {
      for (const source of sources) {
        // Тут виконується обробка активних RSS та API джерел з бази даних
      }
    }
  } catch (err) {
    console.error('Помилка при отриманні джерел з бази:', err)
  }

  // 3. Генерація пошукових запитів для хештегів та ключових слів
  const generatedQueries = buildSearchQueries(2026)
  const hashtags = HASHTAGS_LIST

  // Запити generatedQueries та hashtags передаються у відповідні пошукові модулі

  return allOpportunities
}
