'use client';

import React, { useEffect, useState } from 'react';
import NotificationsModal, { NotificationItem } from '../components/NotificationsModal';
import { supabase } from '../lib/supabase';

export default function HomePage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBellModalOpen, setIsBellModalOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);

  useEffect(() => {
    async function fetchUserNotifications() {
      try {
        setLoading(true);
        
        // 1. Отримуємо поточного авторизованого користувача
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        // 2. Робимо запит виключно для цього користувача за його user_id
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Помилка завантаження сповіщень:', error);
          return;
        }

        if (data) {
          const formattedNotifications: NotificationItem[] = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.message,
            link: item.link_url || 'https://povodyr.vercel.app/dashboard',
            created_at: item.created_at,
            is_read: item.is_read
          }));

          setNotifications(formattedNotifications);
        }
      } catch (err) {
        console.error('Помилка запиту:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserNotifications();
  }, []);

  // Підраховуємо непрочитані сповіщення для дзвіночка
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalCount = notifications.length;

  return (
    <main style={{ padding: '30px 20px', fontFamily: 'sans-serif', maxWidth: '480px', margin: '0 auto', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      
      {/* Верхня панель */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 'bold' }}>Вітаємо, Vanda!</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsBellModalOpen(true)}
            style={{ position: 'relative', padding: '10px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '12px', cursor: 'pointer', fontSize: '16px' }}
          >
            🔔
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Блок сповіщень Telegram */}
      <div style={{ backgroundColor: '#161e2e', border: '1px solid #334155', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '17px', margin: '0 0 6px 0', fontWeight: '600' }}>Сповіщення в Telegram</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0' }}>Отримуйте оперативні добірки можливостей безпосередньо у ваш приватний чат.</p>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #10b981', borderRadius: '10px', padding: '12px 14px', color: '#34d399', fontSize: '13px', fontWeight: '500' }}>
          ✅ Персональні сповіщення в Telegram підключено
        </div>
      </div>

      {/* Статус знайдених можливостей */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '14px', color: '#93c5fd', fontSize: '15px', fontWeight: '500' }}>
        🔍 {loading ? 'Пошук...' : `Отримано звітів за добу: ${totalCount}`}
      </div>

      <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', marginBottom: '20px' }}>
        Усього сповіщень у системі: {totalCount}
      </div>

      {/* Основні кнопки */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
        <button
          onClick={() => setIsCenterModalOpen(true)}
          disabled={loading}
          style={{ padding: '15px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
        >
          📋 {loading ? 'Завантаження...' : `Центр сповіщень (${totalCount})`}
        </button>
        <a href="/profile" style={{ textAlign: 'center', padding: '15px 20px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', textDecoration: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600' }}>
          ✏️ Мій профіль
        </a>
      </div>

      <div style={{ borderTop: '1px solid #1e293b', margin: '24px 0' }} />

      {/* Футер із текстом та логотипом */}
      <div style={{ textAlign: 'center', paddingBottom: '30px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px 0' }}>POVODYR</h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '360px', margin: '0 auto' }}>
          Ви створюєте картини. POVODYR допомагає їм знайти свій шлях.
        </p>
        <div className="flex justify-center mt-4">
          <img 
            src="/icon-192.jpg" 
            alt="POVODYR Logo" 
            className="w-24 h-24 rounded-2xl object-cover shadow-md mx-auto"
          />
        </div>
      </div>

      {/* Модальні вікна */}
      <NotificationsModal
        isOpen={isBellModalOpen}
        onClose={() => setIsBellModalOpen(false)}
        notifications={notifications}
        title="Останні сповіщення"
      />
      <NotificationsModal
        isOpen={isCenterModalOpen}
        onClose={() => setIsCenterModalOpen(false)}
        notifications={notifications}
        title={`Центр сповіщень (${totalCount})`}
      />
    </main>
  );
}
