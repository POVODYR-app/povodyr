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

export function titleFingerprint(raw?: string | null): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-яіїєґ0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96)
}

const ART_OBJECT_PATTERNS = [
  /оригінальн(і|их|у)\s(картин|живопис|полотн)/i,
  /(картин[аиу]|живопис|художн(і|их)\sполотн|творів мистецтва)/i,
  /original (oil |acrylic |canvas )?(paintings?|artwork|artworks)/i,
  /\bfine art\b/i,
  /works of art/i,
  /art acquisition/i,
  /придбання (картин|живопису|творів мистецтва)/i,
]

const DEMAND_PATTERNS = [
  /шука(ємо|ю|є)\s[\s\S]{0,80}(картин|живопис|полотн)/i,
  /потрібн(і|а|о)\s[\s\S]{0,80}(картин|живопис|полотн)/i,
  /купимо\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /куплю\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /замовити\s[\s\S]{0,40}картин/i,
  /закуп(івля|ити|овуємо)\s[\s\S]{0,60}(картин|живопис|полотн|творів мистецтва)/i,
  /looking to (purchase|buy|source|commission) (original )?(art|paintings?|artwork)/i,
  /looking for (original )?(paintings?|artwork)/i,
  /needed:?\s*(original )?(paintings?|artwork)/i,
  /колекці(я|онер)[\s\S]{0,40}(шука|куп)/i,
  /арт[-\s]?оренд/i,
  /art rental/i,
  /purchase (original )?(art|paintings?|artwork)/i,
  /buy (original )?(paintings?|artwork)/i,
  /commission (original )?(paintings?|artwork)/i,
]

const STRONG_BUYER_PATTERNS = [
  /looking to (purchase|buy|source|commission) (original )?(art|paintings?|artwork)/i,
  /купимо\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /куплю\s[\s\S]{0,40}(картин|живопис|полотн|арт)/i,
  /шука(ємо|ю|є)\s[\s\S]{0,40}картин/i,
  /потрібн(і|а|о)\s[\s\S]{0,40}картин/i,
  /закуп(івля|ити|овуємо)\s[\s\S]{0,60}(картин|живопис|полотн|творів мистецтва)/i,
  /purchase (original )?(art|paintings?|artwork)/i,
  /buy (original )?(paintings?|artwork)/i,
  /we need original paintings/i,
  /commission original (paintings?|artwork)/i,
  /request for (proposal|qualifications)[\s\S]{0,100}(artwork|paintings?|fine art|public art)/i,
  /\bRF[PQ]\b[\s\S]{0,100}(artwork|paintings?|fine art|public art|живопис|картин)/i,
  /art acquisition/i,
  /придбання (картин|живопису|творів мистецтва)/i,
]

const TALENT_NOT_BUYER_PATTERNS = [
  /looking for (an?\s)?(artists?|painters?)\b/i,
  /seeking (an?\s)?(artists?|painters?)\b/i,
  /needed:?\s*(an?\s)?(artists?|painters?)\b/i,
  /hire (an?\s)?(artist|painter)/i,
  /hiring (an?\s)?(artist|painter|muralist)/i,
  /шука(ємо|ю|є)\s[\s\S]{0,40}художник/i,
  /потрібен художник/i,
  /cherche artiste/i,
  /suche künstler/i,
  /buscamos artista/i,
  /art consultant[\s\S]{0,60}(looking for|seeking) artists/i,
]

const EXHIBIT_NOT_PURCHASE_PATTERNS = [
  /to display/i,
  /for display/i,
  /rotating exhibit/i,
  /on display/i,
  /call for (artists|entries|submissions)/i,
  /open\s*call/i,
  /виставк[аиу]\sбез продажу/i,
  /експозиці/i,
  /board of county commissioners/i,
  /looking for artwork to display/i,
]

