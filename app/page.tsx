'use client';

import React, { useEffect, useState } from 'react';
import NotificationsModal, { NotificationItem } from '../components/NotificationsModal';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Стани для відкриття модальних вікон
  const [isBellModalOpen, setIsBellModalOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true);
        // Завантаження активних можливостей із Supabase
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
  }, []);

  // 1. Останні 5 сповіщень для Дзвіночка
  const recentNotifications = opportunities.slice(0, 5);

  // 2. Історія за останні 30 днів для Центру можливостей
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthlyHistory = opportunities.filter((item) => {
    const itemDate = new Date(item.created_at);
    return itemDate >= thirtyDaysAgo;
  });

  return (
    <main style={{ padding: '40px 20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      {/* Верхня панель із Дзвіночком */}
      <div style={{ display: 'flex', justifyContent: 'space-between', itemsCenter: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', margin: 0 }}>POVODYR</h1>
          <p style={{ fontSize: '16px', color: '#666', marginTop: '6px' }}>
            Цифровий асистент для українських художників.<br />
            POVODYR бачить можливості. Художник обирає шлях.
          </p>
        </div>

        {/* Кнопка Дзвіночка */}
        <button
          onClick={() => setIsBellModalOpen(true)}
          style={{
            position: 'relative',
            padding: '10px 14px',
            backgroundColor: '#1a1d2d',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '18px',
            touchAction: 'manipulation'
          }}
          aria-label="Сповіщення"
        >
          🔔
          {recentNotifications.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 'bold',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {recentNotifications.length}
            </span>
          )}
        </button>
      </div>

      {/* Кнопка розрахунку та авторизації */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
        {/* Кнопка "Центр можливостей" */}
        <button
          onClick={() => setIsCenterModalOpen(true)}
          disabled={loading}
          style={{
            padding: '14px 20px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            touchAction: 'manipulation'
          }}
        >
          📋 {loading ? 'Завантаження...' : `Центр можливостей (${monthlyHistory.length})`}
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/login"
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 24px',
              backgroundColor: '#000',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '8px',
              touchAction: 'manipulation'
            }}
          >
            Увійти
          </a>
          <a
            href="/register"
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 24px',
              backgroundColor: '#f0f0f0',
              color: '#000',
              textDecoration: 'none',
              borderRadius: '8px',
              touchAction: 'manipulation'
            }}
          >
            Зареєструватися
          </a>
        </div>
      </div>

      {/* МОДАЛЬНЕ ВІКНО 1: Свіжі сповіщення з Дзвіночка */}
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
    </main>
  );
}
