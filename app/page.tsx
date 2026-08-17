'use client';

import React, { useEffect, useState } from 'react';
import NotificationsModal, { NotificationItem } from '../components/NotificationsModal';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isBellModalOpen, setIsBellModalOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true);
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

  const recentNotifications = opportunities.slice(0, 10);
  const totalCount = opportunities.length;

  return (
    <main style={{ padding: '30px 20px', fontFamily: 'sans-serif', maxWidth: '480px', margin: '0 auto', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      
      {/* Верхня панель: Привітання, Дзвіночок з лічильником та кнопка Профілю */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 'bold' }}>Вітаємо, Vanda!</h1>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Кнопка Дзвіночка з бейджем */}
          <button
            onClick={() => setIsBellModalOpen(true)}
            style={{
              position: 'relative',
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              touchAction: 'manipulation'
            }}
            aria-label="Сповіщення"
          >
            🔔
            {recentNotifications.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {recentNotifications.length}
              </span>
            )}
          </button>

          {/* Кнопка Профілю у верхній панелі */}
          <a
            href="/profile"
            style={{
              padding: '10px 14px',
              backgroundColor: '#1e293b',
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

      {/* Блок: Сповіщення в Telegram */}
      <div style={{
        backgroundColor: '#161e2e',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '17px', margin: '0 0 6px 0', color: '#fff', fontWeight: '600' }}>Сповіщення в Telegram</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0', lineHeight: '1.4' }}>
          Отримуйте оперативні добірки можливостей безпосередньо у ваш приватний чат.
        </p>
        <div style={{
          backgroundColor: '#0f172a',
          border: '1px solid #10b981',
          borderRadius: '10px',
          padding: '12px 14px',
          color: '#34d399',
          fontSize: '13px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>✅</span> Персональні сповіщення в Telegram підключено
        </div>
      </div>

      {/* Центральна плашка знайдених можливостей */}
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #3b82f6',
        borderRadius: '14px',
        padding: '16px',
        textAlign: 'center',
        marginBottom: '14px',
        color: '#93c5fd',
        fontSize: '15px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <span>🔍</span> {loading ? 'Пошук...' : `Знайдено ${totalCount} нових можливостей під ваш профіль!`}
      </div>

      {/* Інформаційний текст бази */}
      <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', marginBottom: '20px' }}>
        Усього знайдено матеріалів у базі: {totalCount}
      </div>

      {/* Основні великі кнопки керування */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
        
        {/* Кнопка "Центр можливостей" */}
        <button
          onClick={() => setIsCenterModalOpen(true)}
          disabled={loading}
          style={{
            padding: '15px 20px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            touchAction: 'manipulation'
          }}
        >
          <span>📋</span> {loading ? 'Завантаження...' : `Центр можливостей (${totalCount})`}
        </button>

        {/* Кнопка "Мій профіль" */}
        <a
          href="/profile"
          style={{
            textAlign: 'center',
            padding: '15px 20px',
            backgroundColor: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            textDecoration: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            touchAction: 'manipulation'
          }}
        >
          <span>✏️</span> Мій профіль
        </a>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', margin: '24px 0' }} />

      {/* Нижній брендинг POVODYR */}
      <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
        <div style={{
          display: 'inline-block',
          padding: '10px',
          backgroundColor: '#161e2e',
          borderRadius: '16px',
          border: '1px solid #334155',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '26px' }}>👁️‍🗨️</span>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px 0', letterSpacing: '1px' }}>POVODYR</h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '360px', margin: '0 auto', lineHeight: '1.4' }}>
          Ви створюєте картини. POVODYR допомагає їм знайти свій шлях до глядача та галерей.
        </p>
      </div>

      {/* Модальне вікно сповіщень (Дзвіночок) */}
      <NotificationsModal
        isOpen={isBellModalOpen}
        onClose={() => setIsBellModalOpen(false)}
        notifications={recentNotifications}
        title="Останні сповіщення"
      />

      {/* Модальне вікно Центру можливостей */}
      <NotificationsModal
        isOpen={isCenterModalOpen}
        onClose={() => setIsCenterModalOpen(false)}
        notifications={opportunities}
        title={`Центр можливостей (${totalCount})`}
      />
    </main>
  );
}