const ARTIST_SALE_EVENT_PATTERNS = [
  /artists selling (their )?work/i,
  /for sale by artists/i,
  /under the bed sale/i,
  /opportunity to purchase artwork from .{0,80}artists/i,
  /unique opportunity to purchase artwork/i,
  /priced from\s*[£$€₴]/i,
  /walk away with/i,
  /studio (clearance|sale)/i,
  /affordable opportunity for people to (start|continue) their art collections/i,
  /all for immediate sale/i,
  /over \d+ artists selling/i,
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
  /olx\.ua/i,
  /прода(м|ю|ємо|ється)\s[\s\S]{0,40}(картин|живопис|полотн)/i,
  /пропону(є|ю|ємо)\s[\s\S]{0,40}(робот|картин|мистецтв)/i,
  /how to commission/i,
  /start your (artwork )?commission/i,
  /shop now/i,
  /add to cart/i,
  /browse the original/i,
  /certificate of authenticity/i,
  /free shipping/i,
  /framed prints/i,
  /canvas prints/i,
  /metal prints/i,
  /wall murals/i,
  /картин[иа]?\sза номерами/i,
  /paint[-\s]?by[-\s]?numbers/i,
  /artists selling (their )?work/i,
  /for sale by artists/i,
  /under the bed sale/i,
]

