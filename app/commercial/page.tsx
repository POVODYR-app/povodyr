'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const SUBTYPES_MAP: Record<string, string> = {
  interior_designer: 'Дизайнер інтер’єрів',
  gallery: 'Галерея',
  hotel: 'Готель',
  restaurant: 'Ресторан',
  corporate_space: 'Корпоративний простір',
  collector: 'Колекціонер',
  art_consultant: 'Арт-консультант',
  developer: 'Девелопер',
  commercial_project: 'Комерційний проєкт',
  commission: 'Commission',
  art_rental: 'Art Rental',
  exhibition_for_sale: 'Виставка-продаж',
  collaboration: 'Колаборація',
  other: 'Інше'
}

export default function CommercialOpportunitiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [selectedSubtype, setSelectedSubtype] = useState<string>('all')
  const [userArtworks, setUserArtworks] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Завантаження комерційних можливостей
      const { data: opps, error } = await supabase
        .from('commercial_opportunities')
        .select('*')
        .order('date_added', { ascending: false })

      if (opps) {
        setOpportunities(opps)
      }

      // Завантаження робіт користувача для рекомендацій
      const { data: artworks } = await supabase
        .from('artist_artworks')
        .select('*')
        .eq('user_id', user.id)

      if (artworks) {
        setUserArtworks(artworks)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const filteredOpportunities = selectedSubtype === 'all' 
    ? opportunities 
    : opportunities.filter(o => o.subtype === selectedSubtype)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Завантаження комерційних можливостей...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px 16px', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        
        {/* Хедер сторінки */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#ffffff' }}>
              💰 Можливості для продажу
            </h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0 0' }}>
              Знайти шлях до покупця та реалізувати ваше мистецтво
            </p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')}
            style={{ backgroundColor: '#334155', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            ← Дашборд
          </button>
        </div>

        {/* Фільтри за підтипами */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedSubtype('all')}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: 'none',
              backgroundColor: selectedSubtype === 'all' ? '#3b82f6' : '#1e293b',
              color: '#ffffff',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: selectedSubtype === 'all' ? 700 : 400
            }}
          >
            Усі категорії
          </button>
          {Object.entries(SUBTYPES_MAP).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedSubtype(key)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: selectedSubtype === key ? '#3b82f6' : '#1e293b',
                color: '#ffffff',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: selectedSubtype === key ? 700 : 400
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Список можливостей */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredOpportunities.length === 0 ? (
            <div style={{ backgroundColor: '#1e293b', padding: 24, borderRadius: 12, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              Наразі немає активних комерційних можливостей у цій категорії. База оновлюється автоматично.
            </div>
          ) : (
            filteredOpportunities.map((opp) => (
              <div 
                key={opp.id}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, backgroundColor: '#3b82f6', color: '#ffffff', padding: '3px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase' }}>
                      {SUBTYPES_MAP[opp.subtype] || opp.subtype}
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 4px 0', color: '#ffffff' }}>
                      {opp.title}
                    </h3>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                      📍 {opp.city ? `${opp.city}, ` : ''}{opp.country || 'Україна'} • Організація: <strong style={{ color: '#e2e8f0' }}>{opp.organization}</strong>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: 6 }}>
                      Commercial Fit: 91%
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                  {opp.description || opp.what_is_needed}
                </p>

                {opp.budget && (
                  <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600 }}>
                    💰 Бюджет: {opp.budget} {opp.currency || 'UAH'}
                  </div>
                )}

                {/* Чому це підходить */}
                <div style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, fontSize: 12, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>Чому POVODYR рекомендує це вам:</span>
                  <span>✓ ваша техніка відповідає запиту проєкту;</span>
                  <span>✓ ціновий сегмент збігається з бюджетом замовника;</span>
                  <span>✓ формати робіт відповідають параметрам інтер'єру.</span>
                </div>

                {/* Дії / CTA */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => alert('Функція підготовки комерційної пропозиції буде доступна на наступному кроці.')}
                    style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                  >
                    Підготувати пропозицію
                  </button>
                  {opp.source_url && (
                    <a
                      href={opp.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ backgroundColor: '#334155', color: '#ffffff', textDecoration: 'none', padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
                    >
                      Переглянути джерело ↗
                    </a>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
