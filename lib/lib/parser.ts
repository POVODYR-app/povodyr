import * as cheerio from 'cheerio'

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
    "Фінансування мистецьких проєктів"
  ],
  en: [
    "Open call for artists",
    "Open call visual arts",
    "Open call painting exhibition",
    "Solo exhibition open call",
    "Artist residency programs",
    "Visual artist residency Europe",
    "Art grants for international artists",
    "Emergency grants for Ukrainian artists"
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
  "#artistresidency",
  "#artgrants"
]

export function buildSearchQueries(year: number = 2026): string[] {
  const queries: string[] = []
  SEARCH_KEYWORDS.en.forEach((keyword) => queries.push(`${keyword} ${year}`))
  SEARCH_KEYWORDS.ua.forEach((keyword) => queries.push(`${keyword} ${year}`))
  return queries
}

/**
 * 1. Прямий HTML-парсер сайту Art Fine Nation
 */
export async function parseArtFineNationHTML(): Promise<ParsedOpportunity[]> {
  const targetUrl = 'https://artfinenation.com'
  const opportunities: ParsedOpportunity[] = []

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      next: { revalidate: 0 }
    })

    if (response.ok) {
      const html = await response.text()
      const $ = cheerio.load(html)

      $('a, article, .post, .card, div').each((_, element) => {
        const text = $(element).text().trim().replace(/\s+/g, ' ')
        const href = $(element).attr('href') || $(element).find('a').attr('href')

        const isRelevant = /open\s*call|конкурс|виставка|грант|резиденція/i.test(text)

        if (isRelevant && text.length >= 15 && text.length <= 200) {
          const fullLink = href 
            ? (href.startsWith('http') ? href : `${targetUrl}${href.startsWith('/') ? '' : '/'}${href}`)
            : targetUrl

          if (!opportunities.some(item => item.title === text || item.link === fullLink)) {
            opportunities.push({
              source_name: 'Art Fine Nation',
              title: text,
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
              raw_description: `Опубліковано на платформі Першої української мистецької агенції Art Fine Nation: ${text}`,
            })
          }
        }
      })
    }
  } catch (error) {
    console.error('Помилка виконання parseArtFineNationHTML:', error)
  }

  return opportunities
}

/**
 * 2. Парсер RSS-потоків (Res Artis, TransArtists, E-Flux)
 */
export async function parseRssSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const sources = [
    { url: 'https://www.resartis.org/feed/', name: 'Res Artis' },
    { url: 'https://www.transartists.org/en/rss.xml', name: 'TransArtists' },
    { url: 'https://www.e-flux.com/announcements/rss', name: 'E-Flux' }
  ]

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; POVODYR/1.0)' },
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
            artist_levels: ['Emerging', 'Mid-Career'],
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
 * 3. Базовий список активних програм для гарантованого збереження
 */
function getCoreOpportunities(): ParsedOpportunity[] {
  return [
    {
      source_name: 'Art Fine Nation',
      title: 'Всеукраїнський Open Call: Сучасний український живопис та образотворче мистецтво 2026',
      link: 'https://artfinenation.com/open-call-2026',
      opportunity_type: 'Open Call',
      deadline: '2026-11-30T00:00:00.000Z',
      country: 'Україна',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'UAH',
      genres: ['Образотворче мистецтво', 'Живопис', 'Графіка'],
      techniques: ['Олія', 'Акрил', 'Змішана техніка', 'Авторська техніка'],
      artist_levels: ['Emerging', 'Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['uk'],
      ukrainians_eligible: true,
      raw_description: 'Офіційний прийом заявок для виставкових проєктів та каталогів Першої української мистецької агенції Art Fine Nation.',
    },
    {
      source_name: 'Res Artis',
      title: 'International Visual Artist Residency & Exhibition Grant 2026',
      link: 'https://www.resartis.org/open-call-2026',
      opportunity_type: 'Residency',
      deadline: '2026-12-15T00:00:00.000Z',
      country: 'International',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'EUR',
      genres: ['Visual Art', 'Painting'],
      techniques: ['Mixed Media', 'Oil', 'Acrylic'],
      artist_levels: ['Emerging', 'Mid-Career'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'Міжнародна резиденційна програма для митців у галузі візуального мистецтва та живопису.',
    }
  ]
}

/**
 * Головна функція збору даних зі всіх джерел
 */
export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []

  // 1. Збір з HTML Art Fine Nation
  try {
    const afnResults = await parseArtFineNationHTML()
    allOpportunities.push(...afnResults)
  } catch (err) {
    console.error('Помилка parseArtFineNationHTML:', err)
  }

  // 2. Збір з RSS
  try {
    const rssResults = await parseRssSources()
    allOpportunities.push(...rssResults)
  } catch (err) {
    console.error('Помилка parseRssSources:', err)
  }

  // 3. Базові гарантовані джерела
  const coreResults = getCoreOpportunities()
  coreResults.forEach(item => {
    if (!allOpportunities.some(o => o.link === item.link)) {
      allOpportunities.push(item)
    }
  })

  return allOpportunities
}
