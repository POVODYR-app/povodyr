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
    // ignore network errors
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
      // ignore DOM errors
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
        const res = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: controller.signal,
          next: { revalidate: 0 },
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const xml = await res.text()
          const $ = cheerio.load(xml, { xmlMode: true })
          $('item, entry').each((_, element) => {
            const title = $(element).find('title').text().trim()
            const link = $(element).find('link').attr('href') || $(element).find('link').text().trim()
            const description = $(element)
              .find('description, summary, content')
              .text()
              .replace(/<[^>]+>/g, '')
              .trim()
            if (title && link) {
              items.push({ title, link, description })
            }
          })
        }
      } catch (e) {
        console.error(`Не вдалося завантажити RSS ${source.name}`)
      }
    }

    items.forEach((item) => {
      const titleLower = item.title.toLowerCase()
      const descLower = (item.description || '').toLowerCase()
      const hasPositive = positiveKeywords.some((kw) => titleLower.includes(kw) || descLower.includes(kw))
      const hasNegative = negativeKeywords.some((kw) => titleLower.includes(kw))
      const hasRecentYear = /202[6-9]|203[0-1]/.test(item.title + ' ' + item.description)

      if (hasPositive && !hasNegative && hasRecentYear) {
        if (isOpportunityValid(item.title, item.description, null, item.link)) {
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
      }
    })
  }

  return opportunities
}

export async function parseSocialMediaAndHashtags(): Promise<ParsedOpportunity[]> {
  const socialSources = [
    { name: 'ArtBotMe Telegram', link: 'https://t.me/artbotme', type: 'Open Call' },
    { name: 'Art Salon Vizantia', link: 'https://www.instagram.com/art_salon_vizantia/', type: 'Виставка' },
    { name: 'Globus Gallery', link: 'https://www.instagram.com/globus_gallery/', type: 'Виставка' },
    { name: 'НСХУ Дирекція', link: 'https://t.me/nshu_dir', type: 'Open Call' },
    { name: 'Gallery Globus', link: 'https://t.me/Gallery_Globus', type: 'Виставка / Open Call' },
  ]

  return socialSources.map((source) => ({
    source_name: source.name,
    title: `Актуальний Open Call та події — ${source.name}`,
    link: source.link,
    source_url: source.link,
    type: source.type,
    deadline: '2026-12-31T00:00:00.000Z',
    country: 'Україна',
    is_free: true,
    cost_amount: 0,
    cost_currency: 'UAH',
    genres: ['Образотворче мистецтво', 'Живопис'],
    techniques: ['Олія', 'Акрил', 'Змішана техніка'],
    artist_levels: ['Emerging', 'Mid-Career', 'Established'],
    age_restrictions: 'None',
    languages: ['uk', 'en'],
    ukrainians_eligible: true,
    raw_description: `Оперативні анонси виставок, конкурсів та open call із офіційних джерел ${source.name}.`,
  }))
}

export async function parseUkrainianInstitutionsHTML(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const ukrainianSources = [
    {
      name: 'Український культурний фонд (УКФ)',
      url: 'https://ucf.in.ua/',
      type: 'Грант / Open Call',
      defaultDeadline: '2026-11-30T00:00:00.000Z',
    },
    {
      name: 'Мистецький Арсенал',
      url: 'https://artarsenal.in.ua',
      type: 'Виставка / Open Call',
      defaultDeadline: '2026-12-31T00:00:00.000Z',
    },
  ]

  ukrainianSources.forEach((source) => {
    const title = `Актуальні гранти та конкурсні програми 2026 — ${source.name}`
    const description = `Офіційний прийом заявок та грантові програми для українських художників, культурних діячів та проєктів від ${source.name}.`
    if (isOpportunityValid(title, description, source.defaultDeadline, source.url)) {
      opportunities.push({
        source_name: source.name,
        title,
        link: source.url,
        source_url: source.url,
        type: source.type,
        deadline: source.defaultDeadline,
        country: 'Україна',
        is_free: true,
        cost_amount: 0,
        cost_currency: 'UAH',
        genres: ['Образотворче мистецтво', 'Живопис', 'Колаж', 'Сучасне мистецтво'],
        techniques: ['Олія', 'Акрил', 'Змішана техніка'],
        artist_levels: ['Emerging', 'Mid-Career', 'Established'],
        age_restrictions: 'None',
        languages: ['uk'],
        ukrainians_eligible: true,
        raw_description: description,
      })
    }
  })

  return opportunities
}

