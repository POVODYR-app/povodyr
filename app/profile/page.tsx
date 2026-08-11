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

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setArtistLevel(profile.artist_level || 'вільний художник')
        setNotificationsEnabled(profile.notifications_enabled ?? true)
        
        // Перевірка та приведення типів для масивів
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
      setLoading(false)
    }

    loadProfile()
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

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)

    const updates = {
      id: userId,
      full_name: fullName,
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
      router.push('/dashboard')
    } else {
      alert('Помилка збереження: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: 20 }}>
        Завантаження...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px 16px', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#ffffff' }}>Мій профіль</h1>
          <button 
            onClick={() => router.push('/dashboard')}
            style={{ backgroundColor: '#334155', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            ← Назад
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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

          {/* Організаційні внески (виставки) */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 12, color: '#ffffff' }}>
              Організаційний внесок (виставки)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>Україна (UAH)</span>
                <input
                  type="number"
                  value={orgFeeUa}
                  onChange={(e) => setOrgFeeUa(e.target.value)}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>ЄС (EUR)</span>
                <input
                  type="number"
                  value={orgFeeEu}
                  onChange={(e) => setOrgFeeEu(e.target.value)}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>США (USD)</span>
                <input
                  type="number"
                  value={orgFeeUs}
                  onChange={(e) => setOrgFeeUs(e.target.value)}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Реєстраційні внески (конкурси) */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 12, color: '#ffffff' }}>
              Реєстраційний внесок (конкурси)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>Україна (UAH)</span>
                <input
                  type="number"
                  value={regFeeUa}
                  onChange={(e) => setRegFeeUa(e.target.value)}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>ЄС (EUR)</span>
                <input
                  type="number"
                  value={regFeeEu}
                  onChange={(e) => setRegFeeEu(e.target.value)}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>США (USD)</span>
                <input
                  type="number"
                  value={regFeeUs}
                  onChange={(e) => setRegFeeUs(e.target.value)}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#ffffff', outline: 'none' }}
                />
              </div>
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
            {saving ? 'Збереження...' : 'Зберегти профіль'}
          </button>
        </div>
      </div>
    </div>
  )
}
