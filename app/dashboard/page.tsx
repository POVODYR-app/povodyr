'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const PUBLIC_VAPID_KEY = 'BIN2Jc5Vmkmy-S3AUrcMlpKxJpLeVRAfu9WBqUbJ70SJOCWGCGXKY-Xzyh7HDr6KbRDGYHjqZ06OcS3BjD7uAm8';

const AVAILABLE_CATEGORIES = [
  'Гранти та фінансування',
  'Виставки та Open Calls',
  'Мистецькі резиденції',
  'Конкурси та премії',
  'Стипендії та навчання',
  'Аукціони та ярмарки'
];

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
  
  // Модальні вікна
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  // Повні дані профілю користувача
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [city, setCity] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [bio, setBio] = useState('');

  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Гранти та фінансування',
    'Виставки та Open Calls'
  ]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }

    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, art_style, city, portfolio, bio, categories')
        .eq('id', userData.user.id)
        .single();

      if (profile) {
        if (profile.full_name) setUserName(profile.full_name);
        if (profile.role) setUserRole(profile.role);
        if (profile.art_style) setArtStyle(profile.art_style);
        if (profile.city) setCity(profile.city);
        if (profile.portfolio) setPortfolio(profile.portfolio);
        if (profile.bio) setBio(profile.bio);
        if (profile.categories && Array.isArray(profile.categories)) {
          setSelectedCategories(profile.categories);
        }
      }
    }
  };

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

  const saveProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      await supabase.from('profiles').upsert({
        id: userData.user.id,
        full_name: userName,
        role: userRole,
        art_style: artStyle,
        city: city,
        portfolio: portfolio,
        bio: bio,
      });
    }
    setShowProfileModal(false);
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const saveCategories = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      await supabase.from('profiles').upsert({
        id: userData.user.id,
        categories: selectedCategories,
      });
    }
    setShowCategoriesModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Вітаємо{userName ? `, ${userName}` : ''}!
          </h1>
          <button
            onClick={() => setShowProfileModal(true)}
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
            onClick={() => setShowCategoriesModal(true)}
            className="w-full py-3 px-4 rounded-xl font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center justify-center gap-2 border border-slate-700"
          >
            🎯 Категорії пошуку ({selectedCategories.length})
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

      {/* Повне модальне вікно редагування профілю */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold">Редагування профілю</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ім'я та Прізвище</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Введіть ім'я та прізвище"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Спеціалізація / Роль</label>
                <input
                  type="text"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  placeholder="Художник, куратор, ілюстратор тощо"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Напрямок / Стиль мистецтва</label>
                <input
                  type="text"
                  value={artStyle}
                  onChange={(e) => setArtStyle(e.target.value)}
                  placeholder="Живопис, соляризм, цифрова графіка..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Місто / Локація</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Київ, Львів..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Посилання на портфоліо чи соцмережі</label>
                <input
                  type="text"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Коротке резюме / Про себе</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Опишіть коротко ваш досвід та творчі зацікавлення..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 py-2 px-4 rounded-xl bg-slate-700 text-slate-300 font-medium"
              >
                Скасувати
              </button>
              <button
                onClick={saveProfile}
                className="flex-1 py-2 px-4 rounded-xl bg-blue-600 text-white font-medium"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальне вікно вибору категорій */}
      {showCategoriesModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 space-y-4">
            <h2 className="text-xl font-bold">Категорії пошуку</h2>
            <p className="text-xs text-slate-400">Оберіть напрями для моніторингу можливостей:</p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {AVAILABLE_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span>{category}</span>
                    <span>{isSelected ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCategoriesModal(false)}
                className="flex-1 py-2 px-4 rounded-xl bg-slate-700 text-slate-300 font-medium"
              >
                Скасувати
              </button>
              <button
                onClick={saveCategories}
                className="flex-1 py-2 px-4 rounded-xl bg-blue-600 text-white font-medium"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