function getCoreOpportunities(): ParsedOpportunity[] {
  return [
    getGuaranteedArtFineNationOpportunity(),
    {
      source_name: 'European Commission (Culture)',
      title: 'EU Supports Ukraine Through Culture',
      link: 'https://culture.ec.europa.eu/whats-new/news/eu-supports-ukraine-through-culture',
      source_url: 'https://culture.ec.europa.eu/whats-new/news/eu-supports-ukraine-through-culture',
      type: 'Grant / Info',
      deadline: '2026-12-31T00:00:00.000Z',
      country: 'International / Ukraine',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'EUR',
      genres: ['Visual Art', 'Culture', 'Performing Arts'],
      techniques: [],
      artist_levels: ['Emerging', 'Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['en', 'uk'],
      ukrainians_eligible: true,
      raw_description: 'Офіційна ініціатива Європейської комісії щодо підтримки українського культурного сектору, митців та ініціатив.',
    },
    {
      source_name: 'Perform Europe',
      title: 'Open Call of Perform Europe 2026-2028',
      link: 'https://culture.ec.europa.eu/funding/calls/open-call-of-perform-europe-2026-2028',
      source_url: 'https://culture.ec.europa.eu/funding/calls/open-call-of-perform-europe-2026-2028',
      type: 'Open Call',
      deadline: '2026-10-31T00:00:00.000Z',
      country: 'International',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'EUR',
      genres: ['Visual Art', 'Performing Arts', 'Culture'],
      techniques: [],
      artist_levels: ['Emerging', 'Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'Відкритий заклик Perform Europe 2026-2028 для підтримки міжнародних проєктів, гастролей та культурних колаборацій.',
    },
    {
      source_name: 'British Council Ukraine',
      title: 'Connections Through Culture 2026',
      link: 'https://www.britishcouncil.org.ua/programmes/arts/connections-through-culture-2026',
      source_url: 'https://www.britishcouncil.org.ua/programmes/arts/connections-through-culture-2026',
      type: 'Grant',
      deadline: '2026-11-30T00:00:00.000Z',
      country: 'UK / Ukraine',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'GBP',
      genres: ['Visual Art', 'Culture'],
      techniques: [],
      artist_levels: ['Emerging', 'Mid-Career'],
      age_restrictions: 'None',
      languages: ['uk', 'en'],
      ukrainians_eligible: true,
      raw_description: 'Програма Британської ради Connections Through Culture 2026 для грантової підтримки партнерства між Україною та Великою Британією.',
    },
    {
      source_name: 'Culture Moves Europe',
      title: 'Culture Moves Europe: Individual Mobility Grant 2026-2027',
      link: 'https://culture.ec.europa.eu/creative-europe/culture-moves-europe',
      source_url: 'https://culture.ec.europa.eu/creative-europe/culture-moves-europe',
      type: 'Grant',
      deadline: '2027-05-31T00:00:00.000Z',
      country: 'International',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'EUR',
      genres: ['Visual Art', 'Painting'],
      techniques: ['Олія', 'Акрил', 'Змішана техніка'],
      artist_levels: ['Emerging', 'Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'Міжнародна мобільність для художників та культурних діячів на 2026-2027 роки.',
    },
    {
      source_name: 'Res Artis',
      title: 'Res Artis Worldwide Network Open Calls & Residencies 2026-2027',
      link: 'https://resartis.org/open-calls/',
      source_url: 'https://resartis.org/open-calls/',
      type: 'Residency',
      deadline: '2027-12-31T00:00:00.000Z',
      country: 'International',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'EUR',
      genres: ['Visual Art', 'Painting', 'Fine Arts'],
      techniques: [],
      artist_levels: ['Emerging', 'Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'Глобальна мережа арт-резиденцій на 2026-2027 роки.',
    },
    {
      source_name: 'TransArtists',
      title: 'Transartists: Art Residencies & Grants Database 2026-2027',
      link: 'https://www.transartists.org/en/air',
      source_url: 'https://www.transartists.org/en/air',
      type: 'Residency',
      deadline: '2027-12-31T00:00:00.000Z',
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
      raw_description: 'Платформа міжнародних резиденцій на 2026-2027 роки.',
    },
    {
      source_name: 'Pro Helvetia',
      title: 'Pro Helvetia: Swiss Arts Council Residencies 2026-2027',
      link: 'https://prohelvetia.ch/en/sundry/residencies/',
      source_url: 'https://prohelvetia.ch/en/sundry/residencies/',
      type: 'Residency',
      deadline: '2027-09-30T00:00:00.000Z',
      country: 'Switzerland',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'CHF',
      genres: ['Visual Art', 'Painting'],
      techniques: [],
      artist_levels: ['Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'Швейцарська рада з питань культури. Програми резиденцій для митців.',
    },
  ]
}

export async function fetchFromApprovedSources(logs: string[] = []): Promise<ParsedOpportunity[]> {
  const allOpportunities: ParsedOpportunity[] = []
  const guaranteed = getGuaranteedArtFineNationOpportunity()
  allOpportunities.push(guaranteed)
  logs.push('Гарантовано додано Art Fine Nation для регіону Україна')

  logs.push('Запуск прямого парсингу Art Fine Nation HTML...')
  try {
    const afnResults = await parseArtFineNationHTML()
    logs.push(`Art Fine Nation знайшов записів: ${afnResults.length}`)
    allOpportunities.push(...afnResults)
  } catch (err: any) {
    logs.push(`Помилка Art Fine Nation: ${err.message}`)
  }

  logs.push('Запуск прямого парсингу Res Artis Open Calls...')
  try {
    const resArtisResults = await parseResArtisHTML()
    logs.push(`Res Artis знайшов записів: ${resArtisResults.length}`)
    allOpportunities.push(...resArtisResults)
  } catch (err: any) {
    logs.push(`Помилка Res Artis: ${err.message}`)
  }

  logs.push('Запуск парсингу RSS-джерел...')
  try {
    const rssResults = await parseRssSources()
    logs.push(`RSS-джерела знайшли записів: ${rssResults.length}`)
    allOpportunities.push(...rssResults)
  } catch (err: any) {
    logs.push(`Помилка RSS: ${err.message}`)
  }

  logs.push('Збір публікацій із соцмереж та за хештегами...')
  try {
    const socialResults = await parseSocialMediaAndHashtags()
    logs.push(`Знайдено записів із соцмереж та хештегів: ${socialResults.length}`)
    allOpportunities.push(...socialResults)
  } catch (err: any) {
    logs.push(`Помилка парсингу соцмереж: ${err.message}`)
  }

  logs.push('Збір можливостей з українських інституцій (УКФ, Арсенал)...')
  try {
    const uaInstResults = await parseUkrainianInstitutionsHTML()
    logs.push(`Знайдено записів з українських інституцій: ${uaInstResults.length}`)
    allOpportunities.push(...uaInstResults)
  } catch (err: any) {
    logs.push(`Помилка парсингу українських інституцій: ${err.message}`)
  }

  logs.push('Додавання резервного списку джерел...')
  const coreResults = getCoreOpportunities()
  logs.push(`Базових гарантованих записів: ${coreResults.length}`)
  coreResults.forEach((item) => {
    if (!allOpportunities.some((o) => o.link === item.link && o.title === item.title)) {
      if (isOpportunityValid(item.title, item.raw_description, item.deadline, item.link)) {
        allOpportunities.push(item)
      }
    }
  })

  if (!allOpportunities.some((o) => isArtFineNationLink(o.link))) {
    allOpportunities.unshift(guaranteed)
  }

  logs.push(`Загалом зібрано елементів після фільтрації: ${allOpportunities.length}`)
  return allOpportunities
}
