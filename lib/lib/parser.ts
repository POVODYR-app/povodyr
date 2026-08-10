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

export async function fetchFromApprovedSources(): Promise<ParsedOpportunity[]> {
  const { data: sources } = await supabase
    .from('sources')
    .select('*')
    .eq('active', true)

  const opportunities: ParsedOpportunity[] = []

  if (!sources || sources.length === 0) {
    return opportunities
  }

  return opportunities
}
