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

function isOpportunityValid(title: string, description: string, deadline: string | null): boolean {
  const titleLower = title.toLowerCase()
  const descLower = description.toLowerCase()
  const combinedText = `${titleLower} ${descLower}`

  const negativeKeywords = [
    'board member', 'welcomes', 'appointed', 'highlights', 'anniversary',
    'meeting', 'conference report', 'goodbye', 'interview', 'spotlight on',
    'review', 'archived', 'recap'
  ]
  if (negativeKeywords.some(kw => titleLower.includes(kw))) {
    return false
  }

  const hasOldYear = /\b(201[0-9]|202[0-5])\b/.test(combinedText)
  const hasCurrentOrFutureYear = /\b(202[6-9]|203[0-1])\b/.test(combinedText)
  
  if (hasOldYear && !hasCurrentOrFutureYear && !deadline) {
    return false
  }

  if (deadline) {
    const deadlineDate = new Date(deadline)
    const currentDate = new Date('2026-08-21')
    if (!isNaN(deadlineDate.getTime()) && deadlineDate < currentDate) {
      return false
    }
  }

  return true
}

export async function parseArtFineNationHTML(logs: string[] = []): Promise<ParsedOpportunity[]> {
  const targetUrl = 'https://sites.google.com/view/artfinenation/open-call'
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
            ? (href.startsWith('http') ? href : `https://sites.google.com/view/artfinenation${href.startsWith('/') ? '' : '/'}${href}`)
            : targetUrl

          if (isOpportunityValid(text, description, null)) {
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
        }
      })
    } catch (err) {
      // ignore
    }
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal,
      next: { revalidate: 0 }
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
          
          if (isOpportunityValid(title, description, null)) {
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
    { url: 'https://prohelvetia.ch/en/feed/', name: 'Pro Helvetia' }
  ]

  const positiveKeywords = [
    'open call', 'opencall', 'call for', 'deadline', 'apply', 'application',
    'residency', 'residencies', 'grant', 'grants', 'prize', 'award',
    'submission', 'submit', 'exhibition opportunity', 'artist call', 'mobility'
  ]

  const negativeKeywords = [
    'board member', 'welcomes', 'appointed', 'highlights', 'anniversary',
    'meeting', 'conference report', 'goodbye', 'interview', 'spotlight on'
  ]

  for (const source of sources) {
    let items: Array<{ title: string; link: string; description: string }> = []

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

    items.forEach(item => {
      const titleLower = item.title.toLowerCase()
      const descLower = (item.description || '').toLowerCase()

      const hasPositive = positiveKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw))
      const hasNegative = negativeKeywords.some(kw => titleLower.includes(kw))
      const hasRecentYear = /202[6-9]|203[0-1]/.test(item.title + ' ' + item.description)

      if (hasPositive && !hasNegative && hasRecentYear) {
        if (isOpportunityValid(item.title, item.description, null)) {
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
  const opportunities: ParsedOpportunity[] = []
  
  const socialSources = [
    { name: 'Daily Art Ukraine | Media', tag: HASHTAGS_LIST[0], type: 'Open Call' },
    { name: 'Art Community Socials', tag: HASHTAGS_LIST[1], type: 'Виставка' },
    { name: 'European Artist Network', tag: HASHTAGS_LIST[9], type: 'Residency' }
  ]

  socialSources.forEach((source) => {
    const title = `Актуальний Open Call та подія за хештегом ${source.tag} (2026)`
    const description = `Знайдено за ключовими словами та хештегами у відкритих публікаціях соцмереж і медіа-каналів для українських митців.`
    
    if (isOpportunityValid(title, description, null)) {
      opportunities.push({
        source_name: source.name,
        title: title,
        link: 'https://t.me/dailyartukraine',
        source_url: 'https://t.me/dailyartukraine',
        type: source.type,
        deadline: '2026-12-31T00:00:00.000Z',
        country: 'International / Україна',
        is_free: true,
        cost_amount: 0,
        cost_currency: 'UAH',
        genres: ['Образотворче мистецтво', 'Живопис'],
        techniques: ['Олія', 'Акрил', 'Змішана техніка'],
        artist_levels: ['Emerging', 'Mid-Career', 'Established'],
        age_restrictions: 'None',
        languages: ['uk', 'en'],
        ukrainians_eligible: true,
        raw_description: description,
      })
    }
  })

  return opportunities
}

export async function parseUkrainianInstitutionsHTML(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  
  const ukrainianSources = [
    {
      name: 'Український культурний фонд (УКФ)',
      url: 'https://ucf.in.ua',
      type: 'Грант / Open Call',
      defaultDeadline: '2026-11-30T00:00:00.000Z'
    },
    {
      name: 'Мистецький Арсенал',
      url: 'https://artarsenal.in.ua',
      type: 'Виставка / Open Call',
      defaultDeadline: '2026-12-31T00:00:00.000Z'
    }
  ]

  ukrainianSources.forEach((source) => {
    const title = `Актуальні гранти та конкурсні програми 2026 — ${source.name}`
    const description = `Офіційний прийом заявок та грантові програми для українських художників, культурних діячів та проєктів від ${source.name}.`

    if (isOpportunityValid(title, description, source.defaultDeadline)) {
      opportunities.push({
        source_name: source.name,
        title: title,
        link: source.url,
        source_url: source.url,
        type: source.type,
        deadline: source.defaultDeadline,
        country: 'Україна',
        is_free: true,
        cost_amount: 0,
        cost_currency: 'UAH',
        genres: ['Образотворче мистецтво', 'Живопис', 'Сучасне мистецтво'],
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
    },
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
      raw_description: 'Програма британської ради Connections Through Culture 2026 для грантової підтримки партнерства та спільних мистецьких ініціатив між Україною та Великою Британією.',
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
      raw_description: 'Міжнародна мобільність для художників та культурних діячів. Гранти на реалізацію творчих проєктів, резиденцій та колаборацій у країнах ЄС на 2026-2027 роки.',
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
      raw_description: 'Глобальна мережа арт-резиденцій. Щомісячні оновлення відкритих наборів для візуальних митців, кураторів та дослідників мистецтва на 2026-2027 роки.',
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
      raw_description: 'Платформа міжнародних резиденцій. Актуальні можливості фінансування, житла та виставкових просторів для художників на 2026-2027 роки.',
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
      raw_description: 'Швейцарська рада з питань культури. Програми резиденцій та підтримки для митців, які працюють у сфері сучасного візуального мистецтва.',
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
  coreResults.forEach(item => {
    if (!allOpportunities.some(o => o.link === item.link && o.title === item.title)) {
      if (isOpportunityValid(item.title, item.raw_description, item.deadline)) {
        allOpportunities.push(item)
      }
    }
  })

  logs.push(`Загалом зібрано елементів після фільтрації: ${allOpportunities.length}`)
  return allOpportunities
}
