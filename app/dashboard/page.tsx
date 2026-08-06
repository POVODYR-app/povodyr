'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Стан для полів форми
  const [fullName, setFullName] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [bio, setBio] = useState('');

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

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setArtStyle(data.art_style || '');
        setBio(data.bio || '');
      }
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          art_style: artStyle,
          bio: bio,
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setProfile({ full_name: fullName, art_style: artStyle, bio });
        setIsEditing(false);
      }
    }
    setSaving(false);
  };

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
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition"
            >
              {isEditing ? 'Скасувати' : 'Редагувати'}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition"
            >
              Вийти
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-xl font-semibold">Редагування профілю</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">ПІБ / Творчий псевдонім</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Художній стиль / Техніка</label>
              <input
                type="text"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                required
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Коротко про свою творчість (Bio)</label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition disabled:opacity-50"
            >
              {saving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </form>
        ) : (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-xl font-semibold">Ваша творча картка</h2>
            <p className="text-slate-300 whitespace-pre-wrap">{profile?.bio || 'Опис відсутній'}</p>
          </div>
        )}
      </div>
    </main>
  );
}
