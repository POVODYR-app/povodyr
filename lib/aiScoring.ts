export interface AIScoreOutput {
  match_score: number
  why_recommended: string
  potential_benefit: string
  submission_complexity: string
  estimated_prep_time: string
}

// Функція для відсіювання інформаційних новин (призначення, річниці, звіти тощо)
export function isOpportunityRelevant(opp: any): boolean {
  const textToAnalyze = `${opp.title || ''} ${opp.raw_description || opp.description || ''}`.toLowerCase()

  const informationalStopWords = [
    'board member', 'appointed', 'anniversary', 'welcomes', 'interview', 
    'conference report', 'goodbye', 'spotlight on', 'review', 'recap',
    'прес-реліз', 'звіт', 'річниця', 'призначено', 'співробітник'
  ]

  if (informationalStopWords.some(word => textToAnalyze.includes(word))) {
    return false
  }

  const validKeywords = [
    'open call', 'opencall', 'call for artists', 'grant', 'grants', 
    'residency', 'residencies', 'award', 'prize', 'submission', 
    'конкурс', 'грант', 'резиденція', 'виставка', 'пленер', 'заявка'
  ]

  const hasValidIntent = validKeywords.some(word => textToAnalyze.includes(word))
  return hasValidIntent
}

export function evaluateMatch(profile: any, opp: any): AIScoreOutput | null {
  // Відсіюємо інформаційні пости перед будь-яким скорингом
  if (!isOpportunityRelevant(opp)) return null

  if (opp.ukrainians_eligible === false) return null

  const countries: string[] = profile.search_countries || []
  if (countries.length > 0 && opp.country && !countries.includes(opp.country)) {
    return null
  }

  const userTechs: string[] = profile.techniques || []
  const oppTechs: string[] = opp.techniques || []
  const hasTechMatch = userTechs.some(t => oppTechs.includes(t))
  
  if (userTechs.length > 0 && oppTechs.length > 0 && !hasTechMatch) {
    return null
  }

  if (!opp.is_free) {
    if (opp.opportunity_type === 'Open Call' && opp.cost_amount > (profile.org_fee_max || 0)) return null
    if (opp.opportunity_type === 'Contest' && opp.cost_amount > (profile.reg_fee_max || 0)) return null
  }

  let score = 65

  if (opp.is_free) score += 15
  if (opp.artist_levels?.includes(profile.artist_level)) score += 10
  if (hasTechMatch) score += 10

  const finalScore = Math.min(score, 100)

  return {
    match_score: finalScore,
    why_recommended: `Відповідає вашій техніці (${userTechs.filter(t => oppTechs.includes(t)).join(', ') || 'Загальна'}) та обраній країні (${opp.country}).`,
    potential_benefit: opp.opportunity_type === 'Grant'
      ? 'Пряме фінансування та покриття витрат.'
      : 'Професійна репрезентація та портфоліо.',
    submission_complexity: opp.opportunity_type === 'Grant' ? 'Висока' : 'Середня',
    estimated_prep_time: opp.opportunity_type === 'Grant' ? '3–5 днів' : '2–4 години'
  }
}
