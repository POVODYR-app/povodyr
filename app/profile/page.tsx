'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const TECHNIQUES_LIST = [
  'Акрил', 'Олійний живопис', 'Графіка', 'Імпасто', 
  'Колаж', 'Акварель', 'Пастель', 'Цифровий живопис', 'Змішана техніка'
]

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [artistLevel, setArtistLevel] = useState('вільний художник')
  const [countries, setCountries] = useState<string[]>([])
  const [techniques, setTechniques] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [orgFeeUa, setOrgFeeUa] = useState<number | string>(0)
  const [orgFeeEu, setOrgFeeEu] = useState<number | string>(0)
  const [orgFeeUs, setOrgFeeUs] = useState<number | string>(0)

  const [regFeeUa, setRegFeeUa] = useState<number | string>(0)
  const [regFeeEu, setRegFeeEu] = useState<number | string>(0)
  const [regFeeUs, setRegFeeUs] = useState<number | string>(0)

  // Стан для робіт портфоліо (таблиця artist_artworks)
  const [artworks, setArtworks] = useState<any[]>([])
  const [newArtTitle, setNewArtTitle] = useState('')
  const [newArtTechnique, setNewArtTechnique] = useState('Акрил')
  const [newArtFormat, setNewArtFormat] = useState('')

  useEffect(() => {
    async function loadProfileAndArtworks() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      // Завантаження профілю
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setBio(profile.bio || '')
        setArtistLevel(profile.artist_level || 'вільний художник')
        setNotificationsEnabled(profile.notifications_enabled ?? true)
        
        let parsedCountries: string[] = []
        if (Array.isArray(profile.search_countries)) {
          parsedCountries = profile.search_countries
        } else if (typeof profile.search_countries === 'string') {
          try {
            parsedCountries = JSON.parse(profile.search_countries)
          } catch {
            parsedCountries = profile.search_countries.split(',').map((s: string) => s.trim())
          }
        }
        setCountries(parsedCountries)

        let parsedTechniques: string[] = []
        if (Array.isArray(profile.techniques)) {
          parsedTechniques = profile.techniques
        } else if (typeof profile.techniques === 'string') {
          try {
            parsedTechniques = JSON.parse(profile.techniques)
          } catch {
            parsedTechniques = profile.techniques.split(',').map((s: string) => s.trim())
          }
        }
        setTechniques(parsedTechniques)

        setOrgFeeUa(profile.org_fee_ua ?? 0)
        setOrgFeeEu(profile.org_fee_eu ?? 0)
        setOrgFeeUs(profile.org_fee_us ?? 0)

        setRegFeeUa(profile.reg_fee_ua ?? 0)
        setRegFeeEu(profile.reg_fee_eu ?? 0)
        setRegFeeUs(profile.reg_fee_us ?? 0)
      }

      // Завантаження робіт митця з таблиці artist_artworks
      const { data: works } = await supabase
        .from('artist_artworks')
        .select('*')
        .eq('user_id', user.id)
      
      if (works) {
        setArtworks(works)
      }

      setLoading(false)
    }

    loadProfileAndArtworks()
  }, [router])

  const handleCountryToggle = (country: string) => {
    setCountries(prev => 
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    )
  }

  const handleTechniqueToggle = (tech: string) => {
    setTechniques(prev => 
      prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
    )
  }

  // Додавання нової картини в artist_artworks
  const handleAddArtwork = async () => {
    if (!newArtTitle.trim() || !userId) return

    const { data, error } = await supabase
      .from('artist_artworks')
      .insert({
        user_id: userId,
        title: newArtTitle.trim(),
        technique: newArtTechnique,
        format_size: newArtFormat.trim() || 'Стандартний формат'
      })
      .select()

    if (!error && data) {
      setArtworks([...artworks, data[0]])
      setNewArtTitle('')
      setNewArtFormat('')
    } else {
      alert('Помилка додавання твору: ' + error?.message)
    }
  }

  // Видалення твору
  const handleDeleteArtwork = async (artId: string) => {
    const { error } = await supabase
      .from('artist_artworks')
      .delete()
      .eq('id', artId)

    if (!error) {
      setArtworks(artworks.filter(a => a.id !== artId))
    } else {
      alert('Помилка видалення: ' + error.message)
    }
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)

    const updates = {
      id: userId,
      full_name: fullName,
      bio: bio,
      artist_level: artistLevel,
      search_countries: countries,
      techniques: techniques,
      notifications_enabled: notificationsEnabled,
      org_fee_ua: Number(orgFeeUa) || 0,
      org_fee_eu: Number(orgFeeEu) || 0,
      org_fee_us: Number(orgFeeUs) || 0,
      reg_fee_ua: Number(regFeeUa) || 0,
      reg_fee_eu: Number(regFeeEu) || 0,
      reg_fee_us: Number(regFeeUs) || 0,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(updates)

    setSaving(false)
    if (!error) {
      window.location.href = '/dashboard'
    } else {
      alert('Помилка збереження профілю: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: 20 }}>
        Завантаження профілю та портфоліо...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px 16px', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#ffffff' }}>Мій профіль та портфоліо</h1>
          <button 
            onClick={() => { window.location.href = '/dashboard' }}
            style={{ backgroundColor: '#334155', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            ← Назад
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Повне ім'я */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#ffffff' }}>
              Повне ім'я *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#ffffff', outline: 'none' }}
            />
          </div>

          {/* Біографія / CV митця */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#ffffff' }}>
              Біографія та опис стилю (CV / Bio)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="Опишіть ваш творчий шлях, стиль та концепцію (напр. авторський стиль солярісм...)"
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#ffffff', outline: 'none', resize: 'vertical', fontFamily: 'sans-serif' }}
            />
          </div>

          {/* БЛОК ПОРТФОЛІО (artist_artworks) */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#ffffff' }}>
              🎨 Портфоліо робіт для комерційного підбору
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Додайте картини, які система пропонуватиме під час генерації пропозицій для готелів, дизайнерів та колекціонерів.
            </p>

            {/* Список існуючих робіт */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {artworks.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: 8 }}>
                  У вашому портфоліо поки немає доданих робіт.
                </div>
              ) : (
                artworks.map((art) => (
                  <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>«{art.title}»</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{art.technique} • {art.format_size}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteArtwork(art.id)}
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      Видалити
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Форма додавання нової роботи */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Додати новий твір:</span>
              <input
                type="text"
                placeholder="Назва картини (напр. Березова Катедрала)"
                value={newArtTitle}
                onChange={(e) => setNewArtTitle(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={newArtTechnique}
                  onChange={(e) => setNewArtTechnique(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                >
                  {TECHNIQUES_LIST.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Формат (напр. 80х100 см)"
                  value={newArtFormat}
                  onChange={(e) => setNewArtFormat(e.target.value)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none', fontSize: 13 }}
                />
              </div>
              <button
                onClick={handleAddArtwork}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginTop: 4 }}
              >
                + Додати роботу в портфоліо
              </button>
            </div>
          </div>

          {/* Рівень митця */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#ffffff' }}>
              Рівень митця *
            </label>
            <select
              value={artistLevel}
              onChange={(e) => setArtistLevel(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#ffffff', outline: 'none' }}
            >
              <option value="вільний художник" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>вільний художник</option>
              <option value="початківець" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>початківець</option>
              <option value="професіонал" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>професіонал</option>
            </select>
          </div>

          {/* Країни пошуку */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ffffff' }}>
              Країни пошуку можливостей
            </label>
            <div style={{ display: 'flex', gap: 16 }}>
              {['Україна', 'ЄС', 'США'].map((c) => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={countries.includes(c)}
                    onChange={() => handleCountryToggle(c)}
                  />
                  <span style={{ color: '#ffffff', fontSize: 14 }}>{c}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Техніки */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ffffff' }}>
              Техніки *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TECHNIQUES_LIST.map((tech) => (
                <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={techniques.includes(tech)}
                    onChange={() => handleTechniqueToggle(tech)}
                  />
                  <span style={{ color: '#ffffff', fontSize: 13 }}>{tech}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Чекбокс сповіщень */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 6 }}>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
            />
            <span style={{ color: '#ffffff', fontSize: 14 }}>Отримувати щоденні сповіщення від POVODYR</span>
          </label>

          {/* Кнопка збереження */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontWeight: 700,
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              cursor: 'pointer',
              marginTop: 10
            }}
          >
            {saving ? 'Збереження...' : 'Зберегти профіль та портфоліо'}
          </button>
        </div>
      </div>
    </div>
  )
}
