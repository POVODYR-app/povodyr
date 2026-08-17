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
    "Мистецька резиденція для художників",
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
  const targetUrl = 'https://sites.google.com/view/artfinenation'
  const originalUrl = 'https://artfinenation.com'
  const opportunities: ParsedOpportunity[] = []
  let textContent = ''

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`
    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      next: { revalidate: 0 }
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      textContent = await res.text()
    }
  } catch (e) {
    // Ігноруємо
  }

  if (textContent && textContent.length > 100) {
    try {
      const $ = cheerio.load(textContent)
      
      $('h1, h2, h3, h4, a').each((_, element) => {
        const $el = $(element)
        const text = $el.text().trim().replace(/\s+/g, ' ')
        const href = $el.attr('href') || $el.find('a').attr('href') || $el.closest('a').attr('href')
        
        let description = ''
        if ($el.is('h1, h2, h3, h4')) {
          const nextP = $el.next('p').text().trim().replace(/\s+/g, ' ')
          if (nextP) {
            description = nextP
          }
        }

        const isRelevant = /open\s*call|конкурс|виставка|грант|резиденція|митці|художники|art-espresso| календар конкурсів|виставок|пленерів/i.test(text)

        if (isRelevant && text.length >= 10 && text.length <= 300) {
          const fullLink = href 
            ? (href.startsWith('http') ? href : `${targetUrl}${href.startsWith('/') ? '' : '/'}${href}`)
            : `${targetUrl}/open-call`

          if (!opportunities.some(item => item.title === text || item.link === fullLink)) {
            opportunities.push({
              source_name: 'Art Fine Nation',
              title: text,
              link: fullLink,
              source_url: fullLink,
              type: /виставка/i.test(text) ? 'Виставка' : 'Open Call',
              deadline: null,
              country: 'Україна',
              is_free: true,
              cost_amount: 0,
              cost_currency: 'UAH',
              genres: ['Образотворче мистецтво', 'Живопис', 'Графіка', 'Коллаж', 'Скульптура', 'Декоративно-ужиткове мистецтво'],
              techniques: [],
              artist_levels: ['Emerging', 'Mid-Career', 'Established'],
              age_restrictions: 'None',
              languages: ['uk'],
              ukrainians_eligible: true,
              raw_description: description ? `Опис: ${description}` : `Опубліковано на Art Fine Nation: ${text}`,
            })
          }
        }
      })
    } catch (err) {
      // ignore
    }
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

  const positiveKeywords = [
    'open call', 'opencall', 'call for', 'deadline', 'apply', 'application',
    'residency', 'residencies', 'grant', 'grants', 'prize', 'award',
    'submission', 'submit', 'exhibition opportunity', 'artist call'
  ]

  const negativeKeywords = [
    'board member', 'welcomes', 'appointed', 'highlights', 'anniversary',
    'meeting', 'conference report', 'goodbye', 'interview', 'spotlight on'
  ]

  for (const source of sources) {
    let items: Array<{ title: string; link: string; description: string }> = []

    // rss2json
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}&count=40`

      const res = await fetch(rss2jsonUrl, {
        signal: controller.signal,
        next: { revalidate: 0 }
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        if (data.status === 'ok' && Array.isArray(data.items)) {
          items = data.items.map((i: any) => ({
            title: i.title || '',
            link: i.link || i.guid || source.url,
            description: i.description || i.content || ''
          }))
        }
      }
    } catch (e) {}

    // Прямий fetch
    if (items.length === 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: controller.signal,
          next: { revalidate: 0 }
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const xml = await res.text()
          const $ = cheerio.load(xml, { xmlMode: true })

          $('item, entry').each((_, element) => {
            const title = $(element).find('title').text().trim()
            const link = $(element).find('link').attr('href') || $(element).find('link').text().trim()
            const description = $(element).find('description, summary, content').text().replace(/<[^>]+>/g, '').trim()

            if (title && link) {
              items.push({ title, link, description })
            }
          })
        }
      } catch (e) {
        console.error(`Не вдалося завантажити RSS ${source.name}`)
      }
    }

    // Фільтрація
    items.forEach(item => {
      const titleLower = item.title.toLowerCase()
      const descLower = (item.description || '').toLowerCase()

      const hasPositive = positiveKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw))
      const hasNegative = negativeKeywords.some(kw => titleLower.includes(kw))
      const hasRecentYear = /202[5-9]|2030/.test(item.title + ' ' + item.description)

      if (hasPositive && !hasNegative && (hasRecentYear || source.name !== 'Res Artis')) {
        opportunities.push({
          source_name: source.name,
          title: item.title.substring(0, 160),
          link: item.link,
          source_url: item.link,
          type: titleLower.includes('residency') ? 'Residency' : 'Open Call',
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
          raw_description: (item.description || item.title).replace(/<[^>]+>/g, '').trim().substring(0, 500),
        })
      }
    })
  }

  return opportunities
}

function getCoreOpportunities(): ParsedOpportunity[] {
  return [
    {
      source_name: 'Art Fine Nation',
      title: 'open calls для художників 2026',
      link: 'https://sites.google.com/view/artfinenation/open-call',
      source_url: 'https://sites.google.com/view/artfinenation/open-call',
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
      source_name: 'Art Fine Nation',
      title: '⚡️ OPEN CALL для художників на 2026 рік: «Art-Espresso. Take it Home»',
      link: 'https://sites.google.com/view/artfinenation/open-call',
      source_url: 'https://sites.google.com/view/artfinenation/open-call',
      type: 'Open Call',
      deadline: '2026-12-31T00:00:00.000Z',
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
      raw_description: 'Спеціальний формат open call для художників у межах програми «Art-Espresso. Take it Home».',
    },
    {
      source_name: 'Art Fine Nation',
      title: 'Календар конкурсів, виставок та пленерів 2026 року',
      link: 'https://sites.google.com/view/artfinenation/open-call',
      source_url: 'https://sites.google.com/view/artfinenation/open-call',
      type: 'Виставка / Пленер',
      deadline: '2026-12-31T00:00:00.000Z',
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
      raw_description: 'Календар подій, конкурсів, виставок та пленерів Першої української мистецької агенції на 2026 рік.',
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
    if (!allOpportunities.some(o => o.link === item.link && o.title === item.title)) {
      allOpportunities.push(item)
    }
  })

  logs.push(`Загалом зібрано елементів: ${allOpportunities.length}`)
  return allOpportunities
}
