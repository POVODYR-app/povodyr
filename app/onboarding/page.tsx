'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    country: 'Україна',
    city: '',
    techniques: '',
    directions: '',
    genres: '',
    readyForExport: false,
    targetCountries: '',
    maxApplicationFee: '',
    languages: 'Українська',
    professionalLevel: 'Початковий',
    goals: '',
    bio: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target;
    if (target.type === 'checkbox') {
      const checked = (target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [target.name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [target.name]: target.value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Користувача не знайдено. Переавторизуйтесь.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
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

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex justify-center items-center">
      <div className="w-full max-w-2xl bg-slate-800 p-6 sm:p-8 rounded-xl border border-slate-700 shadow-xl space-y-6">
        <h1 className="text-2xl font-bold text-center">Анкета художника</h1>
        <p className="text-slate-400 text-sm text-center">Заповніть профіль для створення персонального алгоритму пошуку</p>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 text-red-200 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">ПІБ / Творчий псевдонім *</label>
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Країна проживання</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Місто</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Техніки (напр. Живопис, Графіка, Кераміка)</label>
            <input
              type="text"
              name="techniques"
              value={formData.techniques}
              onChange={handleChange}
              placeholder="Вкажіть через кому"
              className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
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
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Жанри</label>
              <input
                type="text"
                name="genres"
                value={formData.genres}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
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
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Початковий">Початковий</option>
                <option value="Незалежний художник">Незалежний художник</option>
                <option value="Професійний / Emerging">Професійний / Emerging</option>
                <option value="Established / Визнаний">Established / Визнаний</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Максимальний внесок заявки ($ / €)</label>
              <input
                type="text"
                name="maxApplicationFee"
                placeholder="наприклад: Безкоштовно або до $50"
                value={formData.maxApplicationFee}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Мови володіння</label>
              <input
                type="text"
                name="languages"
                value={formData.languages}
                onChange={handleChange}
                placeholder="Українська, Англійська..."
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Цільові країни для участі</label>
              <input
                type="text"
                name="targetCountries"
                value={formData.targetCountries}
                onChange={handleChange}
                placeholder="ЄС, США..."
                className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Цілі (продаж, виставки, гранти)</label>
            <input
              type="text"
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              placeholder="Вкажіть пріоритетні цілі"
              className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="readyForExport"
              name="readyForExport"
              checked={formData.readyForExport}
              onChange={handleChange}
              className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
            />
            <label htmlFor="readyForExport" className="text-slate-300 cursor-pointer">
              Готовий/а відправляти оригінали робіт за кордон
            </label>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Коротко про свою творчість (Bio)</label>
            <textarea
              name="bio"
              rows={3}
              value={formData.bio}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition disabled:opacity-50 text-base mt-4"
          >
            {loading ? 'Збереження...' : 'Створити персональний профіль'}
          </button>
        </form>
      </div>
    </main>
  );
}
