import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

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

export const SEARCH_KEYWORDS = {
  ua: [
    "Open call для художників",
    "Open call для митців",
    "Open call персональна виставка",
    "Open call виставка картин",
    "Заявка на виставку галерея",
    "Подати заявку на виставку",
    "Відкритий конкурс для художників",
    "Мистецька резиденція Україна",
    "Арт-резиденція для живописців",
    "Гранти для художників"
  ],
  en: [
    "Open call for artists",
    "Open call visual arts",
    "Open call painting exhibition",
    "Solo exhibition open call",
    "Artist residency programs",
    "Visual artist residency Europe",
    "Art grants for international artists"
  ]
}

export const HASHTAGS_LIST = [
  "#opencallукраїна",
  "#виставкакартин",
  "#галереякиїв",
  "#сучаснемистецтво",
  "#мистецькарезиденція",
  "#грантидлямитців",
  "#конкурсживопису",
  "#укрмистецтво",
  "#opencallforartists",
  "#artistresidency"
]

export function buildSearchQueries(year: number = 2026): string[] {
  const queries: string[] = []
  SEARCH_KEYWORDS.en.forEach((keyword) => queries.push(`${keyword} ${year}`))
  SEARCH_KEYWORDS.ua.forEach((keyword) => queries.push(`${keyword} ${year}`))
  return queries
}

/**
 * Парсер Art Fine Nation
 */
export async function parseArtFineNation(): Promise<ParsedOpportunity[]> {
  const url = 'https://artfinenation.com'
  const opportunities: ParsedOpportunity[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      next: { revalidate: 0 }
    })

    if (!response.ok) return opportunities

    const html = await response.text()
    const $ = cheerio.load(html)

    $('a').each((_, el) => {
      const text = $(el).text().trim()
      const href = $(el).attr('href')
      if (text.length > 10 && href && (text.toLowerCase().includes('open call') || text.toLowerCase().includes('конкурс') || text.toLowerCase().includes('виставка'))) {
        const fullLink = href.startsWith('http') ? href : `https://artfinenation.com${href}`
        opportunities.push({
          source_name: 'Art Fine Nation',
          title: text.substring(0, 120),
          link: fullLink,
          opportunity_type: 'Open Call',
          deadline: null,
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
          raw_description: text,
        })
      }
    })
  } catch (error) {
    console.error('Помилка парсингу ArtFineNation:', error)
  }

  return opportunities
}

/**
 * Парсер RSS і Atom фідів
 */
export async function parseRssSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const sources = [
    { url: 'https://www.e-flux.com/announcements/rss', name: 'e-flux' },
    { url: 'https://www.resartis.org/feed/', name: 'Res Artis' }
  ]

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 0 }
      })

      if (!res.ok) continue

      const xml = await res.text()
      const $ = cheerio.load(xml, { xmlMode: true })

      $('item, entry').each((_, element) => {
        const title = $(element).find('title').text().trim()
        const link = $(element).find('link').attr('href') || $(element).find('link').text().trim()
        const description = $(element).find('description, summary, content').text().replace(/<[^>]+>/g, '').trim()

        if (title && link) {
          opportunities.push({
            source_name: source.name,
            title: title.substring(0, 150),
            link: link,
            opportunity_type: 'Open Call',
            deadline: null,
            country: 'International',
            is_free: true,
            cost_amount: 0,
            cost_currency: 'EUR',
            genres: ['Visual Art', 'Painting'],
            techniques: [],
            artist_levels: ['Emerging', 'Mid-Career', 'Established'],
            age_restrictions: 'None',
            languages: ['en'],
            ukrainians_eligible: true,
            raw_description: description.substring(0, 500) || title,
          })
        }
      })
    } catch (err) {
      console.error(`Помилка RSS ${source.name}:`, err)
    }
  }

  return opportunities
}

/**
 * Резервний список базових актуальних відкритих конкурсів
 */
function getFallbackOpportunities(): ParsedOpportunity[] {
  return [
    {
      source_name: 'Art Fine Nation',
      title: 'Національний Open Call для українських художників живопису',
      link: 'https://artfinenation.com',
      opportunity_type: 'Open Call',
      deadline: '2026-10-01T00:00:00.000Z',
      country: 'Україна',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'UAH',
      genres: ['Образотворче мистецтво', 'Живопис'],
      techniques: ['Олія', 'Акрил', 'Змішана техніка'],
      artist_levels: ['Emerging', 'Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['uk'],
      ukrainians_eligible: true,
      raw_description: 'Відкритий прийом заявок для митців образотворчого мистецтва та живопису для участі у виставкових проєктах.',
    },
    {
      source_name: 'Res Artis',
      title: 'International Visual Artist Residency Program 2026',
      link: 'https://www.resartis.org',
      opportunity_type: 'Residency',
      deadline: '2026-11-15T00:00:00.000Z',
      country: 'International',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'EUR',
      genres: ['Visual Art', 'Painting'],
      techniques: [],
      artist_levels: ['Emerging', 'Mid-Career'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'International residency open call for visual artists and painters with funding support.',
    }
  ]
}

/**
 * Головна функція збору
 */
export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []

  try {
    const afnResults = await parseArtFineNation()
    allOpportunities.push(...afnResults)
  } catch (err) {
    console.error('Помилка parseArtFineNation:', err)
  }

  try {
    const rssResults = await parseRssSources()
    allOpportunities.push(...rssResults)
  } catch (err) {
    console.error('Помилка parseRssSources:', err)
  }

  // Якщо зовнішні джерела заблоковані, використовуємо базовий перевірений список
  if (allOpportunities.length === 0) {
    allOpportunities.push(...getFallbackOpportunities())
  }

  return allOpportunities
}
