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
    "Гранти для художників",
    "Гранти на культурні проєкти",
    "Фінансування мистецьких проєктів",
    "Конкурс образотворчого мистецтва",
    "Живописний конкурс",
    "Арт-простір співпраця з художниками",
    "Галерея сучасного мистецтва виставки",
    "Музей сучасного мистецтва open call",
    "Незалежний арт-простір виставка"
  ],
  en: [
    "Open call for artists",
    "Open call visual arts",
    "Open call painting exhibition",
    "Solo exhibition open call",
    "Call for artists submission",
    "Gallery submission guidelines",
    "Artist proposal submission",
    "Artist residency programs",
    "Visual artist residency Europe",
    "Visual artist residency USA",
    "Art grants for international artists",
    "Grants for visual artists",
    "Emergency grants for Ukrainian artists",
    "Art funding programs",
    "Artist-in-residence opportunities",
    "Fine art competition",
    "International painting contest",
    "Juried art exhibition",
    "Art prize visual arts",
    "Emerging artist award",
    "Contemporary art gallery submissions",
    "Museum open call artists",
    "Independent art space proposals",
    "Artist-run space open call"
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
  "#персональнавиставка",
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
]

export function buildSearchQueries(year: number = 2026): string[] {
  const queries: string[] = []

  SEARCH_KEYWORDS.en.forEach((keyword) => {
    queries.push(`${keyword} ${year}`)
    queries.push(`${keyword} deadline ${year}`)
  })

  SEARCH_KEYWORDS.ua.forEach((keyword) => {
    queries.push(`${keyword} ${year}`)
    queries.push(`${keyword} дедлайн`)
  })

  return queries
}

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
      next: { revalidate: 3600 }
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
 * Головна функція збору даних
 */
export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []

  // 1. HTML-парсинг Art Fine Nation
  try {
    const afnResults = await parseArtFineNation()
    allOpportunities.push(...afnResults)
  } catch (err) {
    console.error('Помилка виконання parseArtFineNation:', err)
  }

  // 2. Джерела з Supabase
  try {
    const { data: sources, error } = await supabase
      .from('sources')
      .select('*')
      .eq('active', true)

    if (!error && sources && sources.length > 0) {
      for (const source of sources) {
        // Обробка джерел
      }
    }
  } catch (err) {
    console.error('Помилка при отриманні джерел з бази:', err)
  }

  // 3. Генерація запитів
  const generatedQueries = buildSearchQueries(2026)
  const hashtags = HASHTAGS_LIST

  return allOpportunities
}
