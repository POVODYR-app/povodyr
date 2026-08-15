'use client'

import { useState } from 'react'

interface TelegramConnectProps {
  user: {
    id: string
    telegram_chat_id?: string | null
  }
}

export default function TelegramConnect({ user }: TelegramConnectProps) {
  const [copied, setCopied] = useState(false)

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'povodyr_bot'
  const isConnected = Boolean(user?.telegram_chat_id)
  const telegramLink = `https://t.me/${botUsername}?start=${user.id}`
  const manualCommand = `/start ${user.id}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(manualCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 16,
      padding: 16,
      marginBottom: 20
    }}>
      <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
        Сповіщення в Telegram
      </h3>
      <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>
        Отримуйте оперативні добірки можливостей безпосередньо у ваш приватний чат.
      </p>

      {isConnected ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid #22c55e',
          color: '#4ade80',
          padding: '12px 16px',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span>Персональні сповіщення в Telegram підключено</span>
        </div>
      ) : (
        <div>
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              backgroundColor: '#0088cc',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)',
              marginBottom: 12
            }}
          >
            <span>✈️</span> Підключити Telegram-бота
          </a>

          {/* Запасний варіант для Safari та мобільних браузерів */}
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: 10,
            fontSize: 12,
            color: '#cbd5e1'
          }}>
            <p style={{ margin: '0 0 6px 0', color: '#94a3b8' }}>
              Якщо бот не підключився автоматично через Safari:
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                backgroundColor: '#1e293b',
                padding: '6px 8px',
                borderRadius: 6,
                flex: 1,
                color: '#38bdf8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 11
              }}>
                {manualCommand}
              </code>
              <button
                onClick={copyToClipboard}
                style={{
                  backgroundColor: '#334155',
                  border: 'none',
                  color: 'white',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {copied ? 'Скопійовано!' : 'Копіювати'}
              </button>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: 11, color: '#64748b' }}>
              Надішліть цю команду боту в чат вручну.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
