'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    country: '',
    city: '',
    techniques: '',
    directions: '',
    genres: '',
    readyForExport: false,
    targetCountries: '',
    maxApplicationFee: '',
    languages: '',
    professionalLevel: '',
    goals: '',
    bio: '',
  });

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
        setFormData({
          fullName: data.full_name || '',
          country: data.country || '',
          city: data.city || '',
          techniques: data.techniques || '',
          directions: data.directions || '',
          genres: data.genres || '',
          readyForExport: data.ready_for_export || false,
          targetCountries: data.target_countries || '',
          maxApplicationFee: data.max_application_fee || '',
          languages: data.languages || '',
          professionalLevel: data.professional_level || '',
          goals: data.goals || '',
          bio: data.bio || '',
        });
      }
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: formData.fullName,
          country: formData.country,
          city: formData.city,
          techniques: formData.techniques,
          directions: formData.directions,
          genres: formData.genres,
          ready_for_export: formData.readyForExport,
          target_countries: formData.targetCountries,
          max_application_fee: formData.maxApplicationFee,
          languages: formData.languages,
          professional_level: formData.professionalLevel,
          goals: formData.goals,
          bio: formData.bio,
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        setProfile({ ...formData, full_name: formData.fullName, ready_for_export: formData.readyForExport });
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
        <p>Завантаження персонального профілю...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold">Вітаємо, {profile?.full_name || 'Мистецю'}!</h1>
            <p className="text-slate-400 text-sm mt-1">
              {profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : 'Локація не вказана'} • {profile?.professional_level || 'Рівень не вказано'}
            </p>
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
          <form onSubmit={handleSave} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 text-sm">
            <h2 className="text-xl font-semibold mb-4">Редагування персонального профілю</h2>
            
            <div>
              <label className="block text-slate-300 mb-1 font-medium">ПІБ / Псевдонім</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Країна</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Місто</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Техніки</label>
              <input
                type="text"
                name="techniques"
                value={formData.techniques}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Напрямки</label>
                <input
                  type="text"
                  name="directions"
                  value={formData.directions}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Жанри</label>
                <input
                  type="text"
                  name="genres"
                  value={formData.genres}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Професійний рівень</label>
                <select
                  name="professionalLevel"
                  value={formData.professionalLevel}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Початковий">Початковий</option>
                  <option value="Незалежний художник">Незалежний художник</option>
                  <option value="Професійний / Emerging">Професійний / Emerging</option>
                  <option value="Established / Визнаний">Established / Визнаний</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Макс. вартість заявки</label>
                <input
                  type="text"
                  name="maxApplicationFee"
                  value={formData.maxApplicationFee}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Мови</label>
                <input
                  type="text"
                  name="languages"
                  value={formData.languages}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Країни інтересу</label>
                <input
                  type="text"
                  name="targetCountries"
                  value={formData.targetCountries}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Цілі</label>
              <input
                type="text"
                name="goals"
                value={formData.goals}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="readyForExportEdit"
                name="readyForExport"
                checked={formData.readyForExport}
                onChange={handleChange}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
              <label htmlFor="readyForExportEdit" className="text-slate-300 cursor-pointer">
                Готовий/а відправляти роботи за кордон
              </label>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Bio</label>
              <textarea
                name="bio"
                rows={3}
                value={formData.bio}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition disabled:opacity-50"
            >
              {saving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </form>
        ) : (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-xl font-semibold border-b border-slate-700 pb-3">Персональний профіль пошуку</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong className="text-slate-400">Техніки:</strong> {profile?.techniques || '—'}</div>
              <div><strong className="text-slate-400">Напрямки:</strong> {profile?.directions || '—'}</div>
              <div><strong className="text-slate-400">Жанри:</strong> {profile?.genres || '—'}</div>
              <div><strong className="text-slate-400">Цілі:</strong> {profile?.goals || '—'}</div>
              <div><strong className="text-slate-400">Країни інтересу:</strong> {profile?.target_countries || '—'}</div>
              <div><strong className="text-slate-400">Макс. плата за заявку:</strong> {profile?.max_application_fee || '—'}</div>
              <div><strong className="text-slate-400">Мови:</strong> {profile?.languages || '—'}</div>
              <div><strong className="text-slate-400">Відправка за кордон:</strong> {profile?.ready_for_export ? 'Так' : 'Ні'}</div>
            </div>

            {profile?.bio && (
              <div className="pt-4 border-t border-slate-700">
                <strong className="text-slate-400 block mb-1">Про творчість:</strong>
                <p className="text-slate-300 whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
    </main>
  );
}
