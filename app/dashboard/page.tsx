'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '../../components/TelegramConnect'
import NotificationsModal, { NotificationItem } from '../../components/NotificationsModal'

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
  const [userName, setUserName] = useState('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [matchedOpportunities, setMatchedOpportunities] = useState<Opportunity[]>([])
  const [dailyOpportunities, setDailyOpportunities] = useState<Opportunity[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) {
        setLoading(false)
        return
      }

      // 1. Профіль
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return

      const userProfile = profile as UserProfile | null
      if (userProfile?.full_name) setUserName(userProfile.full_name)
      setUserObj({
        id: user.id,
        telegram_chat_id: userProfile?.telegram_chat_id || null,
      })

      // 2. Активні можливості
      const nowISO = new Date().toISOString()
      const tenDaysAgoISO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('is_active', true)
        .gte('created_at', tenDaysAgoISO)
        .or(`deadline.gte.${nowISO},deadline.is.null`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Помилка завантаження opportunities:', error)
        setLoading(false)
        return
      }

      const allOpps = (opportunities || []) as Opportunity[]
      setTotalCount(allOpps.length)

      // 3. Фільтрація
      if (userProfile) {
        const userCountries = parseArrayField(userProfile.search_countries)
        const userTechniques = parseArrayField(userProfile.techniques)
        const orgFeeMax = Number(userProfile.org_fee_max || userProfile.max_fee_amount) || 0

        const matched = allOpps.filter((opp) => {
          // Країна
          if (userCountries.length > 0 && opp.country) {
            const oppCountry = String(opp.country).toLowerCase()
            const countryMatch = userCountries.some(
              (c) => oppCountry.includes(c) || c.includes(oppCountry)
            )
            const isGlobal =
              oppCountry.includes('онлайн') ||
              oppCountry.includes('світ') ||
              oppCountry.includes('international') ||
              oppCountry.includes('україна') ||
              oppCountry.includes('ukraine')

            if (!countryMatch && !isGlobal) return false
          }

          // Техніки
          if (userTechniques.length > 0 && opp.techniques) {
            const oppTechs = parseArrayField(opp.techniques)
            if (oppTechs.length > 0) {
              const techMatch = userTechniques.some((ut) =>
                oppTechs.some((ot) => ot.includes(ut) || ut.includes(ot))
              )
              if (!techMatch) return false
            }
          }

          // Вартість
          const fee = Number(opp.cost_amount || opp.fee_amount || opp.org_fee) || 0
          if (fee > orgFeeMax && orgFeeMax > 0 && !opp.is_free) return false

          return true
        })

        // Сортуємо за дедлайном
        matched.sort((a, b) => {
          const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity
          const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity
          return dateA - dateB
        })

        setMatchedOpportunities(matched)
        // Виводимо актуальні підібрані можливості (наприклад, перші 10 найближчих або всі збіги)
        setDailyOpportunities(matched)
      } else {
        setMatchedOpportunities(allOpps)
        setDailyOpportunities(allOpps)
      }

      setLoading(false)
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  const modalNotifications: NotificationItem[] = matchedOpportunities.map((opp) => ({
    id: opp.id,
    title: opp.title,
    description: opp.raw_description || opp.description || '',
    created_at: opp.created_at || new Date().toISOString(),
    link_url: opp.source_url || opp.link || opp.link_url || opp.url || undefined,
  }))

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
        
        {/* Шапка */}
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
              padding: '10px 14px', 
              cursor: 'pointer', 
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            🔔
            {dailyOpportunities.length > 0 && (
              <span style={{ 
                position: 'absolute', 
                top: -4, 
                right: -4, 
                background: '#3b82f6', 
                color: 'white', 
                fontSize: 10, 
                fontWeight: 'bold', 
                padding: '2px 6px', 
                borderRadius: '50%' 
              }}>
                {dailyOpportunities.length}
              </span>
            )}
          </button>
        </div>

        {userObj && <TelegramConnect user={userObj} />}

        {/* Блок знайдених можливостей */}
        <div 
          onClick={() => !loading && dailyOpportunities.length > 0 && setIsModalOpen(true)}
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
              : dailyOpportunities.length > 0
              ? `Знайдено ${dailyOpportunities.length} актуальних можливостей під ваш профіль!`
              : 'Немає нових можливостей.'}
          </p>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Усього збережено матеріалів у базі за останні 10 днів: {totalCount}
          </p>
        </div>

        {/* Кнопка Центр можливостей */}
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
          📂 Центр можливостей ({matchedOpportunities.length})
        </button>

        {/* Кнопка Мій профіль */}
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

        {/* Брендинг */}
        <div style={{ textAlign: 'center', marginTop: 32, borderTop: '1px solid #1e293b', paddingTop: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, letterSpacing: '1px' }}>POVODYR</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#94a3b8' }}>
            Ви створюєте картини. POVODYR допомагає їм знайти шлях.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <img 
              src="/icon-192" 
              alt="public/icon-192" 
              style={{ width: 120, height: 'auto', borderRadius: 16, border: '1px solid #334155' }}
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
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
