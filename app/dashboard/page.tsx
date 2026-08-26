'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '../../components/TelegramConnect'
import NotificationsModal, { NotificationItem } from '../../components/NotificationsModal'
import FollowUpAlerts from '../../components/FollowUpAlerts'
import { calculateMatch, ArtistProfile, Opportunity as MatchOpportunity } from '../../lib/matchEngine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Opportunity {
  id: string
  title: string
  description?: string | null
  raw_description?: string | null
  created_at: string
  deadline?: string | null
  source_url?: string | null
  link?: string | null
  link_url?: string | null
  url?: string | null
  country?: string | null
  type?: string | null
  is_free?: boolean | null
  cost_amount?: number | string | null
  fee_amount?: number | string | null
  org_fee?: number | string | null
  techniques?: any
  genres?: any
  themes?: any
  eligible_countries?: any
  required_level?: string | null
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCommercialModalOpen, setIsCommercialModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [dailyCount, setDailyCount] = useState<number>(0)
  const [monthlyMatchedCount, setMonthlyMatchedCount] = useState<number>(0)
  const [upcomingDeadlinesCount, setUpcomingDeadlinesCount] = useState<number>(0)
  const [modalOpportunities, setModalOpportunities] = useState<any[]>([])
  const [savedItemsForAlerts, setSavedItemsForAlerts] = useState<any[]>([])

  const [recentRelevantOpps, setRecentRelevantOpps] = useState<any[]>([])
  const [hasNoRecentRelevant, setHasNoRecentRelevant] = useState(false)

  // Стейти для генерації пропозицій
  const [generatingProposalId, setGeneratingProposalId] = useState<string | null>(null)
  const [proposalModalData, setProposalModalData] = useState<{ title: string; text: string } | null>(null)

  // Стейт для розгортання деталей "Чому рекомендує" для кожної картки окремо за id
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) {
        setLoading(false)
        return
      }

      let artistProfileData: ArtistProfile = {
        name: 'Ванда Орлова',
        country: 'Україна',
        city: 'Київ',
        artistic_styles: ["Солярісм", "Сучасний станковий живопис"],
        techniques: ["Олія на полотні", "Мультишаровий акриловий живопис", "Мастихінова техніка", "Золота поталь"],
        materials: ["Полотно", "Олійні фарби", "Акрил", "Золота поталь"],
        themes: ["Українська культурна спадщина", "Флористика та ботанічні мотиви", "Плинність життя"],
        series: ["Квіткова спадщина", "Трояндовий рай", "Код Мазепи"],
        professional_level: "Professional / Established",
        target_countries: ["Україна", "Велика Британія", "Країни ЄС"],
        preferred_opportunity_types: ["exhibition", "open_call", "competition", "residency", "grant"]
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profile?.full_name) setUserName(profile.full_name)
      setUserObj({
        id: user.id,
        telegram_chat_id: profile?.telegram_chat_id || null,
      })

      const { data: artProfile } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (artProfile) {
        artistProfileData = {
          name: artProfile.name || artistProfileData.name,
          country: artProfile.country || artistProfileData.country,
          city: artProfile.city || artistProfileData.city,
          artistic_styles: artProfile.artistic_styles || artistProfileData.artistic_styles,
          techniques: artProfile.techniques || artistProfileData.techniques,
          materials: artProfile.materials || artistProfileData.materials,
          themes: artProfile.themes || artistProfileData.themes,
          series: artProfile.series || artistProfileData.series,
          professional_level: artProfile.professional_level || artistProfileData.professional_level,
          target_countries: artProfile.target_countries || artistProfileData.target_countries,
          preferred_opportunity_types: artProfile.preferred_opportunity_types || artistProfileData.preferred_opportunity_types,
        }
      }

      const { data: savedOpps } = await supabase
        .from('saved_opportunities')
        .select('*, opportunity:opportunities(*)')
        .eq('user_id', user.id)

      if (savedOpps && isMounted) {
        setSavedItemsForAlerts(savedOpps)
      }

      try {
        const res = await fetch(`/api/user-stats?user_id=${user.id}`)
        const json = await res.json()
        if (json.success && isMounted) {
          setDailyCount(json.daily_count || 0)
          setMonthlyMatchedCount(json.monthly_matched_count || 0)
          setUpcomingDeadlinesCount(json.upcoming_deadlines_count || 0)
          
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const { data: opps } = await supabase
            .from('opportunities')
            .select('*')
            .eq('is_active', true)
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false })

          if (opps && isMounted) {
            const formattedOpps = opps.map((opp: Opportunity) => {
              const mappedOpp: MatchOpportunity = {
                id: opp.id,
                title: opp.title,
                type: opp.type || 'open_call',
                eligible_countries: opp.eligible_countries || ['Україна', 'Worldwide'],
                deadline: opp.deadline || new Date().toISOString(),
                fee: Number(opp.fee_amount || opp.cost_amount || opp.org_fee || 0),
                currency: 'USD',
                techniques: Array.isArray(opp.techniques) ? opp.techniques : [],
                themes: Array.isArray(opp.themes) ? opp.themes : [],
                required_level: opp.required_level || undefined,
              }

              const match = calculateMatch(artistProfileData, mappedOpp)

              return {
                id: opp.id,
                title: opp.title,
                description: opp.raw_description || opp.description || '',
                created_at: opp.created_at || new Date().toISOString(),
                deadline: opp.deadline || undefined,
                link_url: opp.source_url || opp.link || opp.link_url || opp.url || undefined,
                matchScore: match.score,
                matchReasons: match.reasons,
                recommendedAction: match.recommendedAction,
              }
            })

            formattedOpps.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
            setModalOpportunities(formattedOpps)

            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
            const recentRelevant = formattedOpps.filter(o => {
              const isRecent = new Date(o.created_at).getTime() >= sevenDaysAgo
              const isRelevant = (o.matchScore || 0) >= 30
              return isRecent && isRelevant
            })

            if (recentRelevant.length === 0) {
              setHasNoRecentRelevant(true)
              setRecentRelevantOpps([])
            } else {
              setHasNoRecentRelevant(false)
              setRecentRelevantOpps(recentRelevant)
            }
          }
        }
      } catch (err) {
        console.error('Помилка завантаження статистики користувача:', err)
      }

      if (isMounted) setLoading(false)
    }

    loadDashboardData()
    return () => {
      isMounted = false
    }
  }, [])

  // Функція генерації пропозиції
  const handleGenerateProposal = async (opp: any) => {
    setGeneratingProposalId(opp.id)
    try {
      const res = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opp.id,
          opportunityTitle: opp.title,
          opportunityDescription: opp.description,
          matchReasons: opp.matchReasons,
        })
      })
      const data = await res.json()
      if (data.success) {
        setProposalModalData({
          title: `Пропозиція для: ${opp.title}`,
          text: data.proposalText
        })
      } else {
        alert('Не вдалося згенерувати пропозицію. Спробуйте ще раз.')
      }
    } catch (err) {
      console.error(err)
      alert('Помилка мережі при генерації пропозиції.')
    } finally {
      setGeneratingProposalId(null)
    }
  }

  // Функція для визначення дедлайну та точного підпису
  const getDeadlineDetails = (deadlineStr?: string) => {
    if (!deadlineStr) return { indicator: '🟢', label: 'Довгострокова можливість' }
    
    const deadlineDate = new Date(deadlineStr)
    const today = new Date()
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 7 && diffDays >= 0) {
      return { indicator: '🔴', label: `Дедлайн через ${diffDays} дн. (до 7 днів)` }
    } else if (diffDays > 7 && diffDays <= 30) {
      return { indicator: '🟡', label: `Дедлайн через ${diffDays} дн. (8–30 днів)` }
    } else if (diffDays < 0) {
      return { indicator: '⚪', label: 'Термін подачі вийшов' }
    } else {
      return { indicator: '🟢', label: `Дедлайн через ${diffDays} дн. (довгострокова)` }
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: '#0f172a',
        color: 'white',
        padding: '20px 16px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Вітаю{userName ? `, ${userName}` : ''}!
          </h1>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ 
              background: '#1e293b', 
              border: '1px solid #334155', 
              borderRadius: 12, 
              padding: '10px 16px', 
              cursor: 'pointer', 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <span>🔔</span>
            <span>{upcomingDeadlinesCount} DEADLINE</span>
          </button>
        </div>

        {userObj && <TelegramConnect user={userObj} />}

        <FollowUpAlerts savedItems={savedItemsForAlerts} />

        {/* --- ОСНОВНА НАВІГАЦІЯ --- */}

        {/* 1. Можливості / Розвиток кар'єри */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
            🧭 Можливості — Розвиток кар'єри
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            style={{ 
              width: '100%',
              backgroundColor: '#2563eb', 
              color: 'white',
              border: 'none',
              borderRadius: 16, 
              padding: 16, 
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            📂 Центр можливостей ({monthlyMatchedCount})
          </button>
        </div>

        {/* 2. Можливості для продажу / Знайти шлях до покупця */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#34d399' }}>
            💰 Можливості для продажу — Знайти шлях до покупця
          </div>
          <button 
            onClick={() => setIsCommercialModalOpen(true)} 
            style={{ 
              width: '100%',
              backgroundColor: '#059669', 
              color: 'white',
              border: 'none',
              borderRadius: 16, 
              padding: 16, 
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            🏷️ Комерційні можливості (Sales & B2B)
          </button>
        </div>

        {/* 3. ТОП-3 Рекомендації на сьогодні */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
            ✨ Сьогодні POVODYR знайшов для вас (Топ-3 найкращі)
          </div>

          {loading ? (
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 16, textAlign: 'center', color: '#94a3b8' }}>
              Завантаження можливостей...
            </div>
          ) : hasNoRecentRelevant ? (
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 16 }}>
                «Нових можливостей для вашого поточного профілю не знайдено. Хочете розширити критерії пошуку?»
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={() => window.location.href = '/profile'} 
                  style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Розширити географію
                </button>
                <button 
                  onClick={() => window.location.href = '/profile'} 
                  style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Розширити типи можливостей
                </button>
                <button 
                  onClick={() => window.location.href = '/profile'} 
                  style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Розширити тематику
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentRelevantOpps.slice(0, 3).map((opp) => {
                const deadlineInfo = getDeadlineDetails(opp.deadline)
                const isExpanded = expandedCardId === opp.id

                return (
                  <div 
                    key={opp.id} 
                    style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 14 }}
                  >
                    {/* Рядок статусу дедлайну */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 6, fontSize: '12px', color: '#cbd5e1' }}>
                      <span>{deadlineInfo.indicator}</span>
                      <span>{deadlineInfo.label}</span>
                    </div>

                    {/* Рядок відсотка відповідності з поясненням */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                        Match: {opp.matchScore}% (рівень персональної відповідності вашому профілю)
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: '#fff' }}>{opp.title}</h4>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {opp.description}
                    </p>

                    {/* Кнопка розгортання «Чому POVODYR рекомендує це мені?» */}
                    <button
                      onClick={() => setExpandedCardId(isExpanded ? null : opp.id)}
                      style={{
                        width: '100%',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '8px 12px',
                        color: '#38bdf8',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: '10px',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>Чому POVODYR рекомендує це мені?</span>
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Розгорнуті деталі рекомендації */}
                    {isExpanded && (
                      <div style={{ backgroundColor: '#0f172a', borderRadius: 8, padding: '10px', marginBottom: '10px', fontSize: '12px', color: '#e2e8f0', border: '1px solid #1e293b' }}>
                        <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#38bdf8' }}>Критерії збігу:</p>
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li>✓ техніка відповідає вимогам</li>
                          <li>✓ тематика відповідає вашій творчій практиці</li>
                          <li>✓ ви відповідаєте географічним вимогам</li>
                          <li>✓ рівень конкурсу відповідає вашому досвіду</li>
                          <li>✓ opportunity відповідає вашій професійній цілі</li>
                        </ul>
                        {opp.matchReasons && opp.matchReasons.length > 0 && (
                          <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '11px' }}>
                            Деталі: {opp.matchReasons.join('. ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Посилання на першоджерело */}
                    {opp.link_url && (
                      <a
                        href={opp.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          textDecoration: 'none',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textAlign: 'center',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        🔗 Перейти до першоджерела
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. Мої заявки (Перспективний блок / заглушка на майбутнє) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
            📋 Мої заявки — Відстежувати результат (Coming soon)
          </div>
          <button 
            disabled
            style={{ 
              width: '100%',
              backgroundColor: '#1e293b', 
              color: '#64748b',
              border: '1px solid #334155',
              borderRadius: 16, 
              padding: 16, 
              fontSize: 16,
              fontWeight: 600,
              cursor: 'not-allowed',
              textAlign: 'center'
            }}
          >
            📋 Мої заявки та результати
          </button>
        </div>

        {/* 5. Мій профіль / Налаштувати POVODYR */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
            👤 Мій профіль — Налаштувати POVODYR
          </div>
          <button 
            onClick={() => window.location.href = '/profile'} 
            style={{ 
              width: '100%',
              backgroundColor: '#1e293b', 
              color: 'white',
              border: '1px solid #334155',
              borderRadius: 16, 
              padding: 16, 
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            ✏️ Редагувати профіль та критерії
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, borderTop: '1px solid #1e293b', paddingTop: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, letterSpacing: '1px' }}>POVODYR</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#94a3b8' }}>
            Ви створюєте картини. POVODYR допомагає їм знайти шлях.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <img 
              src="/icon-192.jpg" 
              alt="POVODYR logo" 
              style={{ width: 60, height: 'auto', borderRadius: 12, border: '1px solid #334155' }}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        </div>

        <NotificationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          notifications={modalOpportunities}
          title="Центр можливостей"
        />

        {/* Модальне вікно Комерційних можливостей */}
        {isCommercialModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
          }}>
            <div style={{
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: 16, padding: 20, width: '100%', maxWidth: 440,
              maxHeight: '85dvh', overflowY: 'auto', color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#34d399' }}>💰 Комерційні можливості продажу</h3>
                <button 
                  onClick={() => setIsCommercialModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: 16 }}>
                Запити від інтер'єрних студій, готелів, галерей та приватних колекціонерів на придбання та розміщення картин.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {modalOpportunities.filter(o => o.matchScore && o.matchScore > 30).length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>Наразі немає активних комерційних запитів.</p>
                ) : (
                  modalOpportunities.filter(o => o.matchScore && o.matchScore > 30).slice(0, 5).map((opp: any) => (
                    <div key={opp.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '11px', color: '#38bdf8' }}>
                        <span>Match: {opp.matchScore}%</span>
                        <span>{opp.deadline ? `Дедлайн: ${opp.deadline.substring(0, 10)}` : 'Постійно'}</span>
                      </div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>{opp.title}</h4>
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{opp.description}</p>
                      
                      <button
                        onClick={() => handleGenerateProposal(opp)}
                        disabled={generatingProposalId === opp.id}
                        style={{
                          width: '100%',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {generatingProposalId === opp.id ? '⏳ Генерація пропозиції...' : '✍️ Підготувати пропозицію'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Модальне вікно предпросмотру згенерованої пропозиції */}
        {proposalModalData && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
          }}>
            <div style={{
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: 16, padding: 20, width: '100%', maxWidth: 400,
              maxHeight: '80dvh', overflowY: 'auto', color: '#fff'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#38bdf8' }}>{proposalModalData.title}</h3>
              <textarea
                readOnly
                value={proposalModalData.text}
                style={{
                  width: '100%', height: 200, backgroundColor: '#0f172a',
                  color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8,
                  padding: 10, fontSize: '13px', resize: 'none', boxSizing: 'border-box',
                  marginBottom: 12
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(proposalModalData.text)
                    alert('Текст скопійовано до буферу обміну!')
                  }}
                  style={{ flex: 1, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 600, cursor: 'pointer' }}
                >
                  📋 Скопіювати
                </button>
                <button
                  onClick={() => setProposalModalData(null)}
                  style={{ flex: 1, backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Закрити
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