const JUNK_PATTERNS = [
  /вакансі/i,
  /\bhiring\b/i,
  /\bvacancy\b/i,
  /шукаємо (дизайнера|менеджера|продавця|консультанта)/i,
  /резюме/i,
  /купити рамк/i,
  /багетн/i,
  /прода(ємо|ж) рамк/i,
  /новини мистецтв/i,
  /інтерв['’`]ю/i,
  /\binterview\b/i,
  /\bq-a\b/i,
  /q\s*&\s*a/i,
  /wandmaler gesucht/i,
  /graffiti/i,
  /стінопис/i,
  /мураліст/i,
  /sponsored feature/i,
]

const WALL_TRADE_PATTERNS = [
  /wandmaler/i,
  /graffiti artist/i,
  /стінопис/i,
  /мураліст/i,
  /\bmuralist\b/i,
  /wall painting contractors/i,
  /painting and coatings/i,
  /paintings?\s*&\s*coatings/i,
  /exterior painting and/i,
  /interior and exterior painting/i,
  /naics code:\s*238320/i,
  /малярн(ий|і|ого)\s(валік|роботи|послуг)/i,
  /мінівалик малярний/i,
  /фарб[аи]\sгрунтуюч/i,
  /емал[іі]\sалкідн/i,
  /дк 021:2015:\s*44810000/i,
  /дк 021:2015:\s*44510000/i,
  /professional art framing services/i,
  /painting service contract/i,
]

const JOB_BOARD_URL = /work\.ua|robota\.ua|djinni|hh\.ua|linkedin\.com\/jobs/i
const MARKETPLACE_URL = /prom\.ua|rozetka|etsy\.com|amazon\.|olx\.ua/i
const ARTIST_BLOG_OR_FICTION_URL =
  /angelacameron\.com|arkush\.net|thirdandwall\.com|heiek\.de|rogersphotography\.com|despinapaintings\.com|onthewight\.com|\/blogs\/|\/q-a-|\/commercial-artwork/i
const LISTING_OR_EMPTY_URL = /olx\.ua\/(?:uk\/)?list\//i
const SOCIAL_SHALLOW_URL =
  /instagram\.com|facebook\.com|fb\.com|threads\.com|threads\.net|facebook\.com\/groups|facebook\.com\/.*\/mentions|facebook\.com\/.*\/posts/i
const STALE_PUBLIC_URL = /UA-202[0-5]-/i
const TENDER_LISTING_URL =
  /prozorro\.gov\.ua\/uk\/search|prozorro\.gov\.ua\/uk\/plan\/|prozorro\.gov\.ua\/uk\/tender\/UA-[^/]+\/complaints/i
const PROCUREMENT_URL =
  /prozorro\.gov\.ua\/uk\/tender\/UA-|ted\.europa\.eu\/.+\/notice|sam\.gov\/(?:opp|workspace\/contract\/opp)\//i

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

export function hasStrongBuyerSignal(text: string): boolean {
  return blobHas(STRONG_BUYER_PATTERNS, text)
}

export function hasArtPurchaseObject(text: string): boolean {
  return blobHas(ART_OBJECT_PATTERNS, text)
}

export function isTalentNotBuyer(text: string): boolean {
  return blobHas(TALENT_NOT_BUYER_PATTERNS, text)
}

export function isExhibitNotPurchase(text: string): boolean {
  if (!blobHas(EXHIBIT_NOT_PURCHASE_PATTERNS, text)) return false
  if (/\b(RFQ|RFP|RFSQ|commission|eoi|expression of interest)\b/i.test(text)) return false
  if (/\$\s*\d|budget|дедлайн|deadline/i.test(text) && hasArtPurchaseObject(text)) return false
  return true
}

export function isArtistSaleEvent(text: string): boolean {
  return blobHas(ARTIST_SALE_EVENT_PATTERNS, text)
}

export function isSellerOrPlanText(text: string): boolean {
  return blobHas(SELLER_OR_PLAN_PATTERNS, text) || isArtistSaleEvent(text)
}

export function isWallTradeNotArt(text: string): boolean {
  return blobHas(WALL_TRADE_PATTERNS, text)
}

export function isJunkText(text: string): boolean {
  return (
    blobHas(JUNK_PATTERNS, text) ||
    isSellerOrPlanText(text) ||
    isExhibitNotPurchase(text) ||
    isWallTradeNotArt(text) ||
    isArtistSaleEvent(text)
  )
}

export function isProcurementSourceUrl(raw?: string | null): boolean {
  const url = normalizeCommercialSourceUrl(raw) || String(raw || '')
  if (TENDER_LISTING_URL.test(url)) return false
  return PROCUREMENT_URL.test(url)
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

function failsSharedRejects(combined: string, url: string): boolean {
  if (isExhibitNotPurchase(combined)) return true
  if (isArtistSaleEvent(combined)) return true
  if (LISTING_OR_EMPTY_URL.test(url)) return true
  if (SOCIAL_SHALLOW_URL.test(url)) return true
  if (JOB_BOARD_URL.test(url)) return true
  if (MARKETPLACE_URL.test(url)) return true
  if (ARTIST_BLOG_OR_FICTION_URL.test(url)) return true
  if (STALE_PUBLIC_URL.test(url)) return true
  if (TENDER_LISTING_URL.test(url)) return true
  if (hasStalePlanYear(combined)) return true
  if (isSellerOrPlanText(combined)) return true
  if (isWallTradeNotArt(combined)) return true
  if (blobHas(JUNK_PATTERNS, combined)) return true
  return false
}

export function shouldSkipSearchResult(title: string, snippet: string, url: string): boolean {
  const normalizedUrl = normalizeCommercialSourceUrl(url) || url
  const combined = `${title}\n${snippet}\n${normalizedUrl}`
  if (failsSharedRejects(combined, normalizedUrl)) return true

  const strongBuyer = hasStrongBuyerSignal(`${title}\n${snippet}`)
  const procurement = isProcurementSourceUrl(normalizedUrl) && hasArtPurchaseObject(combined)
  if (isTalentNotBuyer(combined) && !strongBuyer && !procurement) return true
  if (procurement) return false
  if (strongBuyer && hasArtPurchaseObject(combined) && !isArtistSaleEvent(combined)) return false
  if (hasDemandSignal(combined) && hasArtPurchaseObject(combined) && !isTalentNotBuyer(combined)) {
    return false
  }
  return true
}

export function isRealBuyerRequest(input: CommercialDemandInput): boolean {
  const combined = blobOf(input)
  if (!combined.trim()) return false
  const url = normalizeCommercialSourceUrl(input.source_url) || String(input.source_url || '')
  if (isDeadlineInPast(input.deadline)) return false
  if (failsSharedRejects(combined, url)) return false

  const strongBuyer = hasStrongBuyerSignal(combined)
  const artObject = hasArtPurchaseObject(combined)
  const procurement = isProcurementSourceUrl(url) && artObject

  if (isArtistSaleEvent(combined)) return false
  if (isTalentNotBuyer(combined) && !strongBuyer && !procurement) return false
  if (procurement) return true
  if (strongBuyer && artObject) return true
  if (hasDemandSignal(combined) && artObject && !isTalentNotBuyer(combined)) return true
  return false
}
