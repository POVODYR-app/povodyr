'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p>Завантаження даних...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold">Вітаємо у POVODYR, {profile?.full_name || 'Мистецю'}!</h1>
            <p className="text-slate-400 text-sm mt-1">Стиль / Техніка: {profile?.art_style || 'Не вказано'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition"
          >
            Вийти
          </button>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-xl font-semibold">Ваша творча картка</h2>
          <p className="text-slate-300">{profile?.bio || 'Опис відсутній'}</p>
        </div>
      </div>
    </main>
  );
}
