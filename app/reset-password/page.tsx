'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Пароль має бути щонайменше 6 символів')
      return
    }
    if (password !== confirm) {
      setError('Паролі не збігаються')
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError('Не вдалося змінити пароль. Спробуйте надіслати лист ще раз.')
    } else {
      setMessage('Пароль змінено. Зараз перейдете до входу.')
      setTimeout(() => router.push('/login'), 1500)
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
        border: '1px solid #334155'
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}>
          Новий пароль
        </h1>

        {error && (
          <div style={{ padding: 12, backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fecaca', fontSize: 14, borderRadius: 6, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ padding: 12, backgroundColor: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#86efac', fontSize: 14, borderRadius: 6, marginBottom: 16, textAlign: 'center' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#cbd5e1' }}>Новий пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 6, backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: 16, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#cbd5e1' }}>Повторіть пароль</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 6, backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: 16, boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 14, backgroundColor: loading ? '#1e40af' : '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Зберігаю…' : 'Зберегти новий пароль'}
          </button>
        </form>
      </div>
    </main>
  )
}
