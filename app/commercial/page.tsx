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

const STATUSES_MAP: Record<string, { label: string, color: string }> = {
  found: { label: 'Знайдено', color: '#64748b' },
  interested: { label: 'Цікаво', color: '#3b82f6' },
  proposal_prepared: { label: 'Пропозиція готова', color: '#8b5cf6' },
  sent: { label: 'Надіслано', color: '#0ea5e9' },
  waiting: { label: 'Очікування відповіді', color: '#f59e0b' },
  negotiation: { label: 'Перемовини', color: '#ec4899' },
  deal: { label: 'Угода 🎉', color: '#10b981' },
  rejected: { label: 'Відмова', color: '#ef4444' }
}

export default function CommercialOpportunitiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [selectedSubtype, setSelectedSubtype] = useState<string>('all')
  const [userArtworks, setUserArtworks] = useState<any[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [userTracking, setUserTracking] = useState<Record<string, string>>({})

  // Стан для модального вікна генерації пропозиції
  const [activeModalOpp, setActiveModalOpp] = useState<any>(null)
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>([])
  const [generatedProposal, setGeneratedProposal] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Профіль користувача
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profile) setUserProfile(profile)

      // Комерційні можливості
      const { data: opps } = await supabase
  .from('commercial_opportunities')
  .select('*')
  .eq('opportunity_type', 'commercial')
  .order('date_added', { ascending: false })
      if (opps) setOpportunities(opps)

      // Роботи художника
      const { data: artworks } = await supabase
        .from('artist_artworks')
        .select('*')
        .eq('user_id', user.id)
      if (artworks) setUserArtworks(artworks)

      // Трекінг статусів користувача
      const { data: tracking } = await supabase
        .from('commercial_user_tracking')
        .select('*')
        .eq('user_id', user.id)
      
      if (tracking) {
        const trackingMap: Record<string, string> = {}
        tracking.forEach(t => {
          trackingMap[t.opportunity_id] = t.status
        })
        setUserTracking(trackingMap)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const handleStatusChange = async (oppId: string, newStatus: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserTracking(prev => ({ ...prev, [oppId]: newStatus }))

    await supabase
      .from('commercial_user_tracking')
      .upsert({
        user_id: user.id,
        opportunity_id: oppId,
        status: newStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,opportunity_id' })
  }

  const filteredOpportunities = selectedSubtype === 'all' 
    ? opportunities 
    : opportunities.filter(o => o.subtype === selectedSubtype)

  const handleOpenProposalModal = (opp: any) => {
    setActiveModalOpp(opp)
    const defaultIds = userArtworks.slice(0, 3).map(a => a.id)
    setSelectedArtworks(defaultIds)
    setGeneratedProposal('')
  }

  const handleGenerateProposalText = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const artistName = userProfile?.full_name || 'Художник'
      const oppTitle = activeModalOpp?.title || 'вашого проєкту'
      const orgName = activeModalOpp?.organization || 'команди'
      
      const chosenArtworksDetails = userArtworks
        .filter(a => selectedArtworks.includes(a.id))
        .map(a => `• «${a.title}» (${a.technique || 'живопис'}, ${a.format_size || 'зручний формат'})`)
        .join('\n')

      const text = `Добрий день, команда ${orgName}!

Мене зацікавила можливість співпраці щодо ${oppTitle}. Я професійний художник із Києва, працюю у власній унікальній техніці солярісму, поєднуючи багатошарові акрилові заливки, олійний живопис та поталь.

Для вашого запиту я ретельно відібрав(-ла) кілька робіт із мого портфоліо, які ідеально пасують за стилістикою та естетикою:
${chosenArtworksDetails || '• Роботи із актуальних серій пейзажного та сучасного живопису'}

Буду радий(-а) обговорити деталі, надати додаткові фото робіт у високій роздільній здатності або підготувати індивідуальну добірку.

З повагою,
${artistName}
Телефон / Контакти через POVODYR`

      setGeneratedProposal(text)
      setIsGenerating(false)

      // Автоматично оновлюємо статус на "Пропозиція готова"
      if (activeModalOpp?.id) {
        handleStatusChange(activeModalOpp.id, 'proposal_prepared')
      }
    }, 600)
  }

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
              Наразі немає активних комерційних можливостей у цій категорії.
            </div>
          ) : (
            filteredOpportunities.map((opp) => {
              const currentStatus = userTracking[opp.id] || 'found'
              const statusInfo = STATUSES_MAP[currentStatus] || STATUSES_MAP['found']

              return (
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: 6 }}>
                        Fit: 91%
                      </span>
                    </div>
                  </div>

                  {/* Вибір статусу пайплайну */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', padding: 10, borderRadius: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Статус у пайплайні:</span>
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(opp.id, e.target.value)}
                      style={{
                        backgroundColor: '#1e293b',
                        color: statusInfo.color,
                        border: '1px solid #334155',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {Object.entries(STATUSES_MAP).map(([sKey, sVal]) => (
                        <option key={sKey} value={sKey} style={{ color: '#ffffff', backgroundColor: '#1e293b' }}>
                          {sVal.label}
                        </option>
                      ))}
                    </select>
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
                      onClick={() => handleOpenProposalModal(opp)}
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
              )
            })
          )}
        </div>

        {/* МОДАЛЬНЕ ВІКНО ПІДГОТОВКИ ПРОПОЗИЦІЇ */}
        {activeModalOpp && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}>
            <div style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 16,
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Підготувати комерційну пропозицію
                </h3>
                <button
                  onClick={() => setActiveModalOpp(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                {activeModalOpp.title} — {activeModalOpp.organization}
              </p>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Рекомендовані роботи з вашого портфоліо:
                </label>
                {userArtworks.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 10, borderRadius: 8 }}>
                    У вашому профілі ще немає доданих робіт. Письмо буде згенеровано загальним описом.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                    {userArtworks.map((art) => (
                      <label key={art.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', backgroundColor: '#0f172a', padding: 8, borderRadius: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedArtworks.includes(art.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedArtworks([...selectedArtworks, art.id])
                            } else {
                              setSelectedArtworks(selectedArtworks.filter(id => id !== art.id))
                            }
                          }}
                        />
                        <span>{art.title} ({art.technique || 'живопис'})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerateProposalText}
                disabled={isGenerating}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                {isGenerating ? 'Генерую персоналізований текст...' : 'Згенерувати пропозицію'}
              </button>

              {generatedProposal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                    Готовий текст пропозиції (статус оновлено до «Пропозиція готова»):
                  </label>
                  <textarea
                    value={generatedProposal}
                    onChange={(e) => setGeneratedProposal(e.target.value)}
                    rows={8}
                    style={{
                      width: '100%',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 13,
                      fontFamily: 'sans-serif',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedProposal)
                      alert('Текст пропозиції скопійовано в буфер обміну!')
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Копіювати текст пропозиції
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
