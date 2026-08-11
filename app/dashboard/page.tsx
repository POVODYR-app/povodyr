'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import TelegramConnect from '@/components/TelegramConnect'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function DashboardPage() {
  const [userName, setUserName] = useState('')
  const [userObj, setUserObj] = useState<{ id: string; telegram_chat_id?: string | null } | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    // Перевіряємо, чи користувач вже закривав банер
    const bannerClosed = localStorage.getItem('povodyr_install_banner_closed')
    if (!bannerClosed) {
      setShowInstallBanner(true)
    }

    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Профіль
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, telegram_chat_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.full_name) {
      setUserName(profile.full_name)
    }

    setUserObj({
      id: user.id,
      telegram_chat_id: profile?.telegram_chat_id || null,
    })

    // Сповіщення
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (notifs) {
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n: any) => !n.is_read).length)
    }
  }

  const closeInstallBanner = () => {
    setShowInstallBanner(false)
    localStorage.setItem('povodyr_install_banner_closed', 'true')
  }

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#0f172a',
      color: 'white',
      padding: '20px 16px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Банер встановлення (показується тільки один раз) */}
        {showInstallBanner && (
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            position: 'relative'
          }}>
            <button
              onClick={closeInstallBanner}
              style={{
                position: 'absolute',
                top: 10,
                right: 12,
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: 18,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 28 }}>📱</span>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700 }}>
                  Встановити POVODYR на телефон
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, opacity: 0.9 }}>
                  Додайте ярлик на робочий стіл, щоб відкривати як звичайний додаток.
                </p>

                <div style={{
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.5
                }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>Для iPhone (Safari):</p>
                  <ol style={{ margin: '0 0 10px 0', paddingLeft: 18 }}>
                    <li>Натисніть кнопку «Поділитися» внизу екрана</li>
                    <li>Оберіть «На екран “Додому”»</li>
                    <li>Натисніть «Додати»</li>
                  </ol>

                  <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Для Android (Chrome):</p>
                  <p style={{ margin: 0 }}>
                    Меню ⋮ → «Встановити додаток» або «Додати на головний екран»
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Заголовок */}
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          marginBottom: 24
        }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            Вітаємо{userName ? `, ${userName}` : ''}!
          </h1>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowNotifications(true)}
              style={{
                position: 'relative',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '8px 12px',
                color: 'white',
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            <a
              href="/profile"
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '8px 12px',
                color: 'white',
                fontSize: 14,
                textDecoration: 'none'
              }}
            >
              ✏️ Профіль
            </a>
          </div>
        </div>

        {/* Блок підключення Telegram */}
        {userObj && <TelegramConnect user={userObj} />}

        {/* Статус пошуку */}
        <div style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 16,
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🔍</span>
            <p style={{ margin: 0, fontSize: 15, color: '#cbd5e1' }}>
              Сьогодні нових можливостей немає. Я продовжую шукати.
            </p>
          </div>
        </div>

        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
          Усього знайдено матеріалів у базі: {notifications.length}
        </p>

        {/* Кнопки */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setShowNotifications(true)}
            style={{
              width: '100%',
              padding: 14,
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📋 Центр можливостей ({notifications.length})
          </button>

          <a
            href="/profile"
            style={{
              width: '100%',
              padding: 14,
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 500,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block'
            }}
          >
            ✏️ Мій профіль
          </a>
        </div>
      </div>

      {/* Модальне вікно сповіщень */}
      {showNotifications && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          padding: 16,
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: 16,
            width: '100%',
            maxWidth: 400,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #334155'
          }}>
            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottom: '1px solid #334155'
            }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Знайдені можливості</h2>
              <button
                onClick={() => setShowNotifications(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 20,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
              {notifications.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  Поки немає збережених можливостей.
                </p>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item.id)}
                    style={{
                      backgroundColor: item.is_read ? '#0f172a' : '#1e293b',
                      border: item.is_read ? '1px solid #1e293b' : '1px solid #3b82f6',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 12,
                      cursor: 'pointer'
                    }}
                  >
                    <h3 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 600 }}>
                      {item.title}
                    </h3>
                    {item.message && (
                      <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#cbd5e1' }}>
                        {item.message}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                      <span>{new Date(item.created_at).toLocaleDateString('uk-UA')}</span>
                      {item.link_url && (
                        <a
                          href={item.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#60a5fa' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Детальніше →
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #334155' }}>
              <button
                onClick={() => setShowNotifications(false)}
                style={{
                  width: '100%',
                  padding: 12,
                  backgroundColor: '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
