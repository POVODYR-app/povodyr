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
  const [loading, setLoading] = useState(true)

  const [dailyCount, setDailyCount] = useState<number>(0)
  const [monthlyMatchedCount, setMonthlyMatchedCount] = useState<number>(0)
  const [upcomingDeadlinesCount, setUpcomingDeadlinesCount] = useState<number>(0)
  const [modalOpportunities, setModalOpportunities] = useState<NotificationItem[]>([])
  const [savedItemsForAlerts, setSavedItemsForAlerts] = useState<any[]>([])

  // Стейт для головного екрана з дедлайнами та перевіркою за 7 днів
  const [recentRelevantOpps, setRecentRelevantOpps] = useState<any[]>([])
  const [hasNoRecentRelevant, setHasNoRecentRelevant] = useState(false)

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
            const formattedOpps: NotificationItem[] = opps.map((opp: Opportunity) => {
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

            // Фільтрація релевантних за останні 7 днів для головного екрана з урахуванням порогу матчу (наприклад, > 30)
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

  // Функція для визначення індикатора дедлайну
  const getDeadlineBadge = (deadlineStr?: string) => {
    if (!deadlineStr) return { indicator: '🟢', label: 'Довгострокова можливість' }
    
    const deadlineDate = new Date(deadlineStr)
    const today = new Date()
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 7 && diffDays >= 0) {
      return { indicator: '🔴', label: `Дедлайн через ${diffDays} дн.` }
    } else if (diffDays > 7 && diffDays <= 30) {
      return { indicator: '🟡', label: `Дедлайн через ${diffDays} дн.` }
    } else if (diffDays < 0) {
      return { indicator: '⚪', label: 'Термін вийшов' }
    } else {
      return { indicator: '🟢', label: 'Довгострокова можливість' }
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

        {/* Блок згідно з вимогою: "Сьогодні POVODYR знайшов для вас" */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#f8fafc' }}>
            Сьогодні POVODYR знайшов для вас
          </h2>

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
                <button 
                  onClick={() => window.location.reload()} 
                  style={{ background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Залишити критерії без змін
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentRelevantOpps.slice(0, 3).map((opp) => {
                const badge = getDeadlineBadge(opp.deadline)
                return (
                  <div 
                    key={opp.id} 
                    onClick={() => setIsModalOpen(true)}
                    style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 14, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 6 }}>
                      <span title={badge.label} style={{ fontSize: '14px' }}>{badge.indicator}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>Match: {opp.matchScore}%</span>
                    </div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: '#fff' }}>{opp.title}</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {opp.description}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div 
          onClick={() => !loading && setIsModalOpen(true)}
          style={{ 
            backgroundColor: '#1e293b', 
            border: '1px solid #334155', 
            borderRadius: 16, 
            padding: 16, 
            marginBottom: 16, 
            cursor: loading ? 'default' : 'pointer',
            textAlign: 'center'
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {loading
              ? 'Завантаження можливостей...'
              : `Свіжі надходження за добу: ${dailyCount}`}
          </p>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            {loading ? '' : `Усього матеріалів у базі за останні 24 години: ${dailyCount}`}
          </p>
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
            marginBottom: 12, 
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          📂 Центр можливостей ({monthlyMatchedCount})
        </button>

        <button 
          onClick={() => window.location.href = '/profile'} 
          style={{ 
            width: '100%',
            backgroundColor: '#1e293b', 
            color: 'white',
            border: '1px solid #334155',
            borderRadius: 16, 
            padding: 16, 
            marginBottom: 24, 
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          ✏️ Мій профіль
        </button>

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
      </div>
    </div>
  )
}
