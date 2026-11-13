'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
const handleResetPassword = async () => {
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Введіть email, щоб надіслати посилання для відновлення')
      return
    }
    setLoading(true)
    setError(null)
    setResetSent(false)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (resetError) {
      setError('Не вдалося надіслати лист. Перевірте email.')
    } else {
      setResetSent(true)
    }
  }
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError('Невірний email або пароль')
      setLoading(false)
    } else if (data?.session) {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: '#0f172a',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#1e293b',
        padding: 24,
        borderRadius: 12,
        border: '1px solid #334155',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 }}>
          Вхід у POVODYR
        </h1>
{resetSent && (
          <div style={{
            padding: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            color: '#86efac',
            fontSize: 14,
            borderRadius: 6,
            textAlign: 'center',
            marginBottom: 16
          }}>
            Лист для відновлення пароля надіслано. Перевірте пошту.
          </div>
        )}
        {error && (
          <div style={{
            padding: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            color: '#fecaca',
            fontSize: 14,
            borderRadius: 6,
            textAlign: 'center',
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#cbd5e1' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoCapitalize="none"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 6,
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: 'white',
                fontSize: 16,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#cbd5e1' }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 6,
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: 'white',
                fontSize: 16,
                boxSizing: 'border-box'
              }}
            />
          </div>
<button
            type="button"
            onClick={handleResetPassword}
            disabled={loading}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#93c5fd',
              fontSize: 13,
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
              textDecoration: 'underline'
            }}
          >
            Забули пароль?
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 14,
              backgroundColor: loading ? '#1e40af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Завантаження...' : 'Увійти'}
          </button>
        </form>
      </div>
    </main>
  )
}
