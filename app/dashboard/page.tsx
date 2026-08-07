'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const PUBLIC_VAPID_KEY = 'BIN2Jc5Vmkmy-S3AUrcMlpKxJpLeVRAfu9WBqUbJ70SJOCWGCGXKY-Xzyh7HDr6KbRDGYHjqZ06OcS3BjD7uAm8';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (!('serviceWorker' in navigator)) {
        alert('Service Worker не підтримується у цьому браузері');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || 'guest_user';

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          subscription: subscription,
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      setSubscribed(true);
      alert('Сповіщення успішно підключено!');
    } catch (err: any) {
      console.error(err);
      alert(`Помилка підключення: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    // Тут буде перехід на сторінку редагування профілю або відкриття модального вікна
    window.location.href = '/profile/edit';
  };

  const handleSelectCategories = () => {
    // Тут буде перехід на сторінку вибору категорій або відкриття відповідних налаштувань
    window.location.href = '/categories';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Вітаємо!</h1>
          <button
            onClick={handleEditProfile}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-sm flex items-center gap-1.5 border border-slate-700"
          >
            ✏️ Профіль
          </button>
        </div>

        <p className="text-slate-400">
          Сьогодні знайдено 0 персональних можливостей.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleSelectCategories}
            className="w-full py-3 px-4 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center justify-center gap-2 border border-slate-700"
          >
            🎯 Категорії пошуку
          </button>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
              subscribed
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading
              ? 'Підключення...'
              : subscribed
              ? '🔔 Сповіщення увімкнено'
              : '🔔 Увімкнути сповіщення'}
          </button>
        </div>
      </div>
    </div>
  );
}
