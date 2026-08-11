'use client';

interface ProfileProps {
  user: {
    id: string;
    telegram_chat_id?: string | null;
  };
}

export default function TelegramConnect({ user }: ProfileProps) {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'povodyr_app_bot';
  const telegramLink = `https://t.me/${botUsername}?start=${user.id}`;

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm my-4">
      <h3 className="text-lg font-semibold mb-2">Сповіщення в Telegram</h3>
      {user.telegram_chat_id ? (
        <div className="flex items-center text-green-600 font-medium">
          <span>✓ Персональні сповіщення в Telegram підключено</span>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Отримуйте оперативні добірки можливостей безпосередньо у ваш приватний чат.
          </p>
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors"
          >
            Підключити Telegram-бота
          </a>
        </div>
      )}
    </div>
  );
}
