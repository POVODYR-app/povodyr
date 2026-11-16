'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#ffffff', padding: 20 }}>Завантаження...</div>
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px 16px', color: '#ffffff' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <h1>Мій профіль</h1>
        <p>Відновлення профілю...</p>
        <button onClick={() => window.location.href = '/dashboard'} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}>← Назад</button>
      </div>
    </div>
  )
}
