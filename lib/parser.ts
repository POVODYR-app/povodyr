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

export const ART_FINE_NATION_URL =
  'https://sites.google.com/view/artfinenation/open-call?read_current=1'

export const SEARCH_KEYWORDS = {
  ua: [
    'Open call для художників',
    'Open call для митців',
    'Open call персональна виставка',
    'Open call виставка картин',
    'Заявка на виставку галерея',
    'Подати заявку на виставку',
    'Відкритий конкурс для художників',
    'Мистецька резиденція для художників',
    'Арт-резиденція для живописців',
    'Гранти для художників',
    'Гранти на культурні проєкти',
    'Фінансування мистецьких проєктів',
  ],
  en: [
    'Open call for artists',
    'Open call visual arts',
    'Open call painting exhibition',
    'Solo exhibition open call',
    'Artist residency programs',
    'Visual artist residency Europe',
    'Art grants for international artists',
    'Emergency grants for Ukrainian artists',
  ],
}

export const HASHTAGS_LIST = [
  '#opencallукраїна',
  '#виставкакартин',
  '#галереякиїв',
  '#сучаснемистецтво',
  '#мистецькарезиденція',
  '#грантидлямитців',
  '#конкурсживопису',
  '#укрмистецтво',
  '#opencallforartists',
  '#artistresidency',
  '#artgrants',
]

export function buildSearchQueries(year: number = 2026): string[] {
  const queries: string[] = []
  SEARCH_KEYWORDS.en.forEach((keyword) => queries.push(`${keyword} ${year}`))
  SEARCH_KEYWORDS.ua.forEach((keyword) => queries.push(`${keyword} ${year}`))
  return queries
}

function isArtFineNationLink(link: string | undefined | null) {
  if (!link) return false
  return /sites\.google\.com\/view\/artfinenation/i.test(link)
}

function isOpportunityValid(title: string, description: string, deadline: string | null, link?: string): boolean {
  if (isArtFineNationLink(link)) return true

  const titleLower = title.toLowerCase()
  const descLower = description.toLowerCase()
  const combinedText = `${titleLower} ${descLower}`

  const negativeKeywords = [
    'board member', 'welcomes', 'appointed', 'highlights', 'anniversary',
    'meeting', 'conference report', 'goodbye', 'interview', 'spotlight on',
    'review', 'archived', 'recap',
  ]

  if (negativeKeywords.some((kw) => titleLower.includes(kw))) {
    return false
  }

  const hasOldYear = /\b(201[0-9]|202[0-5])\b/.test(combinedText)
  const hasCurrentOrFutureYear = /\b(202[6-9]|203[0-1])\b/.test(combinedText)

  if (hasOldYear && !hasCurrentOrFutureYear && !deadline) {
    return false
  }

  if (deadline) {
    const deadlineDate = new Date(deadline)
    const currentDate = new Date()
    if (!isNaN(deadlineDate.getTime()) && deadlineDate < currentDate) {
      return false
    }
  }

  return true
}

export function getGuaranteedArtFineNationOpportunity(): ParsedOpportunity {
  return {
    source_name: 'Art Fine Nation',
    title: 'Open call та календар можливостей — Art Fine Nation',
    link: ART_FINE_NATION_URL,
    source_url: ART_FINE_NATION_URL,
    type: 'Open Call',
    deadline: '2026-12-31T00:00:00.000Z',
    country: 'Україна',
    is_free: true,
    cost_amount: 0,
    cost_currency: 'UAH',
    genres: ['Образотворче мистецтво', 'Живопис', 'Графіка', 'Колаж', 'Скульптура'],
    techniques: ['Олія', 'Акрил', 'Змішана техніка'],
    artist_levels: ['Emerging', 'Mid-Career', 'Established'],
    age_restrictions: 'None',
    languages: ['uk'],
    ukrainians_eligible: true,
    raw_description:
      'Офіційна сторінка open call Першої української мистецької агенції Art Fine Nation. Завжди в добірці для регіону Україна.',
  }
}

