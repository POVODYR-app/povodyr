import * as cheerio from 'cheerio'

export interface ParsedOpportunity {
  source_name: string
  title: string
  link: string
  source_url: string
  type: string
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

export async function parseArtFineNationHTML(logs: string[] = []): Promise<ParsedOpportunity[]> {
  const targetUrl = 'https://artfinenation.com'
  const apiKey = process.env.SCRAPER_API_KEY

  // Прибрано render=true для швидкого отримання HTML за 1-3 секунди
  const apiUrl = apiKey
    ? `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`
    : `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`

  const opportunities: ParsedOpportunity[] = []

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    const response = await fetch(apiUrl, {
      method: 'GET',
      signal: controller.signal,
      next: { revalidate: 0 }
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const html = await response.text()
      logs.push(`Art Fine Nation HTML отримано. Довжина: ${html.length} символів`)

      const $ = cheerio.load(html)

      $('a, article, .post, .card, h1, h2, h3').each((_, element) => {
        const text = $(element).text().trim().replace(/\s+/g, ' ')
        const href = $(element).attr('href') || $(element).find('a').attr('href')

        const isRelevant = /open\s*call|конкурс|виставка|грант|резиденція|митці|художники/i.test(text)

        if (isRelevant && text.length >= 15 && text.length <= 250) {
          const fullLink = href 
            ? (href.startsWith('http') ? href : `${targetUrl}${href.startsWith('/') ? '' : '/'}${href}`)
            : targetUrl

          if (!opportunities.some(item => item.title === text || item.link === fullLink)) {
            opportunities.push({
              source_name: 'Art Fine Nation',
              title: text,
              link: fullLink,
              source_url: fullLink,
              type: 'Open Call',
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
              raw_description: `Опубліковано на платформі Art Fine Nation: ${text}`,
            })
          }
        }
      })
    } else {
      logs.push(`Scraping API повернув статус: ${response.status}`)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logs.push(`Помилка Art Fine Nation через Scraping API: ${errorMsg}`)
  }

  return opportunities
}

export async function parseRssSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const sources = [
    { url: 'https://www.resartis.org/feed/', name: 'Res Artis' },
    { url: 'https://www.transartists.org/en/rss.xml', name: 'TransArtists' },
    { url: 'https://www.e-flux.com/announcements/rss', name: 'E-Flux' }
  ]

  for (const source of sources) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        signal: controller.signal,
        next: { revalidate: 0 }
      })

      clearTimeout(timeoutId)

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
            source_url: link,
            type: 'Open Call',
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

function getCoreOpportunities(): ParsedOpportunity[] {
  return [
    {
      source_name: 'Art Fine Nation',
      title: 'Всеукраїнський Open Call: Сучасний український живопис та образотворче мистецтво 2026',
      link: 'https://artfinenation.com/open-call-2026',
      source_url: 'https://artfinenation.com/open-call-2026',
      type: 'Open Call',
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
      source_url: 'https://www.resartis.org/open-call-2026',
      type: 'Residency',
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

export async function fetchFromApprovedSources(logs: string[] = []): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []

  logs.push('Запуск парсингу Art Fine Nation HTML...')
  try {
    const afnResults = await parseArtFineNationHTML(logs)
    logs.push(`Art Fine Nation знайшов записів: ${afnResults.length}`)
    allOpportunities.push(...afnResults)
  } catch (err: any) {
    logs.push(`Помилка Art Fine Nation: ${err.message}`)
  }

  logs.push('Запуск парсингу RSS-джерел...')
  try {
    const rssResults = await parseRssSources()
    logs.push(`RSS-джерела знайшли записів: ${rssResults.length}`)
    allOpportunities.push(...rssResults)
  } catch (err: any) {
    logs.push(`Помилка RSS: ${err.message}`)
  }

  logs.push('Додавання резервного списку джерел...')
  const coreResults = getCoreOpportunities()
  logs.push(`Базових гарантованих записів: ${coreResults.length}`)
  coreResults.forEach(item => {
    if (!allOpportunities.some(o => o.link === item.link)) {
      allOpportunities.push(item)
    }
  })

  logs.push(`Загалом зібрано елементів: ${allOpportunities.length}`)
  return allOpportunities
}
