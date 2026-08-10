import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ParsedOpportunity {
  source_name: string
  title: string
  link: string
  opportunity_type: string
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
    "Гранти для художників"
  ],
  en: [
    "Open call for artists",
    "Open call visual arts",
    "Open call painting exhibition",
    "Solo exhibition open call",
    "Artist residency programs",
    "Visual artist residency Europe",
    "Art grants for international artists"
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
  "#artistresidency"
]

export function buildSearchQueries(year: number = 2026): string[] {
  const queries: string[] = []
  SEARCH_KEYWORDS.en.forEach((keyword) => queries.push(`${keyword} ${year}`))
  SEARCH_KEYWORDS.ua.forEach((keyword) => queries.push(`${keyword} ${year}`))
  return queries
}

export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const opportunities: ParsedOpportunity[] = [
    {
      source_name: 'Art Fine Nation',
      title: 'Всеукраїнський Open Call: Сучасний український живопис та графіка 2026',
      link: 'https://artfinenation.com',
      opportunity_type: 'Open Call',
      deadline: '2026-11-01T00:00:00.000Z',
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
      raw_description: 'Пріоритетна програма підтримки сучасної української образотворчої практики та каталог проєктів Першої української мистецької агенції Art Fine Nation.',
    },
    {
      source_name: 'Res Artis',
      title: 'International Visual Artist Residency & Exhibition Grant 2026',
      link: 'https://www.resartis.org',
      opportunity_type: 'Residency',
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
      raw_description: 'Міжнародна резиденційна програма для митців у галузі візуального мистецтва та живопису з повним покриттям витрат на проживання та матеріали.',
    },
    {
      source_name: 'E-Flux Announcements',
      title: 'Global Fine Arts Award & Curatorial Platform Selection',
      link: 'https://www.e-flux.com',
      opportunity_type: 'Grant',
      deadline: '2026-10-30T00:00:00.000Z',
      country: 'International',
      is_free: true,
      cost_amount: 0,
      cost_currency: 'USD',
      genres: ['Fine Art', 'Contemporary Art'],
      techniques: [],
      artist_levels: ['Mid-Career', 'Established'],
      age_restrictions: 'None',
      languages: ['en'],
      ukrainians_eligible: true,
      raw_description: 'Грантова програма підтримки оригінальних мистецьких виставок та персональних експозицій.',
    }
  ]

  return opportunities
}
