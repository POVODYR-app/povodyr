export type PersonalizedOpportunity = {
  opportunity: any
  score: number
  reasons: string[]
}

function toArray(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((i) => String(i).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((i) => String(i).trim()).filter(Boolean)
      }
    } catch {
      // fall through
    }
    return trimmed
      .split(/[,;|/]/)
      .map((i) => i.trim())
      .filter(Boolean)
  }
  return []
}

function norm(value: any): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueNorm(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const n = norm(value)
    if (!n || seen.has(n)) continue
    seen.add(n)
    result.push(n)
  }
  return result
}

function hasOverlap(a: string[], b: string[]): string[] {
  const hits: string[] = []
  for (const left of a) {
    for (const right of b) {
      if (left === right || left.includes(right) || right.includes(left)) {
        hits.push(right)
      }
    }
  }
  return uniqueNorm(hits)
}

function isGlobalCountry(country: string): boolean {
  return (
    country.includes('онлайн') ||
    country.includes('online') ||
    country.includes('світ') ||
    country.includes('world') ||
    country.includes('international') ||
    country.includes('worldwide') ||
    country.includes('europe') ||
    country.includes('європ') ||
    country.includes('eu') ||
    country.includes('all countries')
  )
}

function isUkraineFriendly(value: string): boolean {
  return (
    value.includes('україн') ||
    value.includes('ukraine') ||
    value.includes('ua') ||
    isGlobalCountry(value)
  )
}

function detectCurrency(opp: any): 'UAH' | 'EUR' | 'USD' {
  const raw = norm(opp.cost_currency || opp.fee_currency || opp.currency || '')
  if (raw.includes('uah') || raw.includes('грн') || raw.includes('гривн')) return 'UAH'
  if (raw.includes('usd') || raw.includes('дол')) return 'USD'
  return 'EUR'
}

function userFeeLimit(profile: any, opp: any): number {
  const currency = detectCurrency(opp)
  const typeText = norm(`${opp.type || ''} ${opp.category || ''} ${opp.title || ''}`)
  const isContest =
    typeText.includes('contest') ||
    typeText.includes('конкурс') ||
    typeText.includes('award') ||
    typeText.includes('prize')

  if (isContest) {
    if (currency === 'UAH') return Number(profile.fee_contest_uah ?? profile.reg_fee_max ?? 0) || 0
    if (currency === 'USD') return Number(profile.fee_contest_usd ?? profile.reg_fee_max ?? 0) || 0
    return Number(profile.fee_contest_eur ?? profile.reg_fee_max ?? 0) || 0
  }

  if (currency === 'UAH') {
    return Number(profile.fee_exhibition_uah ?? profile.org_fee_max ?? profile.max_fee_amount ?? 0) || 0
  }
  if (currency === 'USD') {
    return Number(profile.fee_exhibition_usd ?? profile.org_fee_max ?? profile.max_fee_amount ?? 0) || 0
  }
  return Number(profile.fee_exhibition_eur ?? profile.org_fee_max ?? profile.max_fee_amount ?? 0) || 0
}

function profileCountries(profile: any): string[] {
  return uniqueNorm([
    ...toArray(profile.search_countries),
    ...toArray(profile.target_countries),
    ...toArray(profile.country),
  ])
}

function profileTechniques(profile: any): string[] {
  return uniqueNorm([
    ...toArray(profile.profile_techniques),
    ...toArray(profile.techniques),
  ])
}

function profileGenres(profile: any): string[] {
  return uniqueNorm([
    ...toArray(profile.genres),
    ...toArray(profile.artistic_styles),
    ...toArray(profile.themes),
  ])
}

function profileLanguages(profile: any): string[] {
  return uniqueNorm([...toArray(profile.languages), ...toArray(profile.preferred_languages)])
}

function profileTypes(profile: any): string[] {
  return uniqueNorm(toArray(profile.preferred_opportunity_types))
}

function opportunityCountries(opp: any): string[] {
  return uniqueNorm([
    ...toArray(opp.country),
    ...toArray(opp.eligible_countries),
  ])
}

function opportunityTechniques(opp: any): string[] {
  return uniqueNorm([...toArray(opp.techniques), ...toArray(opp.preferred_techniques)])
}

