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

export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Нові стани для показників з API
  const [dailyCount, setDailyCount] = useState<number>(0)
  const [monthlyMatchedCount, setMonthlyMatchedCount] = useState<number>(0)
  const [upcomingDeadlinesCount, setUpcomingDeadlinesCount] = useState<number>(0)
  const [modalOpportunities, setModalOpportunities] = useState<Opportunity[]>([])

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) {
        setLoading(false)
        return
      }

      // 1. Завантажуємо профіль
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

      // 2. Отримуємо статистику з нового API /api/user-stats
      try {
        const res = await fetch(`/api/user-stats?user_id=${user.id}`)
        const json = await res.json()
        if (json.success && isMounted) {
          setDailyCount(json.daily_count || 0)
          setMonthlyMatchedCount(json.monthly_matched_count || 0)
          setUpcomingDeadlinesCount(json.upcoming_deadlines_count || 0)
          
          // Для Центру можливостей завантажимо також самі можливості за місяць
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const { data: opps } = await supabase
            .from('opportunities')
            .select('*')
            .eq('is_active', true)
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false })

          if (opps && isMounted) {
            setModalOpportunities(opps as Opportunity[])
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

  const notificationItems: NotificationItem[] = modalOpportunities.map((opp) => ({
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
            {upcomingDeadlinesCount > 0 && (
              <span style={{ 
                position: 'absolute', 
                top: -4, 
                right: -4, 
                background: '#ef4444', 
                color: 'white', 
                fontSize: 10, 
                fontWeight: 'bold', 
                padding: '2px 6px', 
                borderRadius: '50%' 
              }}>
                {upcomingDeadlinesCount}
              </span>
            )}
          </button>
        </div>

        {userObj && <TelegramConnect user={userObj} />}

        {/* Блок свіжих надходжень за добу */}
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

        {/* Кнопка Центр можливостей (за місяць) */}
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
          notifications={notificationItems}
          title="Центр можливостей"
        />
      </div>
    </div>
  )
}
