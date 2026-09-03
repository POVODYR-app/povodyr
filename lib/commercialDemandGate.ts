export type CommercialDemandInput = {
  title?: string | null
  description?: string | null
  what_is_needed?: string | null
  organization?: string | null
  source_url?: string | null
  deadline?: string | null
}

const TRACKING_PARAMS = [
  'srsltid',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
]

export function normalizeCommercialSourceUrl(raw?: string | null): string {
  if (!raw) return ''
  try {
    const parsed = new URL(String(raw).trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    const keys = Array.from(parsed.searchParams.keys())
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      if (TRACKING_PARAMS.indexOf(key) !== -1 || key.indexOf('utm_') === 0) {
        parsed.searchParams.delete(key)
      }
    }
    parsed.hash = ''
    let href = parsed.toString()
    if (href.charAt(href.length - 1) === '/') href = href.slice(0, -1)
    return href
  } catch {
    return String(raw).trim()
  }
}

const DEMAND_PATTERNS = [
  /шука(ємо|ю|є)\s[\s\S]{0,80}(картин|живопис|художн|полотн|арт[-\s]?партнер|мистецтв)/i,
  /потрібн(і|а|о)\s[\s\S]{0,80}(картин|живопис|художн|полотн|арт)/i,
  /купимо\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /куплю\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /замовити\s[\s\S]{0,40}картин/i,
  /шука(ємо|ю|є)[\s\S]{0,40}на замовлення/i,
  /looking for (an?\s)?(artist|paintings?|artwork)/i,
  /колекці(я|онер)[\s\S]{0,40}(шука|куп)/i,
  /арт[-\s]?оренд/i,
  /art rental/i,
  /шука(ємо|ю|є)\s[\s\S]{0,80}(партнер|розміщен)/i,
  /продаж робіт художник/i,
  /exhibition for sale/i,
  /needed:?\s*(an?\s)?(artist|paintings?|artwork)/i,
]

const SELLER_OR_PLAN_PATTERNS = [
  /\/plans\//i,
  /e-lot\.com\.ua\/plans/i,
  /план(у)? закупівель/i,
  /річний план/i,
  /annual procurement plan/i,
  /UA-P-20\d{2}/i,
  /інтернет[-\s]?магазин/i,
  /каталог картин/i,
  /картин(и|а)\sв наявності/i,
  /готові картини (в наявності|з доставк)/i,
  /купити картин/i,
  /купити живопис/i,
  /\/shop\b/i,
  /\/catalog/i,
  /\/collections\//i,
  /\/blogs\//i,
  /\/pages\/commission/i,
  /prom\.ua/i,
  /rozetka\./i,
  /etsy\.com/i,
  /amazon\./i,
  /прода(м|ю|ємо|ється)\s[\s\S]{0,40}(картин|живопис|полотн)/i,
  /how to commission/i,
  /commission (a |original |bespoke )?(artwork|painting)/i,
  /bespoke painting/i,
  /shop now/i,
  /browse the original/i,
  /start your (artwork )?commission/i,
  /we (offer|create|paint|deliver|work directly with)[\s\S]{0,40}(commission|bespoke|designers)/i,
  /certificate of authenticity/i,
]

const JUNK_PATTERNS = [
  /вакансі/i,
  /\bjob\b/i,
  /\bhiring\b/i,
  /\bvacancy\b/i,
  /шукаємо (дизайнера|менеджера|продавця|консультанта)/i,
  /резюме/i,
  /купити рамк/i,
  /багетн/i,
  /прода(ємо|ж) рамк/i,
  /\bnews\b/i,
  /новини мистецтв/i,
  /інтерв['’`]ю/i,
  /\binterview\b/i,
  /резиденці/i,
  /\bresidency\b/i,
  /\bgrant\b/i,
  /грант(?!ов)/i,
    /open\s*call/i,
  /call for artists/i,
]

const JOB_BOARD_URL = /work\.ua|robota\.ua|djinni|hh\.ua|linkedin\.com\/jobs/i
const MARKETPLACE_URL = /prom\.ua|rozetka|etsy\.com|amazon\./i

function blobOf(input: CommercialDemandInput): string {
  return [
    input.title || '',
    input.description || '',
    input.what_is_needed || '',
    input.organization || '',
    normalizeCommercialSourceUrl(input.source_url) || input.source_url || '',
  ].join('\n')
}

function blobHas(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

export function hasDemandSignal(text: string): boolean {
  return blobHas(DEMAND_PATTERNS, text)
}

export function isSellerOrPlanText(text: string): boolean {
  return blobHas(SELLER_OR_PLAN_PATTERNS, text)
}

export function isJunkText(text: string): boolean {
  return blobHas(JUNK_PATTERNS, text) || isSellerOrPlanText(text)
}

export function isDeadlineInPast(deadline?: string | null): boolean {
  if (!deadline) return false
  const timestamp = Date.parse(String(deadline))
  if (!Number.isFinite(timestamp)) return false
  return timestamp < Date.now() - 24 * 60 * 60 * 1000
}

export function hasStalePlanYear(text: string, now = new Date()): boolean {
  const currentYear = now.getFullYear()
  const uaPlan = text.match(/UA-P-(20\d{2})/i)
  if (uaPlan && Number(uaPlan[1]) < currentYear) return true

  const looksLikePlan = /план|\/plans\//i.test(text)
  if (!looksLikePlan) return false

  const years = text.match(/20\d{2}/g) || []
  if (!years.length) return false

  let hasCurrentOrFuture = false
  let hasPast = false
  for (let i = 0; i < years.length; i += 1) {
    const year = Number(years[i])
    if (year < currentYear) hasPast = true
    if (year >= currentYear) hasCurrentOrFuture = true
  }
  return hasPast && !hasCurrentOrFuture
}

export function shouldSkipSearchResult(title: string, snippet: string, url: string): boolean {
  const combined = `${title}\n${snippet}\n${normalizeCommercialSourceUrl(url) || url}`
  if (isSellerOrPlanText(combined)) return true
  if (!hasDemandSignal(combined)) return true
  if (JOB_BOARD_URL.test(url)) return true
  if (MARKETPLACE_URL.test(url)) return true
  if (hasStalePlanYear(combined)) return true
  return false
}

export function isRealBuyerRequest(input: CommercialDemandInput): boolean {
  const combined = blobOf(input)
  if (!combined.trim()) return false
  if (isDeadlineInPast(input.deadline)) return false
  if (hasStalePlanYear(combined)) return false
  if (isSellerOrPlanText(combined)) return false
  if (!hasDemandSignal(combined)) return false
  return true
}