function opportunityGenres(opp: any): string[] {
  return uniqueNorm([...toArray(opp.genres), ...toArray(opp.themes), ...toArray(opp.styles)])
}

function opportunityLevels(opp: any): string[] {
  return uniqueNorm([...toArray(opp.artist_levels), ...toArray(opp.required_level)])
}

function opportunityLanguages(opp: any): string[] {
  return uniqueNorm(toArray(opp.languages))
}

function ukrainiansAllowed(opp: any): boolean {
  if (opp.ukrainians_eligible === false || opp.accepts_ukrainians === false) return false
  const blob = norm(`${opp.title || ''} ${opp.description || ''} ${opp.raw_description || ''}`)
  if (
    blob.includes('ukrainians not eligible') ||
    blob.includes('ukraine not eligible') ||
    blob.includes('українці не можуть')
  ) {
    return false
  }
  return true
}

function isExpired(opp: any): boolean {
  if (!opp.deadline) return false
  const deadline = new Date(opp.deadline)
  if (Number.isNaN(deadline.getTime())) return false
  return deadline.getTime() < Date.now() - 12 * 60 * 60 * 1000
}

const ART_FINE_NATION_URL = 'https://sites.google.com/view/artfinenation/open-call'

function isArtFineNationOpportunity(opp: any): boolean {
  if (!opp) return false
  const url = norm(`${opp.source_url || ''} ${opp.link || ''} ${opp.link_url || ''}`)
  const name = norm(`${opp.source_name || ''} ${opp.title || ''}`)
  return (
    url.includes('sites.google.com/view/artfinenation') ||
    name.includes('art fine nation') ||
    name.includes('artfinenation')
  )
}

function profileHasUkraine(profile: any): boolean {
  const blob = norm(
    [
      ...toArray(profile?.search_countries),
      ...toArray(profile?.target_countries),
      ...toArray(profile?.country),
      profile?.residency_country || '',
      profile?.citizenship || '',
    ].join(' ')
  )
  return (
    blob.includes('україн') ||
    blob.includes('ukraine') ||
    blob.includes('україна') ||
    /(^|[^a-zа-яіїєґ])ua([^a-zа-яіїєґ]|$)/.test(blob)
  )
}

function forceArtFineNationForUkraine(
  profile: any,
  opportunities: any[],
  ranked: PersonalizedOpportunity[]
): PersonalizedOpportunity[] {
  if (!profileHasUkraine(profile)) return ranked

  let afnOpp: any = null
  const source = opportunities || []
  for (let i = 0; i < source.length; i += 1) {
    const opp = source[i]
    if (!isArtFineNationOpportunity(opp)) continue
    if (opp.is_active === false) continue
    if (isExpired(opp)) continue
    afnOpp = opp
    break
  }
  if (!afnOpp) return ranked

  const existingIndex = ranked.findIndex(
    (item) =>
      isArtFineNationOpportunity(item.opportunity) ||
      (item.opportunity?.id && afnOpp.id && item.opportunity.id === afnOpp.id)
  )

  const forced: PersonalizedOpportunity = {
    opportunity: existingIndex >= 0 ? ranked[existingIndex].opportunity : afnOpp,
    score: 99,
    reasons: ['Гарантоване джерело для України: Art Fine Nation'],
  }

  if (existingIndex >= 0) {
    const current = ranked[existingIndex]
    forced.opportunity = current.opportunity
    forced.reasons = Array.from(
      new Set(['Гарантоване джерело для України: Art Fine Nation', ...current.reasons])
    )
    ranked.splice(existingIndex, 1)
  }

  ranked.unshift(forced)
  return ranked
}

