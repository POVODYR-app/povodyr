export type CommercialDemandInput = {
  title?: string | null
  description?: string | null
  what_is_needed?: string | null
  organization?: string | null
  source_url?: string | null
  deadline?: string | null
}

const DEMAND_PATTERNS = [
  /шука(ємо|ю|є)\s[\s\S]{0,80}(картин|живопис|художн|полотн|арт[-\s]?партнер|мистецтв)/i,
  /потрібн(і|а|о)\s[\s\S]{0,80}(картин|живопис|художн|полотн|арт)/i,
  /купимо\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /куплю\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /замовити\s[\s\S]{0,40}картин/i,
  /картин[\s\S]{0,40}на замовлення/i,
  /на замовлення/i,
  /комісі(я|ї|йне)/i,
  /\bcommission\b/i,
  /looking for (an?\s)?(artist|paintings?|artwork)/i,
  /open\s*call for artists/i,
  /call for artists/i,
  /art for (hotel|restaurant|office|interior)/i,
  /закуп(ити|івля)\s[\s\S]{0,60}(картин|живопис|художн|мистецтв|полотн|арт)/i,
  /(картин|живопис|художн|мистецтв|полотн|арт)[\s\S]{0,60}(закупівл|тендер)/i,
  /тендер[\s\S]{0,60}(картин|живопис|художн|мистецтв|полотн|арт)/i,
  /колекці(я|онер)[\s\S]{0,40}(шука|куп)/i,
  /арт[-\s]?оренд/i,
  /art rental/i,
  /\bbrief\b/i,
  /шука(ємо|ю|є)\s[\s\S]{0,80}(партнер|розміщен)/i,
  /продаж робіт художник/i,
  /exhibition for sale/i,
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
  /prom\.ua/i,
  /rozetka\./i,
  /etsy\.com/i,
  /amazon\./i,
  /прода(м|ю|ємо|ється)\s[\s\S]{0,40}(картин|живопис|полотн)/i,
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
  /open\s*call(?![\s\S]{0,80}(продаж|sale|buy|купів|замов|artist))/i,
]

const JOB_BOARD_URL = /work\.ua|robota\.ua|djinni|hh\.ua|linkedin\.com\/jobs/i
const MARKETPLACE_URL = /prom\.ua|rozetka|etsy\.com|amazon\./i

function blobOf(input: CommercialDemandInput): string {
  return [
    input.title || '',
    input.description || '',
    input.what_is_needed || '',
    input.organization || '',
    input.source_url || '',
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
  const combined = `${title}\n${snippet}\n${url}`
  if (!hasDemandSignal(combined)) return true
  if (isSellerOrPlanText(combined)) return true
  if (isJunkText(combined) && !hasDemandSignal(combined)) return true
  if (JOB_BOARD_URL.test(url) && !hasDemandSignal(combined)) return true
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
  if (blobHas(JUNK_PATTERNS, combined) && !hasDemandSignal(combined)) return false
  return true
}
