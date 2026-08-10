export interface AIScoreOutput {
  match_score: number
  why_recommended: string
  potential_benefit: string
  submission_complexity: string
  estimated_prep_time: string
}

export function evaluateMatch(profile: any, opp: any): AIScoreOutput | null {
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