export function scoreOpportunityForUser(profile: any, opp: any): PersonalizedOpportunity | null {
  if (!opp) return null
  if (opp.is_active === false) return null
  if (isExpired(opp)) return null
  if (!ukrainiansAllowed(opp)) return null

  const userCountries = profileCountries(profile)
  const userTechs = profileTechniques(profile)
  const userGenres = profileGenres(profile)
  const userLangs = profileLanguages(profile)
  const userTypes = profileTypes(profile)
  const userLevel = norm(profile.artist_level || profile.professional_level)

  const oppCountries = opportunityCountries(opp)
  const oppTechs = opportunityTechniques(opp)
  const oppGenres = opportunityGenres(opp)
  const oppLangs = opportunityLanguages(opp)
  const oppLevels = opportunityLevels(opp)
  const oppType = norm(opp.type || opp.category || '')

  if (userCountries.length > 0 && oppCountries.length > 0) {
    const countryHits = hasOverlap(userCountries, oppCountries)
    const global = oppCountries.some(isGlobalCountry)
    const userWantsUkraineOrWorld = userCountries.some(isUkraineFriendly)
    if (countryHits.length === 0 && !global && !userWantsUkraineOrWorld) {
      return null
    }
  }

  const fee = Number(opp.cost_amount ?? opp.fee_amount ?? opp.org_fee ?? opp.reg_fee ?? 0) || 0
  const isFree = opp.is_free === true || fee === 0
  const maxFee = userFeeLimit(profile, opp)
  if (!isFree && maxFee > 0 && fee > maxFee) return null

    const isAfn = isArtFineNationOpportunity(opp)

  if (!isAfn && userTechs.length > 0 && oppTechs.length > 0) {
    const techHits = hasOverlap(userTechs, oppTechs)
    if (techHits.length === 0) return null
  }

  if (!isAfn && userLevel && oppLevels.length > 0) {
    const levelHits = hasOverlap([userLevel], oppLevels)
    const openLevel = oppLevels.some((l) => l.includes('open') || l.includes('any') || l.includes('всі') || l.includes('будь'))
    if (levelHits.length === 0 && !openLevel) return null
  }

  let score = 40
  const reasons: string[] = []

  const countryHits = hasOverlap(userCountries, oppCountries)
  if (countryHits.length > 0) {
    score += 18
    reasons.push(`Країна: ${opp.country || countryHits[0]}`)
  } else if (oppCountries.some(isGlobalCountry) || oppCountries.length === 0) {
    score += 10
    reasons.push('Міжнародний / відкритий формат')
  }

  const techHits = hasOverlap(userTechs, oppTechs)
  if (techHits.length > 0) {
    score += 20
    reasons.push(`Техніки: ${techHits.slice(0, 3).join(', ')}`)
  } else if (oppTechs.length === 0) {
    score += 6
  }

  const genreHits = hasOverlap(userGenres, oppGenres)
  if (genreHits.length > 0) {
    score += 10
    reasons.push('Збіг жанру / тематики')
  }

  if (userTypes.length > 0 && oppType && userTypes.some((t) => oppType.includes(t) || t.includes(oppType))) {
    score += 10
    reasons.push(`Тип: ${opp.type || opp.category}`)
  }

  if (userLevel && oppLevels.length > 0 && hasOverlap([userLevel], oppLevels).length > 0) {
    score += 8
    reasons.push('Відповідає професійному рівню')
  }

  const langHits = hasOverlap(userLangs, oppLangs)
  if (langHits.length > 0) {
    score += 6
  }

  if (isFree) {
    score += 8
    reasons.push('Безкоштовна участь')
  } else if (maxFee > 0 && fee > 0 && fee <= maxFee) {
    score += 4
    reasons.push(`Внесок у вашому ліміті: ${fee}`)
  }

  if (reasons.length === 0) {
    reasons.push('Загальна відповідність профілю')
  }

  return {
    opportunity: opp,
    score: Math.max(0, Math.min(99, score)),
    reasons,
  }
}

export function personalizeOpportunities(
  profile: any,
  opportunities: any[],
  options?: { minScore?: number; limit?: number }
): PersonalizedOpportunity[] {
  const minScore = options?.minScore ?? 48
  const limit = options?.limit ?? 20
  const list = opportunities || []

  const ranked = list
    .map((opp) => scoreOpportunityForUser(profile, opp))
    .filter((item): item is PersonalizedOpportunity => !!item && item.score >= minScore)
    .sort((a, b) => b.score - a.score)

  const withGuaranteedAfn = forceArtFineNationForUkraine(profile, list, ranked)
  return withGuaranteedAfn.slice(0, limit)
}
