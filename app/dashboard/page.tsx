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

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link_url: string;
  is_read: boolean;
  created_at: string;
}

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
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Дані профілю
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [city, setCity] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [bio, setBio] = useState('');

  // Сповіщення та статистика за сьогодні
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [todayMatchesCount, setTodayMatchesCount] = useState<number>(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Гранти та фінансування',
    'Виставки та Open Calls'
  ]);
  const [shouldPromptUpdate, setShouldPromptUpdate] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }

    loadUserProfile();
    loadNotifications();
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

  const loadNotifications = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || 'guest_user';

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      const items = data as NotificationItem[];
      setNotifications(items);

      // Підраховуємо можливості, що були додані за сьогоднішню дату
      const todayStr = new Date().toISOString().split('T')[0];
      const todayItems = items.filter((item) => {
        const itemDateStr = new Date(item.created_at).toISOString().split('T')[0];
        return itemDateStr === todayStr;
      });
      setTodayMatchesCount(todayItems.length);

      // Перевірка: чи були релевантні пропозиції протягом останніх 7 днів
      if (items.length === 0) {
        setShouldPromptUpdate(true);
      } else {
        const latestDate = new Date(items[0].created_at).getTime();
        const now = new Date().getTime();
        const daysDifference = (now - latestDate) / (1000 * 3600 * 24);

        if (daysDifference >= 7) {
          setShouldPromptUpdate(true);
        } else {
          setShouldPromptUpdate(false);
        }
      }
    } else {
      setTodayMatchesCount(0);
      setShouldPromptUpdate(true);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
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
      alert('Push-сповіщення пристрою підключено!');
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Вітаємо{userName ? `, ${userName}` : ''}!
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotificationsModal(true)}
              className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-sm border border-slate-700"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-sm border border-slate-700"
            >
              ✏️ Профіль
            </button>
          </div>
        </div>

        {/* Картка статусу за сьогодні */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg space-y-2">
          {todayMatchesCount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✨</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">
                    Сьогодні для вас знайдено {todayMatchesCount}{' '}
                    {todayMatchesCount === 1
                      ? 'можливість'
                      : todayMatchesCount < 5
                      ? 'можливості'
                      : 'можливостей'}.
                  </p>
                  <p className="text-xs text-slate-400">Перегляньте нові деталі у базі.</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotificationsModal(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white transition flex-shrink-0"
              >
                Переглянути
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <p className="text-sm font-medium text-slate-300">
                Сьогодні нових можливостей немає. Я продовжую шукати.
              </p>
            </div>
          )}
        </div>

        {/* Баннер-пропозиція оновити критерії, якщо протягом тижня нічого не знайдено */}
        {shouldPromptUpdate && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <h3 className="font-semibold text-amber-400 text-sm">
                  Немає нових збігів за останній тиждень
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Можливо, варто оновити або розширити критерії пошуку, обрати додаткові категорії чи додати деталі у профіль.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCategoriesModal(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium border border-amber-500/40 text-center"
              >
                Змінити категорії
              </button>
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 text-center"
              >
                Оновити профіль
              </button>
            </div>
          </div>
        )}

        <p className="text-slate-400 text-sm">
          Усього знайдено матеріалів у базі: {notifications.length}.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowNotificationsModal(true)}
            className="w-full py-3 px-4 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-2"
          >
            📋 Центр можливостей ({notifications.length})
          </button>

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
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {loading
              ? 'Підключення Push...'
              : subscribed
              ? '📲 Push-сповіщення пристрою увімкнено'
              : '📲 Увімкнути Push на пристрої'}
          </button>
        </div>
      </div>

      {/* Модальне вікно центру сповіщень */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Знайдені можливості</h2>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {notifications.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">
                  Поки немає збережених можливостей. Вони з'являться тут автоматично.
                </p>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item.id)}
                    className={`p-4 rounded-xl border transition space-y-2 ${
                      item.is_read
                        ? 'bg-slate-900/50 border-slate-800 text-slate-400'
                        : 'bg-slate-900 border-blue-500/50 text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></span>
                      )}
                    </div>
                    {item.message && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.message}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleDateString('uk-UA')}
                      </span>
                      {item.link_url && (
                        <a
                          href={item.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
                        >
                          Детальніше 🔗
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowNotificationsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium"
            >
              Закрити
            </button>
          </div>
        </div>
      )}

      {/* Модальне вікно редагування профілю */}
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
