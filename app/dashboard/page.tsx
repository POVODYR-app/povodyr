'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '../../components/TelegramConnect'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Opportunity {
  id: string
  title: string
  description?: string | null
  created_at: string
  deadline?: string | null
  link_url?: string | null
  url?: string | null
  source_url?: string | null
  link?: string | null
  source_name?: string | null
  country?: string | null
  type?: string | null
  is_free?: boolean | null
  cost_amount?: number | string | null
  cost_currency?: string | null
  fee_amount?: number | string | null
  org_fee?: number | string | null
  genres?: any
  techniques?: any
  artist_levels?: any
  age_restrictions?: string | null
  languages?: any
  ukrainians_eligible?: boolean | null
  raw_description?: string | null
}

interface UserProfile {
  id: string
  full_name?: string | null
  telegram_chat_id?: string | null
  search_countries?: any
  techniques?: any
  org_fee_max?: number | string
  max_fee_amount?: number | string
}

function parseArrayField(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(i => String(i).toLowerCase().trim())
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(i => String(i).toLowerCase().trim())
    } catch {
      return raw.split(',').map(i => i.toLowerCase().trim()).filter(Boolean)
    }
  }
  return []
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false)

  const [activeModal, setActiveModal] = useState<'bell' | 'center' | null>(null)

  const [matchedOpportunities, setMatchedOpportunities] = useState<Opportunity[]>([])
  const [totalOpportunitiesCount, setTotalOpportunitiesCount] = useState<number>(0)

  useEffect(() => {
    let isMounted = true

    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone
    const bannerClosed = localStorage.getItem('povodyr_install_banner_closed')
    
    if (!bannerClosed && !isPWA) {
      setShowInstallBanner(true)
    }

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) return

      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const todayStr = new Date().toISOString().split('T')[0]

      const opportunitiesPromise = supabase
        .from('opportunities')
        .select('*')
        .eq('is_active', true)
        .or(`deadline.gte.${todayStr},deadline.is.null`)
        .order('created_at', { ascending: false })

      const [
        { data: profile },
        { data: opportunities }
      ] = await Promise.all([profilePromise, opportunitiesPromise])

      if (!isMounted) return

      const userProfile = profile as UserProfile | null

      if (userProfile?.full_name) {
        setUserName(userProfile.full_name)
      }

      setUserObj({
        id: user.id,
        telegram_chat_id: userProfile?.telegram_chat_id || null,
      })

      const allOpps = (opportunities || []) as Opportunity[]
      setTotalOpportunitiesCount(allOpps.length)

      if (userProfile) {
        const userCountries = parseArrayField(userProfile.search_countries)
        const userTechniques = parseArrayField(userProfile.techniques)
        const orgFeeMax = Number(userProfile.org_fee_max || userProfile.max_fee_amount) || 0

        const matched = allOpps.filter(opp => {
          if (userCountries.length > 0 && opp.country) {
            const oppCountry = String(opp.country).toLowerCase()
            const countryMatch = userCountries.some(c => oppCountry.includes(c) || c.includes(oppCountry))
            if (!countryMatch && !oppCountry.includes('онлайн') && !oppCountry.includes('світ') && !oppCountry.includes('international')) {
              return false
            }
          }

          if (userTechniques.length > 0 && opp.techniques) {
            const oppTechs = parseArrayField(opp.techniques)
            if (oppTechs.length > 0) {
              const techMatch = userTechniques.some(ut => oppTechs.some(ot => ot.includes(ut) || ut.includes(ot)))
              if (!techMatch) return false
            }
          }

          const fee = Number(opp.cost_amount || opp.fee_amount || opp.org_fee) || 0
          if (fee > orgFeeMax && orgFeeMax > 0 && !opp.is_free) return false

          return true
        })

        setMatchedOpportunities(matched)
      } else {
        setMatchedOpportunities(allOpps)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const closeInstallBanner = () => {
    setShowInstallBanner(false)
    localStorage.setItem('povodyr_install_banner_closed', 'true')
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA')
  }

  const formatMessageHtml = (msg?: string | null) => {
    if (!msg) return ''
    return msg.replace(
      /<a /g,
      '<a style="color: #60a5fa; text-decoration: underline;" target="_blank" rel="noopener noreferrer" '
    )
  }

  const recentNotifications = matchedOpportunities.slice(0, 5)

  const modalData = activeModal === 'bell' ? recentNotifications : matchedOpportunities
  const modalTitle = activeModal === 'bell' ? 'Останні сповіщення' : `Центр можливостей (${matchedOpportunities.length})`

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0f172a',
      color: 'white',
      padding: '20px 16px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {showInstallBanner && (
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            position: 'relative'
          }}>
            <button
              onClick={closeInstallBanner}
              style={{
                position: 'absolute',
                top: 10,
                right: 12,
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: 18,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 28 }}>📱</span>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700 }}>
                  Встановити POVODYR на телефон
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, opacity: 0.9 }}>
                  Додайте ярлик на робочий стіл, щоб відкривати як звичайний додаток.
                </p>

                <div style={{
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.5
                }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>Для iPhone (Safari):</p>
                  <ol style={{ margin: '0 0 10px 0', paddingLeft: 18 }}>
                    <li>Натисніть кнопку «Поділитися» внизу екрана</li>
                    <li>Оберіть «На екран “Додому”»</li>
                    <li>Натисніть «Додати»</li>
                  </ol>

                  <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Для Android (Chrome):</p>
                  <p style={{ margin: 0 }}>
                    Меню ⋮ → «Встановити додаток» або «Додати на головний екран»
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24
        }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            Вітаємо{userName ? `, ${userName}` : ''}!
          </h1>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveModal('bell')}
              style={{
                position: 'relative',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '8px 12px',
                color: 'white',
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              🔔
              {recentNotifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {recentNotifications.length}
                </span>
              )}
            </button>

            <a
              href="/profile"
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '8px 12px',
                color: 'white',
                fontSize: 14,
                textDecoration: 'none'
              }}
            >
              ✏️ Профіль
            </a>
          </div>
        </div>

        {userObj && <TelegramConnect user={userObj} />}

        <div 
          onClick={() => setActiveModal('center')}
          style={{
            backgroundColor: matchedOpportunities.length > 0 ? '#1e3a8a' : '#1e293b',
            border: matchedOpportunities.length > 0 ? '1px solid #3b82f6' : '1px solid #334155',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🔍</span>
            <p style={{ margin: 0, fontSize: 15, color: matchedOpportunities.length > 0 ? '#ffffff' : '#cbd5e1' }}>
              {matchedOpportunities.length > 0
                ? `Знайдено ${matchedOpportunities.length} актуальних можливостей під ваш профіль!`
                : 'Сьогодні нових можливостей немає. Пошук триває.'}
            </p>
          </div>
        </div>

        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
          Усього актуальних матеріалів у базі: {totalOpportunitiesCount}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setActiveModal('center')}
            style={{
              width: '100%',
              padding: 14,
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📋 Центр можливостей ({matchedOpportunities.length})
          </button>

          <a
            href="/profile"
            style={{
              width: '100%',
              padding: 14,
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 500,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block'
            }}
          >
            ✏️ Мій профіль
          </a>
        </div>

        <div style={{
          marginTop: 40,
          paddingTop: 24,
          borderTop: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          textAlign: 'center'
        }}>
          <div style={{ position: 'relative', width: 70, height: 70, borderRadius: 12, overflow: 'hidden' }}>
            <img 
              src="/icon-192.jpg" 
              alt="POVODYR Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <span style={{ 
              fontSize: 18, 
              fontWeight: 800, 
              letterSpacing: '0.08em', 
              color: '#ffffff',
              display: 'block' 
            }}>
              POVODYR
            </span>
            <span style={{ 
              fontSize: 12, 
              color: '#94a3b8',
              letterSpacing: '0.04em'
            }}>
              Ви створюєте картини. POVODYR допомагає їм знайти свій шлях
            </span>
          </div>
        </div>

      </div>

      {activeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: 16,
            width: '100%',
            maxWidth: 420,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #334155'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottom: '1px solid #334155'
            }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{modalTitle}</h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 20,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
              {modalData.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  Немає актуальних можливостей.
                </p>
              ) : (
                modalData.map((item) => {
                  const targetUrl = item.source_url || item.link_url || item.url || item.link
                  const displayDescription = item.description || item.raw_description

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 12
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                          {item.title}
                        </h3>
                        {item.source_name && (
                          <span style={{ fontSize: 10, padding: '2px 6px', backgroundColor: '#334155', borderRadius: 4, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {item.source_name}
                          </span>
                        )}
                      </div>
                      
                      {displayDescription && (
                        <div 
                          style={{ 
                            margin: '0 0 10px 0', 
                            fontSize: 13, 
                            color: '#cbd5e1',
                            whiteSpace: 'pre-line',
                            lineHeight: 1.5
                          }}
                          dangerouslySetInnerHTML={{ __html: formatMessageHtml(displayDescription) }}
                        />
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                        <span>
                          {item.deadline ? `Дедлайн: ${formatDate(item.deadline)}` : formatDate(item.created_at)}
                        </span>
                        
                        {targetUrl && !targetUrl.includes('/dashboard') ? (
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60a5fa', textDecoration: 'underline', fontWeight: 600 }}
                          >
                            Детальніше →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #334155' }}>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  width: '100%',
                  padding: 12,
                  backgroundColor: '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
