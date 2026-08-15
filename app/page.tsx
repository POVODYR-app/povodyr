'use client';

import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import NotificationsModal, { NotificationItem } from '@/components/NotificationsModal';

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Стани модальних вікон
  const [isBellModalOpen, setIsBellModalOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);

  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true);
        // Завантажуємо можливості з Supabase
        const { data, error } = await supabase
          .from('opportunities')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Помилка завантаження даних:', error);
        } else if (data) {
          setOpportunities(data as NotificationItem[]);
        }
      } catch (err) {
        console.error('Помилка запиту:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOpportunities();
  }, [supabase]);

  // 1. Свіжі сповіщення для Дзвіночка (перші 5 записів)
  const recentNotifications = opportunities.slice(0, 5);

  // 2. Архiв за останні 30 днів для "Центру можливостей"
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthlyHistory = opportunities.filter((item) => {
    const itemDate = new Date(item.created_at);
    return itemDate >= thirtyDaysAgo;
  });

  return (
    <div className="min-h-screen bg-[#0f111a] text-white p-6 max-w-4xl mx-auto space-y-6">
      {/* Шапка дашборду */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Панель керування</h1>
          <p className="text-sm text-slate-400">POVODYR — Цифровий асистент</p>
        </div>

        {/* Дзвіночок сповіщень */}
        <button
          onClick={() => setIsBellModalOpen(true)}
          className="relative p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white transition-colors border border-slate-700"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label="Сповіщення"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {recentNotifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0f111a]">
              {recentNotifications.length}
            </span>
          )}
        </button>
      </div>

      {/* Основний блок із кнопкою Центру можливостей */}
      <div className="bg-[#181a26] p-6 rounded-2xl border border-slate-800 space-y-4 shadow-lg">
        <h2 className="text-xl font-bold">Можливості для художників</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          Переглядайте актуальні опейн коли, резиденції та грантові програми, підібрані для вашого профілю.
        </p>

        {/* Кнопка "Центр можливостей" */}
        <button
          onClick={() => setIsCenterModalOpen(true)}
          disabled={loading}
          className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md shadow-blue-600/20"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <span>📋</span>
          <span>
            {loading
              ? 'Завантаження можливостей...'
              : `Центр можливостей (${monthlyHistory.length})`}
          </span>
        </button>
      </div>

      {/* МОДАЛЬНЕ ВІКНО 1: Дзвіночок (Останні 5 сповіщень) */}
      <NotificationsModal
        isOpen={isBellModalOpen}
        onClose={() => setIsBellModalOpen(false)}
        notifications={recentNotifications}
        title="Останні сповіщення"
      />

      {/* МОДАЛЬНЕ ВІКНО 2: Центр можливостей (Архiв за 30 днів) */}
      <NotificationsModal
        isOpen={isCenterModalOpen}
        onClose={() => setIsCenterModalOpen(false)}
        notifications={monthlyHistory}
        title="Центр можливостей (За 30 днів)"
      />
    </div>
  );
}
