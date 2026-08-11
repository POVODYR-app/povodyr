'use client'

interface TelegramConnectProps {
  user: {
    id: string
    telegram_chat_id?: string | null
  }
}

export default function TelegramConnect({ user }: TelegramConnectProps) {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'povodyr_bot'
  const isConnected = Boolean(user?.telegram_chat_id)
  const telegramLink = `https://t.me/${botUsername}?start=${user.id}`

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
            boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)'
          }}
        >
          <span>✈️</span> Підключити Telegram-бота
        </a>
      )}
    </div>
  )
}
