'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

// Функція конвертації Base64 VAPID ключа у Uint8Array для браузера
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    }
    loadUser();
  }, []);

  const subscribeToPush = async () => {
    try {
      setIsSubscribing(true);
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Ваш браузер не підтримує Web Push сповіщення');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Дозвіл на сповіщення не надано');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!publicVapidKey) {
        alert('Помилка: NEXT_PUBLIC_VAPID_PUBLIC_KEY не знайдено у Vercel');
        return;
      }

      const convertedKey = urlBase64ToUint8Array(publicVapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Помилка авторизації');
        return;
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, subscription })
      });

      if (res.ok) {
        alert('Сповіщення успішно увімкнено!');
      } else {
        const errData = await res.json();
        alert('Помилка збереження: ' + (errData.error || 'Невідома помилка'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Помилка під час підключення сповіщень: ' + (err.message || err));
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Карточка вітання */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl space-y-4">
          <h1 className="text-2xl font-bold">
            Вітаємо, {userName || 'Художнику'}!
          </h1>
          <p className="text-slate-400 text-sm">
            Сьогодні знайдено <span className="text-white font-semibold">0</span> персональних можливостей.
          </p>

          <div className="flex gap-2 pt-2">
            <Link 
              href="/onboarding"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition"
            >
              Редагувати профіль
            </Link>

            <button
              onClick={subscribeToPush}
              disabled={isSubscribing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSubscribing ? 'Підключення...' : '🔔 Сповіщення'}
            </button>
          </div>
        </div>

        {/* Фільтри та вміст */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button className="px-4 py-2 bg-blue-600 rounded-full text-sm font-medium">Усі</button>
          <button className="px-4 py-2 bg-slate-800 rounded-full text-sm font-medium border border-slate-700">Open Call</button>
          <button className="px-4 py-2 bg-slate-800 rounded-full text-sm font-medium border border-slate-700">Конкурси</button>
          <button className="px-4 py-2 bg-slate-800 rounded-full text-sm font-medium border border-slate-700">Гранти</button>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50 text-center space-y-3">
          <p className="text-lg font-medium text-slate-300">
            У цій категорії поки немає збережених рекомендацій.
          </p>
          <p className="text-sm text-slate-500">
            Штучний інтелект регулярно шукає нові відкриті конкурси та гранти з перевірених джерел.
          </p>
        </div>
      </div>
    </div>
  );
}
