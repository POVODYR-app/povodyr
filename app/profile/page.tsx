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
  const [countries, setCountries] = useState<string[]>(['Україна', 'ЄС'])
  const [techniques, setTechniques] = useState<string[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Поля сум за регіонами та валютами
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
        
        if (profile.search_countries) {
          setCountries(Array.isArray(profile.search_countries) ? profile.search_countries : [])
        }
        if (profile.techniques) {
          setTechniques(Array.isArray(profile.techniques) ? profile.techniques : [])
        }

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
    return <div style={{ color: '#fff', padding: 20 }}>Завантаження...</div>
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Мій профіль</h1>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          ← Назад
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Повне ім'я */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Повне ім'я *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
          />
        </div>

        {/* Рівень митця */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Рівень митця *</label>
          <select
            value={artistLevel}
            onChange={(e) => setArtistLevel(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
          >
            <option value="вільний художник">вільний художник</option>
            <option value="початківець">початківець</option>
            <option value="професіонал">професіонал</option>
          </select>
        </div>

        {/* Країни пошуку */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Країни пошуку можливостей</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Україна', 'ЄС', 'США'].map((c) => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={countries.includes(c)}
                  onChange={() => handleCountryToggle(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        {/* Організаційні внески (виставки) */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 12, color: '#f8fafc' }}>
            Організаційний внесок (виставки)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Україна (UAH)</span>
              <input
                type="number"
                value={orgFeeUa}
                onChange={(e) => setOrgFeeUa(e.target.value)}
                style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>ЄС (EUR)</span>
              <input
                type="number"
                value={orgFeeEu}
                onChange={(e) => setOrgFeeEu(e.target.value)}
                style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>США (USD)</span>
              <input
                type="number"
                value={orgFeeUs}
                onChange={(e) => setOrgFeeUs(e.target.value)}
                style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
              />
            </div>
          </div>
        </div>

        {/* Реєстраційні внески (конкурси) */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 12, color: '#f8fafc' }}>
            Реєстраційний внесок (конкурси)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Україна (UAH)</span>
              <input
                type="number"
                value={regFeeUa}
                onChange={(e) => setRegFeeUa(e.target.value)}
                style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>ЄС (EUR)</span>
              <input
                type="number"
                value={regFeeEu}
                onChange={(e) => setRegFeeEu(e.target.value)}
                style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>США (USD)</span>
              <input
                type="number"
                value={regFeeUs}
                onChange={(e) => setRegFeeUs(e.target.value)}
                style={{ width: 120, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
              />
            </div>
          </div>
        </div>

        {/* Техніки */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Техніки *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TECHNIQUES_LIST.map((tech) => (
              <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={techniques.includes(tech)}
                  onChange={() => handleTechniqueToggle(tech)}
                />
                {tech}
              </label>
            ))}
          </div>
        </div>

        {/* Чекбокс сповіщень */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginTop: 6 }}>
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
          />
          Отримувати щоденні сповіщення від POVODYR
        </label>

        {/* Кнопка збереження */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: '#3b82f6',
            color: '#fff',
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
  )
}
