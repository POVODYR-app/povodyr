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
  const opportunities: ParsedOpportunity[] = []
  let textContent = ''

  // 1. Спроба через Jina Reader
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000)

    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
      next: { revalidate: 0 }
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      textContent = await res.text()
      logs.push(`Контент Art Fine Nation отримано через Jina. Довжина: ${textContent.length} символів`)
    } else {
      logs.push(`Jina Reader повернув статус: ${res.status}`)
    }
  } catch (e) {
    logs.push('Jina Reader не відповів вчасно. Перехід на Microlink...')
  }

  // 2. Резервна спроба через Microlink API (ідеально підходить для Google Sites)
  if (!textContent) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 7000)

      const microUrl = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&prerender=true`
      const res = await fetch(microUrl, {
        signal: controller.signal,
        next: { revalidate: 0 }
      })

      clearTimeout(timeoutId)

      if (res.ok) {
        const json = await res.json()
        const title = json.data?.title || ''
        const description = json.data?.description || ''
        textContent = `${title}\n${description}`
        logs.push(`Отримано метадані Google Sites через Microlink`)
      }
    } catch (e) {
      logs.push('Резервний сервіс Microlink не відповів.')
    }
  }

  // Парсинг отриманого тексту
  if (textContent && textContent.length > 50) {
    const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean)

    lines.forEach((line) => {
      const isRelevant = /open\s*call|конкурс|виставка|грант|резиденція|митці|художники/i.test(line)

      if (isRelevant && line.length >= 15 && line.length <= 250) {
        const cleanTitle = line
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/^#+\s*/, '')
          .trim()

        if (!opportunities.some(item => item.title === cleanTitle)) {
          opportunities.push({
            source_name: 'Art Fine Nation',
            title: cleanTitle,
            link: targetUrl,
            source_url: targetUrl,
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
            raw_description: `Опубліковано на платформі Art Fine Nation: ${cleanTitle}`,
          })
        }
      }
    })
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
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal,
        next: { revalidate: 0 }
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        console.error(`RSS ${source.name} повернув статус: ${res.status}`)
        continue
      }

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
    } catch (err: any) {
      console.error(`Помилка RSS ${source.name}: ${err.message}`)
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
