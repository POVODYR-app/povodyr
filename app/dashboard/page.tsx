'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '../../components/TelegramConnect'
import NotificationsModal, { NotificationItem } from '../../components/NotificationsModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface MatchItem {
  id: string
  match_score: number
  reasons_uk: string[]
  potential_benefit: string
  application_complexity: string
  estimated_time: string
  opportunity: {
    id: string
    title: string
    description?: string | null
    raw_description?: string | null
    created_at: string
    deadline?: string | null
    source_url?: string | null
    link?: string | null
    country?: string | null
    type?: string | null
    is_free?: boolean | null
  }
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      setStatusMessage('Завантаження...')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profile?.full_name) setUserName(profile.full_name)
      setUserObj({ id: user.id, telegram_chat_id: profile?.telegram_chat_id || null })

      // Спочатку пробуємо готові матчі
      const { data: existingMatches } = await supabase
        .from('user_opportunity_matches')
        .select(`
          id,
          match_score,
          reasons_uk,
          potential_benefit,
          application_complexity,
          estimated_time,
          opportunity:opportunities (
            id, title, description, raw_description, created_at,
            deadline, source_url, link, country, type, is_free
          )
        `)
        .eq('user_id', user.id)
        .gte('match_score', 40)
        .order('match_score', { ascending: false })
        .limit(30)

      if (existingMatches && existingMatches.length > 0) {
        setMatches(existingMatches as any)
        setLoading(false)
        setStatusMessage('')
        return
      }

      // Якщо матчів немає — запускаємо AI
      setScoring(true)
      setStatusMessage('AI аналізує можливості під ваш профіль...')

      try {
        const res = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })

        const result = await res.json()

        if (result.success) {
          const { data: newMatches } = await supabase
            .from('user_opportunity_matches')
            .select(`
              id,
              match_score,
              reasons_uk,
              potential_benefit,
              application_complexity,
              estimated_time,
              opportunity:opportunities (
                id, title, description, raw_description, created_at,
                deadline, source_url, link, country, type, is_free
              )
            `)
            .eq('user_id', user.id)
            .gte('match_score', 40)
            .order('match_score', { ascending: false })
            .limit(30)

          if (isMounted) setMatches((newMatches as any) || [])
        } else {
          setStatusMessage(result.error || 'Помилка AI-скорингу')
        }
      } catch (err) {
        console.error(err)
        setStatusMessage('Не вдалося виконати AI-скоринг')
      } finally {
        if (isMounted) {
          setScoring(false)
          setLoading(false)
          setStatusMessage('')
        }
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [])

  const modalNotifications: NotificationItem[] = matches.map((m) => ({
    id: m.id,
    title: `[${m.match_score}%] ${m.opportunity?.title || 'Можливість'}`,
    description: [
      ...(m.reasons_uk || []).map((r) => `• ${r}`),
      m.potential_benefit ? `Користь: ${m.potential_benefit}` : '',
      m.estimated_time ? `Час підготовки: ${m.estimated_time}` : '',
      m.application_complexity ? `Складність: ${m.application_complexity}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    created_at: m.opportunity?.created_at || new Date().toISOString(),
    link_url: m.opportunity?.source_url || m.opportunity?.link || undefined,
  }))

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0f172a', color: 'white', padding: '20px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
          Вітаємо{userName ? `, ${userName}` : ''}!
        </h1>

        {userObj && <TelegramConnect user={userObj} />}

        <div
          onClick={() => !loading && !scoring && matches.length > 0 && setIsModalOpen(true)}
          style={{
            backgroundColor: matches.length > 0 ? '#1e3a8a' : '#1e293b',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            cursor: loading || scoring ? 'default' : 'pointer',
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {loading || scoring
              ? statusMessage || 'AI аналізує можливості...'
              : matches.length > 0
              ? `Знайдено ${matches.length} релевантних можливостей`
              : 'Немає релевантних можливостей за вашим профілем'}
          </p>
          {!loading && !scoring && matches.length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#93c5fd' }}>
              Найвищий Match Score: {matches[0]?.match_score}%
            </p>
          )}
        </div>

        <NotificationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          notifications={modalNotifications}
          title="Центр можливостей (AI Match Score)"
        />
      </div>
    </div>
  )
}
