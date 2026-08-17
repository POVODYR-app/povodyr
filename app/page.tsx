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

  // Останні 5 сповіщень для Дзвіночка
  const recentNotifications = opportunities.slice(0, 5);

  return (
    <main key={Date.now()} style={{ padding: '40px 20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      
      {/* Верхня панель: Привітання та кнопка Профілю / Дзвіночка */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 'bold' }}>Вітаємо, Vanda!</h1>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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

          {/* Кнопка Профіль */}
          <a
            href="/profile"
            style={{
              padding: '10px 16px',
              backgroundColor: '#1a1d2d',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: '12px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ✏️ Профіль
          </a>
        </div>
      </div>

      {/* Блок сповіщень в Telegram */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 8px 0', color: '#fff' }}>Сповіщення в Telegram</h2>
        <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 16px 0' }}>
          Отримуйте оперативні добірки можливостей безпосередньо у ваш приватний чат.
        </p>
        <div style={{
          backgroundColor: '#0f172a',
          border: '1px solid #10b981',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#34d399',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>✅</span> Персональні сповіщення в Telegram підключено
        </div>
      </div>

      {/* Інформаційний рядок кількості та кнопка Центру можливостей */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
        
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#1d283a',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          color: '#93c5fd',
          fontSize: '15px',
          textAlign: 'center',
          fontWeight: '500'
        }}>
          🔍 {loading ? 'Вираховуємо можливості...' : `Знайдено ${opportunities.length} нових можливостей під ваш профіль!`}
        </div>

        <div style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center' }}>
          Усього знайдено матеріалів у базі: {opportunities.length}
        </div>

        {/* Кнопка "Центр можливостей" */}
        <button
          onClick={() => setIsCenterModalOpen(true)}
          disabled={loading}
          style={{
            padding: '16px 20px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            touchAction: 'manipulation'
          }}
        >
          📋 {loading ? 'Завантаження...' : `Центр можливостей (${opportunities.length})`}
        </button>

        {/* Кнопка "Мій профіль" */}
        <a
          href="/profile"
          style={{
            textAlign: 'center',
            padding: '16px 20px',
            backgroundColor: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            textDecoration: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            touchAction: 'manipulation'
          }}
        >
          ✏️ Мій профіль
        </a>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '30px 0' }} />

      {/* Нижній брендинг POVODYR */}
      <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
        <div style={{
          display: 'inline-block',
          padding: '12px',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #334155',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '28px' }}>👁️‍🗨️</span>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0', letterSpacing: '1px' }}>POVODYR</h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '400px', margin: '0 auto', lineHeight: '1.4' }}>
          Ви створюєте картини. POVODYR допомагає їм знайти свій шлях до глядача та галерей.
        </p>
      </div>

      {/* МОДАЛЬНЕ ВІКНО 1: Свіжі сповіщення з Дзвіночка */}
      <NotificationsModal
        isOpen={isBellModalOpen}
        onClose={() => setIsBellModalOpen(false)}
        notifications={recentNotifications}
        title="Останні сповіщення"
      />

      {/* МОДАЛЬНЕ ВІКНО 2: Центр можливостей (Всі доступні матеріали) */}
      <NotificationsModal
        isOpen={isCenterModalOpen}
        onClose={() => setIsCenterModalOpen(false)}
        notifications={opportunities}
        title={`Центр можливостей (${opportunities.length})`}
      />
    </main>
  );
}
