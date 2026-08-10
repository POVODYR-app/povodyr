'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    artist_level: 'початківець',
    search_countries: ['Україна'],
    budget_currency: 'UAH',
    budget_max: 0,
    techniques: [] as string[],
    notifications_enabled: true,
    country: 'Україна',
    city: '',
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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setForm({
        full_name: data.full_name || '',
        artist_level: data.artist_level || 'початківець',
        search_countries: data.search_countries || ['Україна'],
        budget_currency: data.budget_currency || 'UAH',
        budget_max: data.budget_max || 0,
        techniques: data.techniques ? (Array.isArray(data.techniques) ? data.techniques : data.techniques.split(',').map((t: string) => t.trim())) : [],
        notifications_enabled: data.notifications_enabled ?? true,
        country: data.country || 'Україна',
        city: data.city || '',
      })
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage('Помилка: користувач не авторизований')
      setSaving(false)
      return
    }

    const profileCompleted = !!(form.full_name && form.artist_level && form.techniques.length > 0)

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: form.full_name,
        artist_level: form.artist_level,
        search_countries: form.search_countries,
        budget_currency: form.budget_currency,
        budget_max: form.budget_max,
        techniques: form.techniques,
        notifications_enabled: form.notifications_enabled,
        country: form.country,
        city: form.city,
        profile_completed: profileCompleted,
        updated_at: new Date().toISOString()
      })

    if (error) {
      setMessage('Помилка збереження: ' + error.message)
    } else {
      setMessage(profileCompleted 
        ? 'Профіль збережено! Тепер ви будете отримувати сповіщення.' 
        : 'Профіль збережено. Заповніть обовʼязкові поля, щоб отримувати сповіщення.')
    }
    setSaving(false)
  }

  function toggleCountry(country: string) {
    setForm(prev => {
      const exists = prev.search_countries.includes(country)
      return {
        ...prev,
        search_countries: exists 
          ? prev.search_countries.filter(c => c !== country)
          : [...prev.search_countries, country]
      }
    })
  }

  function toggleTechnique(tech: string) {
    setForm(prev => {
      const exists = prev.techniques.includes(tech)
      return {
        ...prev,
        techniques: exists 
          ? prev.techniques.filter(t => t !== tech)
          : [...prev.techniques, tech]
      }
    })
  }

  if (loading) return <div style={{ padding: 40 }}>Завантаження...</div>

  return (
    <main style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: 30 }}>Мій профіль</h1>

      {/* Ім'я */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Повне ім'я *</label>
        <input
          type="text"
          value={form.full_name}
          onChange={e => setForm({ ...form, full_name: e.target.value })}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
        />
      </div>

      {/* Рівень митця */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Рівень митця *</label>
        <select
          value={form.artist_level}
          onChange={e => setForm({ ...form, artist_level: e.target.value })}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
        >
          {artistLevels.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      {/* Країни пошуку */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Країни пошуку можливостей</label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {countriesOptions.map(country => (
            <label key={country} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

      {/* Бюджет */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Максимальний бюджет (реєстраційний/організаційний внесок)</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={form.budget_currency}
            onChange={e => setForm({ ...form, budget_currency: e.target.value })}
            style={{ padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
          >
            {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            value={form.budget_max}
            onChange={e => setForm({ ...form, budget_max: Number(e.target.value) })}
            placeholder="до ..."
            style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
      </div>

      {/* Техніки */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Техніки *</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {techniquesOptions.map(tech => (
            <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <div style={{ marginBottom: 30 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
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
          padding: 14,
          backgroundColor: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          cursor: 'pointer'
        }}
      >
        {saving ? 'Збереження...' : 'Зберегти профіль'}
      </button>

      {message && (
        <p style={{ marginTop: 20, color: message.includes('Помилка') ? 'red' : 'green' }}>
          {message}
        </p>
      )}
    </main>
  )
}
