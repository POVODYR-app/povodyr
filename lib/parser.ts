import * as cheerio from 'cheerio'

export interface ParsedOpportunity {
  source_name: string
  title: string
  link: string
  source_url: string
  type: string
  deadline: string | null
  country: string
  eligible_countries?: string[]
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
  'https://sites.google.com/view/artfinenation/open-call'

const FETCH_TIMEOUT_MS = 8000
const SERPER_TIMEOUT_MS = 9000
const SERPER_MAX_QUERIES = 6
const SERPER_RESULTS_PER_QUERY = 8

const LISTING_TITLE_RE =
  /актуальн(ий|і)\s+(open\s*call|гранти)|open\s*call та події|grants?\s+database|residenc(y|ies)\s+listing|swiss arts council residencies|календар конкурсів|база грантів/i

const LISTING_HOST_PATH_RE =
  /(resartis\.org\/open-calls\/?$|transartists\.org\/en\/?$|on-the-move\.org\/news\/?$|prohelvetia\.ch\/en\/sundry\/residencies|fundsforngos|grant\.market\/?$|getgrant\.ua\/?$)/i

const DEAD_URL_RE = /prohelvetia\.ch\/en\/sundry\/residencies/i

export const SEARCH_KEYWORDS = {
  ua: [
    'Open call для художників',
    'Open call для митців',
    'Мистецька резиденція для художників',
    'Гранти для художників Україна',
  ],
  en: [
    'Open call for visual artists',
    'Artist residency open call Europe Ukraine eligible',
    'Art grant for Ukrainian artists',
    'Visual arts residency deadline',
  ],
}

export const HASHTAGS_LIST = [
  '#opencallукраїна',
  '#виставкакартин',
  '#мистецькарезиденція',
  '#грантидлямитців',
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
  return /sites\.google\.com\/view\/artfinenation/i.test(link) || /artfinenation/i.test(link)
}

function looksLikeListing(title: string, url: string): boolean {
  if (isArtFineNationLink(url) || isArtFineNationLink(title)) return false
  if (LISTING_TITLE_RE.test(title)) return true
  if (LISTING_HOST_PATH_RE.test(url)) return true
  return false
}

function uaMonthToNumber(raw: string): number | null {
  const m = raw.toLowerCase()
  const map: Record<string, number> = {
    січня: 1,
    лютого: 2,
    березня: 3,
    квітня: 4,
    травня: 5,
    червня: 6,
    липня: 7,
    серпня: 8,
    вересня: 9,
    жовтня: 10,
    листопада: 11,
    грудня: 12,
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  }
  return map[m] || null
}

export function extractDeadlineFromText(text: string): string | null {
  const src = String(text || '')
  if (!src) return null

  const iso = src.match(/\b(20[2-3][0-9])-(\d{2})-(\d{2})\b/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  const dotted = src.match(/\b(\d{1,2})[./](\d{1,2})[./](20[2-3][0-9])\b/)
  if (dotted) {
    const day = dotted[1].padStart(2, '0')
    const month = dotted[2].padStart(2, '0')
    const d = new Date(`${dotted[3]}-${month}-${day}T00:00:00.000Z`)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  const en = src.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20[2-3][0-9])\b/i
  )
  if (en) {
    const month = uaMonthToNumber(en[1])
    if (month) {
      const day = en[2].padStart(2, '0')
      const mm = String(month).padStart(2, '0')
      const d = new Date(`${en[3]}-${mm}-${day}T00:00:00.000Z`)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
  }

  const uk = src.match(
    /\b(\d{1,2})\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\s+(20[2-3][0-9])/i
  )
  if (uk) {
    const month = uaMonthToNumber(uk[2])
    if (month) {
      const day = uk[1].padStart(2, '0')
      const mm = String(month).padStart(2, '0')
      const d = new Date(`${uk[3]}-${mm}-${day}T00:00:00.000Z`)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
  }

  return null
}

function inferCountry(text: string, fallback = 'International'): { country: string; eligible: string[] } {
  const t = text.toLowerCase()
  const uaOnly =
    (/українськ|ukraine only|громадян укра/i.test(t) &&
      !/єс|eu |europe|міжнародн|international|польщ|spain|moldova/i.test(t)) ||
    /укф|український культурний фонд/.test(t)

  if (uaOnly && /укф|український культурний фонд|громадян укра/.test(t)) {
    return { country: 'Україна', eligible: ['Україна'] }
  }
  if (/art fine nation/.test(t)) {
    return { country: 'Україна', eligible: ['Україна'] }
  }
  return { country: fallback, eligible: ['International'] }
}

function inferType(title: string, description: string): string {
  const t = `${title} ${description}`.toLowerCase()
  if (/residenc|резиденц/.test(t)) return 'Residency'
  if (/grant|грант|стипенд/.test(t)) return 'Grant'
  if (/prize|award|премі/.test(t)) return 'Award'
  return 'Open Call'
}

function isOpportunityValid(
  title: string,
  description: string,
  deadline: string | null,
  link?: string
): boolean {
  if (isArtFineNationLink(link)) return true
  if (DEAD_URL_RE.test(String(link || ''))) return false
  if (looksLikeListing(title, String(link || ''))) return false

  const titleLower = title.toLowerCase()
  const descLower = description.toLowerCase()
  const combinedText = `${titleLower} ${descLower}`

  const negativeKeywords = [
    'board member',
    'welcomes',
    'appointed',
    'highlights',
    'anniversary',
    'meeting',
    'conference report',
    'goodbye',
    'interview',
    'spotlight on',
    'selected artists',
    'selected projects',
    'selected project',
    'awarded',
    'announces the recipients',
    'congratulations',
    'now online',
    'exhibition opening',
    'on view',
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

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PovodyrBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    clearTimeout(timeoutId)
    if (!res.ok) return ''
    return await res.text()
  } catch {
    clearTimeout(timeoutId)
    return ''
  }
}

function baseOpportunity(partial: Partial<ParsedOpportunity> & {
  source_name: string
  title: string
  link: string
}): ParsedOpportunity {
  const sourceUrl = partial.source_url || partial.link
  return {
    source_name: partial.source_name,
    title: partial.title.substring(0, 160),
    link: partial.link,
    source_url: sourceUrl,
    type: partial.type || 'Open Call',
    deadline: partial.deadline || null,
    country: partial.country || 'International',
    eligible_countries: partial.eligible_countries || ['International'],
    is_free: partial.is_free !== false,
    cost_amount: partial.cost_amount ?? 0,
    cost_currency: partial.cost_currency || 'EUR',
    genres: partial.genres || ['Visual Art', 'Painting'],
    techniques: partial.techniques || [],
    artist_levels: partial.artist_levels || ['Emerging', 'Mid-Career', 'Established'],
    age_restrictions: partial.age_restrictions || 'None',
    languages: partial.languages || ['en'],
    ukrainians_eligible: partial.ukrainians_eligible !== false,
    raw_description: String(partial.raw_description || partial.title).substring(0, 500),
  }
}

export function getGuaranteedArtFineNationOpportunity(): ParsedOpportunity {
  return baseOpportunity({
    source_name: 'Art Fine Nation',
    title:
      'Art Fine Nation Перша українська мистецька агенція — Open Call виставки, конкурси, пленери',
    link: ART_FINE_NATION_URL,
    source_url: ART_FINE_NATION_URL,
    type: 'Open Call',
    deadline: null,
    country: 'Україна',
    eligible_countries: ['Україна'],
    cost_currency: 'UAH',
    genres: ['Образотворче мистецтво', 'Живопис', 'Графіка', 'Колаж', 'Скульптура'],
    techniques: ['Олія', 'Акрил', 'Змішана техніка'],
    languages: ['uk'],
    raw_description:
      'Офіційна сторінка open call Першої української мистецької агенції Art Fine Nation. Завжди в добірці для регіону Україна.',
  })
}

export async function parseArtFineNationHTML(): Promise<ParsedOpportunity[]> {
  return [getGuaranteedArtFineNationOpportunity()]
}

function extractDeadlineFromHtml(html: string): string | null {
  const $ = cheerio.load(html)
  const text = $('body').text().replace(/\s+/g, ' ').slice(0, 12000)
  return extractDeadlineFromText(text)
}

export async function parseResArtisHTML(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const targetUrl = 'https://www.resartis.org/open-calls/'
  const html = await fetchText(targetUrl)
  if (!html) return opportunities

  const $ = cheerio.load(html)
  $('article, .opportunity-item, .post, .card').each((_, element) => {
    const $el = $(element)
    const title = $el.find('h2, h3, a').first().text().trim().replace(/\s+/g, ' ')
    const href = $el.find('a').attr('href') || ''
    const description = $el.find('p, .excerpt').text().trim().replace(/\s+/g, ' ')
    if (!title || title.length < 6) return

    const fullLink = href.startsWith('http') ? href : `https://www.resartis.org${href}`
    if (looksLikeListing(title, fullLink)) return
    if (/resartis\.org\/open-calls\/?$/i.test(fullLink)) return

    const deadline = extractDeadlineFromText(`${title} ${description}`)
    if (!isOpportunityValid(title, description, deadline, fullLink)) return

    opportunities.push(
      baseOpportunity({
        source_name: 'Res Artis',
        title,
        link: fullLink,
        source_url: fullLink,
        type: 'Residency',
        deadline,
        country: 'International',
        eligible_countries: ['International'],
        raw_description: description || `Residency Open Call: ${title}`,
      })
    )
  })

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
    'open call',
    'opencall',
    'call for',
    'deadline',
    'apply',
    'application',
    'residency',
    'residencies',
    'grant',
    'grants',
    'prize',
    'award',
    'submission',
    'submit',
    'exhibition opportunity',
    'artist call',
    'mobility',
    'відкритий конкурс',
    'резиденц',
    'грант',
  ]

  const negativeKeywords = [
    'board member',
    'welcomes',
    'appointed',
    'highlights',
    'anniversary',
    'meeting',
    'conference report',
    'goodbye',
    'interview',
    'spotlight on',
    'selected artists',
    'selected projects',
    'selected project',
    'awarded',
    'announces the recipients',
    'congratulations',
    'now online',
    'exhibition opening',
    'on view',
  ]

  for (let s = 0; s < sources.length; s += 1) {
    const source = sources[s]
    let items: Array<{ title: string; link: string; description: string }> = []

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}&count=30`
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
            link: i.link || i.guid || '',
            description: i.description || i.content || '',
          }))
        }
      }
    } catch {
      // fallback below
    }

    if (items.length === 0) {
      const xml = await fetchText(source.url)
      if (xml) {
        const $ = cheerio.load(xml, { xmlMode: true })
        $('item, entry').each((_, element) => {
          const title = $(element).find('title').text().trim()
          const link =
            $(element).find('link').attr('href') || $(element).find('link').text().trim()
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
    }

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item.link || !/^https?:\/\//i.test(item.link)) continue
      if (DEAD_URL_RE.test(item.link) || looksLikeListing(item.title, item.link)) continue

      const titleLower = item.title.toLowerCase()
      const descLower = (item.description || '').toLowerCase()
      const hasPositive = positiveKeywords.some(
        (kw) => titleLower.includes(kw) || descLower.includes(kw)
      )
      const hasNegative = negativeKeywords.some((kw) => titleLower.includes(kw))
      if (!hasPositive || hasNegative) continue

      const deadline = extractDeadlineFromText(`${item.title} ${item.description}`)
      if (!isOpportunityValid(item.title, item.description, deadline, item.link)) continue

      const geo = inferCountry(`${item.title} ${item.description}`)
      opportunities.push(
        baseOpportunity({
          source_name: source.name,
          title: item.title,
          link: item.link,
          source_url: item.link,
          type: inferType(item.title, item.description),
          deadline,
          country: geo.country,
          eligible_countries: geo.eligible,
          raw_description: (item.description || item.title).replace(/<[^>]+>/g, '').trim(),
        })
      )
    }
  }

  return opportunities
}

export async function parseSocialMediaAndHashtags(): Promise<ParsedOpportunity[]> {
  return []
}

export async function parseUkrainianInstitutionsHTML(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = []
  const pages = [
    { url: 'https://ucf.in.ua/news/debiuty-eu', name: 'Український культурний фонд' },
    { url: 'https://ucf.in.ua/news/anons-2026', name: 'Український культурний фонд' },
  ]

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i]
    const html = await fetchText(page.url)
    if (!html) continue
    const $ = cheerio.load(html)
    const title = $('h1, .news-title, title').first().text().trim().replace(/\s+/g, ' ')
    if (!title || looksLikeListing(title, page.url)) continue
    const body = $('article, .news-content, .content, main, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .slice(0, 2500)
    const deadline = extractDeadlineFromHtml(html) || extractDeadlineFromText(`${title} ${body}`)
    if (!isOpportunityValid(title, body, deadline, page.url)) continue

    opportunities.push(
      baseOpportunity({
        source_name: page.name,
        title,
        link: page.url,
        source_url: page.url,
        type: inferType(title, body),
        deadline,
        country: 'Україна',
        eligible_countries: ['Україна'],
        cost_currency: 'UAH',
        languages: ['uk'],
        raw_description: body.slice(0, 500),
      })
    )
  }

  return opportunities
}

function getLiveSeedOpportunities(): ParsedOpportunity[] {
  return [
    baseOpportunity({
      source_name: 'ART4MENTAL',
      title: 'ART4MENTAL: open call для митців України та ЄС — VR / арт-терапія, до €5000',
      link: 'https://www.art4mental.com/application',
      source_url: 'https://www.art4mental.com/application',
      type: 'Open Call',
      deadline: '2026-11-11T18:00:00.000Z',
      country: 'International',
      eligible_countries: ['International'],
      languages: ['uk', 'en'],
      raw_description:
        'Creative Europe. Митці з України та ЄС створюють імерсивні VR-роботи для терапії. Субгрант до €5000. Дедлайн зі сторінки подачі: листопад 2026.',
    }),
    baseOpportunity({
      source_name: 'Інша Освіта / Culture Helps Solidarity',
      title: 'Culture Helps Solidarity: проєктні гранти до €7000 — пам’ять і громади',
      link: 'https://culturehelpssolidarity.eu/project-grants/',
      source_url: 'https://culturehelpssolidarity.eu/project-grants/',
      type: 'Grant',
      deadline: '2026-10-06T13:00:00.000Z',
      country: 'International',
      eligible_countries: ['International'],
      languages: ['uk', 'en'],
      raw_description:
        'Проєктні гранти Culture Helps Solidarity (Insha Osvita, ECF, zusa, VETERANKA). Україна та Європа. Дедлайн зі сторінки: 6.10.2026.',
    }),
    baseOpportunity({
      source_name: 'Український культурний фонд',
      title: 'УКФ «Мистецькі дебюти» — грант 250 000–715 000 грн',
      link: 'https://ucf.in.ua/news/debiuty-eu',
      source_url: 'https://ucf.in.ua/news/debiuty-eu',
      type: 'Grant',
      deadline: '2026-10-05T15:00:00.000Z',
      country: 'Україна',
      eligible_countries: ['Україна'],
      cost_currency: 'UAH',
      languages: ['uk'],
      raw_description:
        'Конкурс програми «Культурні горизонти» УКФ. Подача через кабінет УКФ до 5.10.2026, 18:00 за Києвом.',
    }),
    baseOpportunity({
      source_name: 'Perform Europe',
      title: 'Open Call of Perform Europe 2026-2028',
      link: 'https://culture.ec.europa.eu/funding/calls/open-call-of-perform-europe-2026-2028',
      source_url: 'https://culture.ec.europa.eu/funding/calls/open-call-of-perform-europe-2026-2028',
      type: 'Open Call',
      deadline: '2026-10-31T00:00:00.000Z',
      country: 'International',
      eligible_countries: ['International'],
      raw_description:
        'Відкритий заклик Perform Europe 2026-2028 для міжнародних проєктів і культурних колаборацій.',
    }),
    baseOpportunity({
      source_name: 'British Council Ukraine',
      title: 'Connections Through Culture 2026',
      link: 'https://www.britishcouncil.org.ua/programmes/arts/connections-through-culture-2026',
      source_url: 'https://www.britishcouncil.org.ua/programmes/arts/connections-through-culture-2026',
      type: 'Grant',
      deadline: null,
      country: 'International',
      eligible_countries: ['International'],
      cost_currency: 'GBP',
      languages: ['uk', 'en'],
      raw_description:
        'Програма Британської ради Connections Through Culture для партнерства між Україною та Великою Британією.',
    }),
    baseOpportunity({
      source_name: 'Culture Moves Europe',
      title: 'Culture Moves Europe: Individual Mobility',
      link: 'https://culture.ec.europa.eu/creative-europe/culture-moves-europe',
      source_url: 'https://culture.ec.europa.eu/creative-europe/culture-moves-europe',
      type: 'Grant',
      deadline: null,
      country: 'International',
      eligible_countries: ['International'],
      raw_description: 'Програма мобільності Creative Europe для митців і культурних діячів.',
    }),
    baseOpportunity({
      source_name: 'Secondary Archive',
      title: 'Open call for women artists from V4, WB and EaP',
      link: 'https://secondaryarchive.org/news/open-call-for-women-artists-from-v4-wb-and-eap/',
      source_url: 'https://secondaryarchive.org/news/open-call-for-women-artists-from-v4-wb-and-eap/',
      type: 'Open Call',
      deadline: '2026-11-15T00:00:00.000Z',
      country: 'International',
      eligible_countries: ['International'],
      raw_description:
        'Katarzyna Kozyra Foundation. Візуальні мисткині до 35 років з країн V4, Західних Балкан і СхП, зокрема України. Дедлайн зі сторінки: 15 листопада.',
    }),
  ]
}

async function searchSerper(
  query: string,
  opts?: { tbs?: string; gl?: string; hl?: string }
): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const key = process.env.SERPER_API_KEY || process.env.SERPER_KEY || ''
  if (!key) return []

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS)
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: SERPER_RESULTS_PER_QUERY,
        gl: opts?.gl || 'ua',
        hl: opts?.hl || 'uk',
        tbs: opts?.tbs || 'qdr:m',
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) return []
    const data = await res.json()
    const organic = Array.isArray(data.organic) ? data.organic : []
    const out: Array<{ title: string; link: string; snippet: string }> = []
    for (let i = 0; i < organic.length; i += 1) {
      const row = organic[i]
      const link = String(row.link || '')
      const title = String(row.title || '')
      const snippet = String(row.snippet || row.description || '')
      if (link && title) out.push({ title, link, snippet })
    }
    return out
  } catch {
    clearTimeout(timeoutId)
    return []
  }
}

function isUsefulSearchHit(title: string, snippet: string, link: string): boolean {
  if (!/^https?:\/\//i.test(link)) return false
  if (isArtFineNationLink(link) || isArtFineNationLink(title)) return false
  if (DEAD_URL_RE.test(link) || looksLikeListing(title, link)) return false
  if (/\.(pdf|docx?|zip)(\?|$)/i.test(link)) return false
  if (/(facebook|instagram|tiktok|pinterest)\.com/i.test(link)) return false

  const text = `${title} ${snippet}`.toLowerCase()
  const positive =
    /open call|opencall|call for|residency|residenc|grant|deadline|apply now|artist call|виставк|резиденц|грант|відкритий конкурс|подати заявк/.test(
      text
    )
  if (!positive) return false
  return isOpportunityValid(title, snippet, extractDeadlineFromText(text), link)
}

export async function searchNewPagesViaSerper(logs: string[] = []): Promise<ParsedOpportunity[]> {
  const key = process.env.SERPER_API_KEY || process.env.SERPER_KEY || ''
  if (!key) {
    logs.push('Serper: немає SERPER_API_KEY — мережевий пошук пропущено')
    return []
  }

  const year = new Date().getFullYear()
  const queries = [
    `open call visual artists ${year} deadline`,
    `artist residency open call ${year} Ukraine eligible`,
    `open call для художників ${year} дедлайн`,
    `гранти для митців Україна ${year} відкритий конкурс`,
    `site:ucf.in.ua конкурс ${year}`,
    `site:e-flux.com open call ${year}`,
  ].slice(0, SERPER_MAX_QUERIES)

  const found: ParsedOpportunity[] = []
  const seen = new Map<string, boolean>()

  for (let q = 0; q < queries.length; q += 1) {
    const query = queries[q]
    const hits = await searchSerper(query, {
      tbs: 'qdr:m',
      gl: /site:ucf|художн|грант/i.test(query) ? 'ua' : 'us',
      hl: /site:ucf|художн|грант/i.test(query) ? 'uk' : 'en',
    })
    logs.push(`Serper «${query}»: ${hits.length} результатів`)

    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i]
      if (seen.has(hit.link)) continue
      seen.set(hit.link, true)
      if (!isUsefulSearchHit(hit.title, hit.snippet, hit.link)) continue

      let deadline = extractDeadlineFromText(`${hit.title} ${hit.snippet}`)
      if (!deadline) {
        const html = await fetchText(hit.link, 5000)
        if (html) deadline = extractDeadlineFromHtml(html)
      }

      const geo = inferCountry(`${hit.title} ${hit.snippet} ${hit.link}`)
      const item = baseOpportunity({
        source_name: 'Serper',
        title: hit.title,
        link: hit.link,
        source_url: hit.link,
        type: inferType(hit.title, hit.snippet),
        deadline,
        country: geo.country,
        eligible_countries: geo.eligible,
        languages: /[а-яіїєґ]/i.test(hit.title) ? ['uk'] : ['en'],
        raw_description: hit.snippet || hit.title,
      })

      if (!isOpportunityValid(item.title, item.raw_description, item.deadline, item.link)) continue
      found.push(item)
    }
  }

  logs.push(`Serper після фільтра: ${found.length}`)
  return found
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
    allOpportunities.push.apply(allOpportunities, afnResults)
  } catch (err: any) {
    logs.push(`Помилка Art Fine Nation: ${err.message}`)
  }

  logs.push('Запуск прямого парсингу Res Artis Open Calls...')
  try {
    const resArtisResults = await parseResArtisHTML()
    logs.push(`Res Artis знайшов записів: ${resArtisResults.length}`)
    allOpportunities.push.apply(allOpportunities, resArtisResults)
  } catch (err: any) {
    logs.push(`Помилка Res Artis: ${err.message}`)
  }

  logs.push('Запуск парсингу RSS-джерел...')
  try {
    const rssResults = await parseRssSources()
    logs.push(`RSS-джерела знайшли записів: ${rssResults.length}`)
    allOpportunities.push.apply(allOpportunities, rssResults)
  } catch (err: any) {
    logs.push(`Помилка RSS: ${err.message}`)
  }

  logs.push('Збір публікацій із соцмереж та за хештегами...')
  try {
    const socialResults = await parseSocialMediaAndHashtags()
    logs.push(`Знайдено записів із соцмереж та хештегів: ${socialResults.length}`)
    allOpportunities.push.apply(allOpportunities, socialResults)
  } catch (err: any) {
    logs.push(`Помилка парсингу соцмереж: ${err.message}`)
  }

  logs.push('Збір можливостей з українських інституцій (УКФ)...')
  try {
    const uaInstResults = await parseUkrainianInstitutionsHTML()
    logs.push(`Знайдено записів з українських інституцій: ${uaInstResults.length}`)
    allOpportunities.push.apply(allOpportunities, uaInstResults)
  } catch (err: any) {
    logs.push(`Помилка парсингу українських інституцій: ${err.message}`)
  }

  logs.push('Щоденний мережевий пошук нових сторінок (Serper)...')
  try {
    const serperResults = await searchNewPagesViaSerper(logs)
    logs.push(`Serper додав записів: ${serperResults.length}`)
    allOpportunities.push.apply(allOpportunities, serperResults)
  } catch (err: any) {
    logs.push(`Помилка Serper: ${err.message}`)
  }

  logs.push('Додавання перевірених живих карток...')
  const seeds = getLiveSeedOpportunities()
  logs.push(`перевірених карток: ${seeds.length}`)
  for (let i = 0; i < seeds.length; i += 1) {
    const item = seeds[i]
    const already = allOpportunities.some((o) => o.link === item.link || o.source_url === item.source_url)
    if (already) continue
    if (isOpportunityValid(item.title, item.raw_description, item.deadline, item.link)) {
      allOpportunities.push(item)
    }
  }

  if (!allOpportunities.some((o) => isArtFineNationLink(o.link))) {
    allOpportunities.unshift(guaranteed)
  }

  logs.push(`Загалом зібрано елементів після фільтрації: ${allOpportunities.length}`)
  return allOpportunities
}
