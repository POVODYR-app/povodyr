'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '../../components/TelegramConnect'
import NotificationsModal, { NotificationItem } from '../components/NotificationsModal'

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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
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

  // Мапимо можливості у формат, який приймає компонент NotificationsModal
  const modalNotifications: NotificationItem[] = matchedOpportunities.map(opp => ({
    id: opp.id,
    title: opp.title,
    description: opp.description || opp.raw_description || '',
    created_at: opp.created_at || new Date().toISOString(),
    link_url: opp.link_url || opp.source_url || opp.link || opp.url,
    source_name: opp.source_name,
  }))

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0f172a', color: 'white', padding: '20px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Вітаємо{userName ? `, ${userName}` : ''}!</h1>
        
        {userObj && <TelegramConnect user={userObj} />}

        <div 
          onClick={() => setIsModalOpen(true)} 
          style={{ 
            backgroundColor: matchedOpportunities.length > 0 ? '#1e3a8a' : '#1e293b', 
            border: '1px solid #334155', 
            borderRadius: 16, 
            padding: 16, 
            marginBottom: 20, 
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {matchedOpportunities.length > 0 
              ? `Знайдено можливостей за вашими фільтрами: ${matchedOpportunities.length} (з ${totalOpportunitiesCount} загальних)` 
              : `Немає можливостей за вашими поточними фільтрами (всього в базі: ${totalOpportunitiesCount}). Натисніть, щоб переглянути.`}
          </p>
        </div>

        <NotificationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          notifications={modalNotifications}
          title="Центр можливостей"
        />
      </div>
    </div>
  )
}
