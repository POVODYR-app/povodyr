'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface Opportunity {
  id: string;
  title: string;
  description_uk: string;
  original_url: string;
  category: string;
  country: string;
  deadline: string | null;
  is_free: boolean;
  fee_amount: string;
}

interface MatchItem {
  id: string;
  match_score: number;
  reasons_uk: string[];
  potential_benefit: string;
  application_complexity: string;
  estimated_time: string;
  user_action: string;
  opportunity: Opportunity;
}

const CATEGORIES = [
  { id: 'all', label: 'Усі' },
  { id: 'open_call', label: 'Open Call' },
  { id: 'contests', label: 'Конкурси' },
  { id: 'grants', label: 'Гранти' },
  { id: 'residencies', label: 'Резиденції' },
  { id: 'commercial', label: 'Комерційні' },
  { id: 'educational', label: 'Освітні' },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetchUserDataAndMatches();
  }, []);

  const fetchUserDataAndMatches = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    // Отримуємо ім'я
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (profile?.full_name) {
      setUserName(profile.full_name);
    }

    // Отримуємо персональні збіги
    const { data: matchesData, error } = await supabase
      .from('user_opportunity_matches')
      .select(`
        id,
        match_score,
        reasons_uk,
        potential_benefit,
        application_complexity,
        estimated_time,
        user_action,
        opportunity:opportunities (
          id,
          title,
          description_uk,
          original_url,
          category,
          country,
          deadline,
          is_free,
          fee_amount
        )
      `)
      .eq('user_id', user.id)
      .neq('user_action', 'hidden')
      .order('match_score', { ascending: false });

    if (!error && matchesData) {
      // Приведення типів для відфільтрованих даних Supabase
      const formattedMatches = matchesData
        .filter((item: any) => item.opportunity)
        .map((item: any) => ({
          ...item,
          opportunity: Array.isArray(item.opportunity) ? item.opportunity[0] : item.opportunity,
        }));
      setMatches(formattedMatches);
    }

    setLoading(false);
  };

  const handleAction = async (matchId: string, action: string) => {
    // Оновлюємо стан локально для швидкого відгуку UI
    if (action === 'hidden') {
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } else {
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, user_action: action } : m))
      );
    }

    // Зберігаємо дію в БД
    await supabase
      .from('user_opportunity_matches')
      .update({ user_action: action, updated_at: new Date().toISOString() })
      .eq('id', matchId);
  };

  const calculateDaysLeft = (deadlineStr: string | null) => {
    if (!deadlineStr) return null;
    const diff = new Date(deadlineStr).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? days : 0;
  };

  const renderStars = (score: number) => {
    const starsCount = Math.round((score / 100) * 5);
    return '★'.repeat(starsCount) + '☆'.repeat(5 - starsCount);
  };

  const filteredMatches = matches.filter((m) => {
    if (selectedCategory === 'all') return true;
    return m.opportunity?.category === selectedCategory;
  });

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Шапка дашборду */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              Вітаємо{userName ? `, ${userName}` : ''}!
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Сьогодні знайдено <span className="text-blue-400 font-semibold">{matches.length}</span> персональних можливостей.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-lg transition min-h-[44px] inline-flex items-center"
          >
            Редагувати профіль
          </Link>
        </div>

        {/* Категорії (Фільтр) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition min-h-[44px] touch-manipulation ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Список можливостей */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Завантаження рекомендацій...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center space-y-3">
            <p className="text-slate-300 text-base">У цій категорії поки немає збережених рекомендацій.</p>
            <p className="text-slate-400 text-xs">
              AI регулярно шукає нові відкриті конкурси та гранти з перевірених джерел.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMatches.map((item) => {
              const daysLeft = calculateDaysLeft(item.opportunity.deadline);
              return (
                <div
                  key={item.id}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-5 sm:p-6 space-y-4 shadow-lg hover:border-slate-600 transition"
                >
                  {/* Заголовок та Рейтинг */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div>
                      <span className="text-xs font-medium text-blue-400 uppercase tracking-wider bg-blue-950/50 border border-blue-800 px-2.5 py-1 rounded">
                        {item.opportunity.category}
                      </span>
                      <h2 className="text-lg sm:text-xl font-bold mt-2">
                        {item.opportunity.title}
                      </h2>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-amber-400 text-base tracking-widest">
                        {renderStars(item.match_score)}
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Підходить вам на <span className="text-green-400 font-bold">{item.match_score}%</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed">
                    {item.opportunity.description_uk}
                  </p>

                  {/* Блок "Чому рекомендовано" */}
                  {item.reasons_uk && item.reasons_uk.length > 0 && (
                    <div className="bg-slate-900/60 rounded-lg p-3 sm:p-4 text-xs space-y-2 border border-slate-700/50">
                      <p className="font-semibold text-slate-200">Чому рекомендовано:</p>
                      <ul className="space-y-1 text-slate-300">
                        {item.reasons_uk.map((reason, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="text-green-400 text-sm">✔</span> {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Додаткова аналітика */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-900/30 p-3 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 block">Потенційна користь:</span>
                      <span className="text-slate-200 font-medium">{item.potential_benefit || 'Висока'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Складність подачі:</span>
                      <span className="text-slate-200 font-medium">{item.application_complexity || 'Середня'}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-400 block">Час на підготовку:</span>
                      <span className="text-slate-200 font-medium">{item.estimated_time || '1-2 години'}</span>
                    </div>
                  </div>

                  {/* Дедлайн та кнопка статусів */}
                  <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-slate-700/60 text-xs">
                    <div>
                      {daysLeft !== null ? (
                        <span className="text-amber-400 font-medium">
                          ⏳ До дедлайну: {daysLeft} днів
                        </span>
                      ) : (
                        <span className="text-slate-400">Дедлайн не вказано</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleAction(item.id, 'hidden')}
                        className="px-3 py-2 text-slate-400 hover:text-red-400 transition min-h-[44px] touch-manipulation"
                        title="Приховати подібні"
                      >
                        Не показувати подібні
                      </button>

                      <button
                        onClick={() => handleAction(item.id, item.user_action === 'saved' ? 'new' : 'saved')}
                        className={`px-3 py-2 rounded font-medium border transition min-h-[44px] touch-manipulation ${
                          item.user_action === 'saved'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                        }`}
                      >
                        {item.user_action === 'saved' ? 'Збережено' : 'Зберегти'}
                      </button>

                      <a
                        href={item.opportunity.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleAction(item.id, 'applied')}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition min-h-[44px] inline-flex items-center justify-center touch-manipulation"
                      >
                        Подати заявку
                      </a>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