export async function parseArtFineNationHTML(): Promise<ParsedOpportunity[]> {
  const targetUrl = ART_FINE_NATION_URL
  const opportunities: ParsedOpportunity[] = []
  let textContent = ''

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      textContent = await res.text()
    }
  } catch (e) {
    // Ігноруємо помилки мережі
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
          if (nextP) description = nextP
        }

        const isRelevant =
          /open\s*call|конкурс|виставка|грант|резиденція|митці|художники|art-espresso|календар конкурсів|виставок|пленерів/i.test(
            text
          )

        if (isRelevant && text.length >= 10 && text.length <= 300) {
          const fullLink = href
            ? href.startsWith('http')
              ? href
              : `https://sites.google.com/view/artfinenation${href.startsWith('/') ? '' : '/'}${href}`
            : targetUrl

          if (isOpportunityValid(text, description, null, fullLink)) {
            if (!opportunities.some((item) => item.title === text || item.link === fullLink)) {
              opportunities.push({
                source_name: 'Art Fine Nation',
                title: text,
                link: isArtFineNationLink(fullLink) ? ART_FINE_NATION_URL : fullLink,
                source_url: isArtFineNationLink(fullLink) ? ART_FINE_NATION_URL : fullLink,
                type: /виставка/i.test(text) ? 'Виставка' : 'Open Call',
                deadline: null,
                country: 'Україна',
                is_free: true,
                cost_amount: 0,
                cost_currency: 'UAH',
                genres: ['Образотворче мистецтво', 'Живопис', 'Графіка', 'Колаж', 'Скульптура', 'Декоративно-ужиткове мистецтво'],
                techniques: [],
                artist_levels: ['Emerging', 'Mid-Career', 'Established'],
                age_restrictions: 'None',
                languages: ['uk'],
                ukrainians_eligible: true,
                raw_description: description ? `Опис: ${description}` : `Опубліковано на Art Fine Nation: ${text}`,
              })
            }
          }
        }
      })
    } catch (err) {
      // Ігноруємо помилки парсингу DOM
    }
  }

  if (!opportunities.some((item) => isArtFineNationLink(item.link))) {
    opportunities.unshift(getGuaranteedArtFineNationOpportunity())
  }

  return opportunities
}

export async function parseResArtisHTML(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const targetUrl = 'https://www.resartis.org/open-calls/'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const html = await res.text()
      const $ = cheerio.load(html)
      $('article, .opportunity-item, .post').each((_, element) => {
        const $el = $(element)
        const title = $el.find('h2, h3, a').first().text().trim().replace(/\s+/g, ' ')
        const link = $el.find('a').attr('href') || ''
        const description = $el.find('p, .excerpt').text().trim().replace(/\s+/g, ' ')

        if (title && title.length > 5) {
          const fullLink = link.startsWith('http') ? link : `https://www.resartis.org${link}`
          if (isOpportunityValid(title, description, null, fullLink)) {
            opportunities.push({
              source_name: 'Res Artis',
              title: title.substring(0, 160),
              link: fullLink,
              source_url: fullLink,
              type: 'Residency',
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
              raw_description: description ? description.substring(0, 500) : `Residency Open Call: ${title}`,
            })
          }
        }
      })
    }
  } catch (e) {
    console.error('Помилка парсингу сторінки Res Artis:', e)
  }

  return opportunities
}

export async function parseRssSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const sources = [
    { url: 'https://www.transartists.org/en/rss.xml', name: 'TransArtists' },
    { url: 'https://www.e-flux.com/announcements/rss', name: 'E-Flux' },
    { url: 'https://culture.ec.europa.eu/feed', name: 'Culture Moves Europe' },
    { url: 'https://prohelvetia.ch/en/feed/', name: 'Pro Helvetia' },
  ]

  const positiveKeywords = [
    'open call', 'opencall', 'call for', 'deadline', 'apply', 'application',
    'residency', 'residencies', 'grant', 'grants', 'prize', 'award',
    'submission', 'submit', 'exhibition opportunity', 'artist call', 'mobility',
  ]

  const negativeKeywords = [
    'board member', 'welcomes', 'appointed', 'highlights', 'anniversary',
    'meeting', 'conference report', 'goodbye', 'interview', 'spotlight on',
  ]

  for (const source of sources) {
    let items: Array<{ title: string; link: string; description: string }> = []

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}&count=40`
      const res = await fetch(rss2jsonUrl, {
        signal: controller.signal,
        next: { revalidate: 0 },
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        if (data.status === 'ok' && Array.isArray(data.items)) {
          items = data.items.map((i: any) => ({
            title: i.title || '',
            link: i.link || i.guid || source.url,
            description: i.description || i.content || '',
          }))
        }
      }
    } catch (e) {}

    if (items.length === 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        const res = await
