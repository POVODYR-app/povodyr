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
  techniques?: any
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

      // Викликаємо нашу хмарну RPC-функцію з бази даних
      const opportunitiesPromise = supabase.rpc('get_active_opportunities')

      const [{ data: profile }, { data: opportunities }] = await Promise.all([profilePromise, opportunitiesPromise])

      if (!isMounted) return

      const userProfile = profile as UserProfile | null
      if (userProfile?.full_name) setUserName(userProfile.full_name)
      setUserObj({ id: user.id, telegram_chat_id: userProfile?.telegram_chat_id || null })

      const allOpps = (opportunities || []) as Opportunity[]
      setTotalOpportunitiesCount(allOpps.length)

      if (userProfile) {
        const userCountries = parseArrayField(userProfile.search_countries)
        const userTechniques = parseArrayField(userProfile.techniques)
        const orgFeeMax = Number(userProfile.org_fee_max || userProfile.max_fee_amount) || 0

        const matched = allOpps.filter(opp => {
          const oppCountry = String(opp.country || '').toLowerCase()
          const isGlobal = oppCountry.includes('онлайн') || oppCountry.includes('світ') || 
                           oppCountry.includes('international') || oppCountry.includes('україна')
          
          let countryMatch = isGlobal
          if (!isGlobal && userCountries.length > 0) {
            countryMatch = userCountries.some(c => oppCountry.includes(c) || c.includes(oppCountry))
          }

          let techMatch = true
          if (userTechniques.length > 0 && opp.techniques) {
            const oppTechs = parseArrayField(opp.techniques)
            techMatch = userTechniques.some(ut => oppTechs.some(ot => ot.includes(ut) || ut.includes(ot)))
          }

          const fee = Number(opp.cost_amount || opp.fee_amount || opp.org_fee) || 0
          const feeMatch = (opp.is_free || fee <= orgFeeMax || orgFeeMax === 0)

          return countryMatch && techMatch && feeMatch
        })

        matched.sort((a, b) => {
          const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity
          const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity
          return dateA - dateB
        })

        setMatchedOpportunities(matched)
      } else {
        setMatchedOpportunities(allOpps)
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [])

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA')
  }

  const formatMessageHtml = (msg?: string | null) => {
    if (!msg) return ''
    return msg.replace(/<a /g, '<a style="color: #60a5fa; text-decoration: underline;" target="_blank" rel="noopener noreferrer" ')
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0f172a', color: 'white', padding: '20px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Вітаємо{userName ? `, ${userName}` : ''}!</h1>
        
        {userObj && <TelegramConnect user={userObj} />}

        <div onClick={() => setActiveModal('center')} style={{ backgroundColor: matchedOpportunities.length > 0 ? '#1e3a8a' : '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 16, marginBottom: 20, cursor: 'pointer' }}>
          <p style={{ margin: 0, fontSize: 15 }}>{matchedOpportunities.length > 0 ? `Знайдено ${matchedOpportunities.length} можливостей!` : 'Немає нових можливостей.'}</p>
        </div>

        {activeModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid #334155' }}>
              <div style={{ padding: 16, borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Центр можливостей</h2>
                <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
                {matchedOpportunities.map((item) => (
                  <div key={item.id} style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: 15 }}>{item.title}</h3>
                      {item.source_name && <span style={{ fontSize: 10, padding: '2px 6px', backgroundColor: '#334155', borderRadius: 4, whiteSpace: 'nowrap' }}>{item.source_name}</span>}
                    </div>
                    {item.description && <div style={{ fontSize: 13, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: formatMessageHtml(item.description) }} />}
                    <div style={{ fontSize: 11, color: '#64748b' }}>{item.deadline ? `Дедлайн: ${formatDate(item.deadline)}` : 'Без терміну'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
