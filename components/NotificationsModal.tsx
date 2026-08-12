'use client';

import React from 'react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
  link_url?: string;
  is_read?: boolean;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onSelectNotification?: (item: NotificationItem) => void;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  onSelectNotification,
}: NotificationsModalProps) {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#1a1d2d] border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Заголовок модального вікна */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Знайдені можливості</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            aria-label="Закрити"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Список сповіщень */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {notifications && notifications.length > 0 ? (
            notifications.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-blue-500/50 transition-all"
              >
                <h3 className="font-bold text-white mb-2 text-base">{item.title}</h3>
                
                {/* Клас whitespace-pre-line забезпечує охайний вивід списку з переносами \n */}
                <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed mb-3">
                  {item.message}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/40">
                  <span>{formatDate(item.created_at)}</span>
                  {item.link_url && (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onSelectNotification && onSelectNotification(item)}
                      className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                    >
                      Детальніше &rarr;
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              Немає сповіщень
            </div>
          )}
        </div>

        {/* Футер з кнопкою закриття */}
        <div className="p-4 border-t border-slate-800 bg-[#161826] text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
