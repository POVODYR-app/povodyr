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
    search_countries: ['Україна'] as string[],
    techniques: [] as string[],
    notifications_enabled: true,
    country: 'Україна',
    city: '',
    // Бюджети
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

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

   
