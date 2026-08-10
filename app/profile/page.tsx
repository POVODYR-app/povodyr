'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const [form, setForm] = useState({
    full_name: '',
    artist_level: 'початківець',
    search_countries: ['Україна'] as string[],
    techniques: [] as string[],
    notifications_enabled: true,
    org_fee_currency: 'UAH',
    org_fee_max: 0,
    reg_fee_currency: 'UAH',
    reg_fee_max: 0,
  })

  const artistLevels = [
    'початківець',
    'вільний художник',
    'професійний художник',
    'відомий художник'
  ]

  const countriesOptions = ['Україна', 'ЄС', 'США']
  const currencyOptions = ['UAH', 'EUR', 'USD']
  const techniquesOptions = [
    'Акрил', 'Олійний живопис', 'Графіка', 'Імпасто',
    'Колаж', 'Акварель', 'Пастель', 'Цифровий живопис', 'Змішана техніка'
  ]

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Спочатку увійдіть в акаунт')
      setLoading(false)
      return
    }

    setUserId(user.id)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      setForm({
        full_name: data.full_name || '',
        artist_level: data.artist_level || 'початківець',
        search_countries: data.search_countries || ['Україна'],
        techniques: Array.isArray(data.techniques)
          ? data.techniques
          : (data.techniques ? String(data.techniques).split(',').map((t: string) => t.trim()) : []),
        notifications_enabled: data.notifications_enabled ?? true,
        org_fee_currency: data.org_fee_currency || 'UAH',
        org_fee_max: data.org_fee_max || 0,
        reg_fee_currency: data.reg_fee_currency || 'UAH',
        reg_fee_max: data.reg_fee_max || 0,
      })
    }

    setLoading(false)
  }

  async function handleSave() {
    if (!userId) {
      setMessage('Помилка: користувач не авторизований')
      return
    }

    setSaving(true)
    setMessage('')

    const profileCompleted = !!(form.full_name && form.artist_level && form.techniques.length > 0)

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: form.full_name,
        artist_level: form.artist_level,
        search_countries: form.search_countries,
        techniques: form.techniques,
        notifications_enabled: form.notifications_enabled,
        org_fee_currency: form.org_fee_currency,
        org_fee_max: form.org_fee_max,
        reg_fee_currency: form.reg_fee_currency,
        reg_fee_max: form.reg_fee_max,
        profile_completed: profileCompleted,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (error) {
      console.error(error)
      setMessage('Помилка збереження: ' + error.message)
    } else {
      setMessage(profileCompleted
        ? 'Профіль успішно збережено! Тепер ви отримуватимете сповіщення.'
        : 'Профіль збережено. Заповніть обовʼязкові поля для отримання сповіщень.')
    }

    setSaving(false)
  }

  function toggleCountry(country: string) {
    setForm(prev => ({
      ...prev,
      search_countries: prev.search_countries.includes(country)
        ? prev.search_countries.filter(c => c !== country)
        : [...prev.search_countries, country]
    }))
  }

  function toggleTechnique(tech: string) {
    setForm(prev => ({
      ...prev,
      techniques: prev.techniques.includes(tech)
        ? prev.techniques.filter(t => t !== tech)
        : [...prev.techniques, tech]
    }))
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        backgroundColor: '#0f172a',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif'
      }}>
        Завантаження...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0f172a',
      color: 'white',
      padding: '24px 16px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Мій профіль</h1>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 14px',
              color: 'white',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            ← Назад
          </button>
        </div>

        {/* Ім'я */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
            Повне ім'я *
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: 'white',
              fontSize: 15,
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Рівень митця */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
            Рівень митця *
          </label>
          <select
            value={form.artist_level}
            onChange={e => setForm({ ...form, artist_level: e.target.value })}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: 'white',
              fontSize: 15
            }}
          >
            {artistLevels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        {/* Країни пошуку */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Країни пошуку можливостей
          </label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {countriesOptions.map(country => (
              <label key={country} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.search_countries.includes(country)}
                  onChange={() => toggleCountry(country)}
                />
                {country}
              </label>
            ))}
          </div>
        </div>

        {/* Організаційний внесок */}
        <div style={{
          marginBottom: 16,
          padding: 14,
          border: '1px solid #334155',
          borderRadius: 10,
          backgroundColor: '#1e293b'
        }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Організаційний внесок (виставки)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={form.org_fee_currency}
              onChange={e => setForm({ ...form, org_fee_currency: e.target.value })}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: 'white'
              }}
            >
              {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              value={form.org_fee_max}
              onChange={e => setForm({ ...form, org_fee_max: Number(e.target.value) })}
              placeholder="до ..."
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: 'white'
              }}
            />
          </div>
        </div>

        {/* Реєстраційний внесок */}
        <div style={{
          marginBottom: 20,
          padding: 14,
          border: '1px solid #334155',
          borderRadius: 10,
          backgroundColor: '#1e293b'
        }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Реєстраційний внесок (конкурси)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={form.reg_fee_currency}
              onChange={e => setForm({ ...form, reg_fee_currency: e.target.value })}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: 'white'
              }}
            >
              {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              value={form.reg_fee_max}
              onChange={e => setForm({ ...form, reg_fee_max: Number(e.target.value) })}
              placeholder="до ..."
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #475569',
                backgroundColor: '#0f172a',
                color: 'white'
              }}
            />
          </div>
        </div>

        {/* Техніки */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Техніки *
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {techniquesOptions.map(tech => (
              <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.techniques.includes(tech)}
                  onChange={() => toggleTechnique(tech)}
                />
                {tech}
              </label>
            ))}
          </div>
        </div>

        {/* Сповіщення */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={form.notifications_enabled}
              onChange={e => setForm({ ...form, notifications_enabled: e.target.checked })}
            />
            Отримувати щоденні сповіщення від POVODYR
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: 15,
            backgroundColor: saving ? '#1e40af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Збереження...' : 'Зберегти профіль'}
        </button>

        {message && (
          <p style={{
            marginTop: 18,
            padding: 12,
            borderRadius: 8,
            backgroundColor: message.includes('Помилка') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            color: message.includes('Помилка') ? '#fca5a5' : '#86efac',
            fontSize: 14
          }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
