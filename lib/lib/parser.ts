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
 * Парсер для Art Fine Nation з розширеним пошуком блоків
 */
export async function parseArtFineNation(): Promise<ParsedOpportunity[]> {
  const url = 'https://artfinenation.com/open-call'
  const opportunities: ParsedOpportunity[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PovodyrBot/1.0; +https://povodyr.app)',
      },
      next: { revalidate: 0 }
    })

    if (!response.ok) {
      console.error(`Помилка завантаження ArtFineNation: ${response.statusText}`)
      return opportunities
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const selectors = '.open-call-item, article, .post, .card, main div, section div'

    $(selectors).each((_, element) => {
      const title = $(element).find('h1, h2, h3, h4, .title, strong').first().text().trim()
      const linkRel = $(element).find('a').attr('href')
      const link = linkRel ? (linkRel.startsWith('http') ? linkRel : `https://artfinenation.com${linkRel}`) : url
      const description = $(element).find('p, .description, span').text().trim()
      const deadlineText = $(element).find('.deadline, .date, time').text().trim()

      if (title && title.length > 5 && !opportunities.some(o => o.title === title)) {
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
 * Парсер RSS джерел (Res Artis, TransArtists)
 */
export async function parseRssSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const sources = [
    { url: 'https://www.resartis.org/feed/', name: 'Res Artis' },
    { url: 'https://www.transartists.org/en/rss.xml', name: 'TransArtists' },
  ]

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; POVODYR/1.0)' },
        next: { revalidate: 0 }
      })

      if (!res.ok) continue

      const xml = await res.text()
      const items = xml.split(/<item[\s>]/i)

      for (let i = 1; i < items.length; i++) {
        const item = items[i]
        const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)
        const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)
        const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)

        const title = titleMatch ? titleMatch[1].trim().substring(0, 150) : ''
        const link = linkMatch ? linkMatch[1].trim() : ''
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 600) : ''

        if (title && link) {
          opportunities.push({
            source_name: source.name,
            title: title,
            link: link,
            opportunity_type: 'Open Call',
            deadline: null,
            country: 'International',
            is_free: true,
            cost_amount: 0,
            cost_currency: 'EUR',
            genres: ['Visual Art'],
            techniques: [],
            artist_levels: ['Emerging', 'Mid-Career'],
            age_restrictions: 'None',
            languages: ['en'],
            ukrainians_eligible: true,
            raw_description: desc || title,
          })
        }
      }
    } catch (err) {
      console.error(`Помилка RSS ${source.name}:`, err)
    }
  }

  return opportunities
}

/**
 * Головна функція збору даних зі всіх джерел
 */
export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []

  // 1. Парсинг Art Fine Nation
  try {
    const afnResults = await parseArtFineNation()
    allOpportunities.push(...afnResults)
  } catch (err) {
    console.error('Помилка виконання parseArtFineNation:', err)
  }

  // 2. Парсинг RSS-стрічок
  try {
    const rssResults = await parseRssSources()
    allOpportunities.push(...rssResults)
  } catch (err) {
    console.error('Помилка виконання parseRssSources:', err)
  }

  return allOpportunities
}
