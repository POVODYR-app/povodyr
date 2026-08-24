export interface ArtistProfile {
  name: string;
  country: string;
  city: string;
  artistic_styles: string[];
  techniques: string[];
  materials: string[];
  themes: string[];
  series: string[];
  professional_level: string;
  target_countries: string[];
  preferred_opportunity_types: string[];
  excluded_opportunities?: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  type: string;
  organizer?: string;
  country?: string;
  eligible_countries: string[];
  deadline: string;
  fee: number;
  currency: string;
  techniques: string[];
  themes: string[];
  required_level?: string;
  description?: string;
  source_url?: string;
  source_name?: string;
}

export interface MatchResult {
  score: number;
  reasons: string[];
  recommendedAction: string;
  isEligible: boolean;
}

export function calculateMatch(profile: ArtistProfile, opp: Opportunity): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Перевірка географічної доступності
  const isCountryAllowed = 
    !opp.eligible_countries || 
    opp.eligible_countries.length === 0 || 
    opp.eligible_countries.includes(profile.country) || 
    opp.eligible_countries.includes('Worldwide') ||
    opp.eligible_countries.includes('International');

  if (!isCountryAllowed) {
    return {
      score: 0,
      reasons: ["Ваша країна проживання не відповідає вимогам організаторів."],
      recommendedAction: "Пропустити цю можливість.",
      isEligible: false
    };
  } else {
    score += 20;
    reasons.push(`✓ Українські художники (${profile.country}) мають повне право на подачу заявки.`);
  }

  // 2. Збіг технік
  const matchingTechniques = opp.techniques.filter(t => 
    profile.techniques.some(pt => pt.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(pt.toLowerCase()))
  );
  
  if (matchingTechniques.length > 0) {
    score += 25;
    reasons.push(`✓ Ваша техніка (${matchingTechniques.join(', ')}) повністю відповідає вимогам Open Call.`);
  } else if (opp.techniques.length === 0) {
    score += 15;
    reasons.push(`✓ Організатори приймають широкий спектр технік.`);
  } else {
    reasons.push(`⚠ Техніки у вимогах дещо відрізняються від вашого основного портфоліо.`);
  }

  // 3. Тематична відповідність
  const matchingThemes = opp.themes.filter(th => 
    profile.themes.some(pth => pth.toLowerCase().includes(th.toLowerCase()) || th.toLowerCase().includes(pth.toLowerCase()))
  );

  if (matchingThemes.length > 0 || opp.themes.length === 0) {
    score += 20;
    reasons.push(`✓ Тематика та серія робіт («${profile.series[0] || 'Ваші роботи'}») відповідають вашій практиці.`);
  }

  // 4. Рівень досвіду
  if (!opp.required_level || opp.required_level === profile.professional_level || profile.professional_level.includes('Established')) {
    score += 20;
    reasons.push(`✓ Рівень конкурсу (${opp.required_level || 'Open'}) повністю відповідає вашому професійному досвіду.`);
  } else {
    score += 10;
  }

  // 5. Фінансові умови
  if (opp.fee === 0) {
    score += 15;
    reasons.push(`✓ Участь у події безкоштовна (fee: 0), що відповідає вашим критеріям відбору.`);
  } else {
    score += 5;
    reasons.push(`⚠ Наявний організаційний внесок: ${opp.fee} ${opp.currency}.`);
  }

  const finalScore = Math.min(score, 100);

  let recommendedAction = "Подати заявку згідно з портфоліо";
  if (finalScore >= 85) {
    recommendedAction = `Подати 3 роботи із серії «${profile.series[0] || 'Ваші роботи'}» та підготувати оновлений artist statement.`;
  } else if (finalScore >= 60) {
    recommendedAction = "Ретельно перевірити умови подачі та адаптувати опис проєкту.";
  } else {
    recommendedAction = "Зберегти в архіві або пропустити.";
  }

  return {
    score: finalScore,
    reasons,
    recommendedAction,
    isEligible: true
  };
}
