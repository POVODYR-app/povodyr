export interface ArtistProfile {
  name?: string
  country?: string
  city?: string
  artistic_styles?: string[]
  techniques?: string[]
  materials?: string[]
  themes?: string[]
  series?: string[]
  professional_level?: string
  target_countries?: string[]
  preferred_opportunity_types?: string[]
}

export interface Opportunity {
  id: string
  title: string
  type?: string
  eligible_countries?: string[]
  deadline?: string
  fee?: number
  currency?: string
  techniques?: string[]
  themes?: string[]
  required_level?: string
}

export interface MatchResult {
  score: number
  reasons: string[]
  recommendedAction: string
}

export function calculateMatch(artist: ArtistProfile, opp: Opportunity): MatchResult {
  let score = 50 // Базовий рівень
  const reasons: string[] = []

  // 1. Перевірка типу можливості
  if (artist.preferred_opportunity_types && artist.preferred_opportunity_types.length > 0) {
    if (opp.type && artist.preferred_opportunity_types.includes(opp.type)) {
      score += 20
      reasons.push(`Тип події (${oppіTypeLabel(opp.type)}) відповідає вашим уподобанням.`)
    }
  }

  // 2. Перевірка географії / елліджибіліті
  if (opp.eligible_countries && Array.isArray(opp.eligible_countries)) {
    const isUkraineIncluded = opp.eligible_countries.some(c => 
      c.toLowerCase().includes('ukraine') || c.toLowerCase().includes('україна') || c.toLowerCase().includes('worldwide') || c.toLowerCase().includes(' міжнародн')
    )
    if (isUkraineIncluded) {
      score += 15
      reasons.push('Відкрито для учасників з України / Міжнародний формат.')
    }
  } else {
    score += 10
    reasons.push('Широкі географічні рамки участі.')
  }

  // 3. Перевірка технік та матеріалів
  if (opp.techniques && Array.isArray(opp.techniques) && artist.techniques) {
    const matchingTech = opp.techniques.filter(t => 
      artist.techniques?.some(at => at.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(at.toLowerCase()))
    )
    if (matchingTech.length > 0) {
      score += 15
      reasons.push(`Збіг за техніками виконання: ${matchingTech.join(', ')}.`)
    }
  }

  // 4. Перевірка тем
  if (opp.themes && Array.isArray(opp.themes) && artist.themes) {
    const matchingThemes = opp.themes.filter(th => 
      artist.themes?.some(ath => ath.toLowerCase().includes(th.toLowerCase()) || th.toLowerCase().includes(ath.toLowerCase()))
    )
    if (matchingThemes.length > 0) {
      score += 10
      reasons.push(`Тематичний фокус збігається з вашим портфоліо.`)
    }
  }

  // Нормалізація скору (максимум 98%)
  const finalScore = Math.min(Math.max(score, 45), 98)

  let recommendedAction = 'Рекомендовано до участі'
  if (finalScore >= 80) {
    recommendedAction = 'Високий пріоритет: ідеально підходить під ваш профіль'
  } else if (finalScore >= 65) {
    recommendedAction = 'Варто подати заявку'
  }

  return {
    score: finalScore,
    reasons: reasons.length > 0 ? reasons : ['Можливість відповідає загальному художньому профілю.'],
    recommendedAction,
  }
}

function oppіTypeLabel(type: string): string {
  const map: Record<string, string> = {
    exhibition: 'Виставка',
    open_call: 'Open Call',
    competition: 'Конкурс',
    residency: 'Резиденція',
    grant: 'Грант'
  }
  return map[type] || type
}
