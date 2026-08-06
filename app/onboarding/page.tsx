'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

const TECH_OPTIONS = [
  'Акварель', 'Акрил', 'Графіка', 'Гуаш', 'Імпасто',
  'Олійний живопис', 'Пастель', 'Пуантилізм', 'Сфумато',
  'Темпера', 'Флюїд-арт'
];

const DIRECTION_OPTIONS = [
  'Абстракціонізм', 'Бароко', 'Експресіонізм', 'Імпресіонізм',
  'Класицизм', 'Кубізм', 'Модернізм та авангард', 'Поп-арт',
  'Постімпресіонізм', 'Реалізм', 'Ренесанс (Відродження)',
  'Романтизм', 'Сюрреалізм', 'Фотореалізм'
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    fullName: '',
    country: 'Україна',
    city: '',
    genres: '',
    readyForExport: false,
    targetCountries: '',
    maxApplicationFee: '',
    languages: 'Українська',
    professionalLevel: 'Початковий',
    goals: '',
    bio: '',
  });

  const toggleSelection = (item: string, list: string[], setList: (val: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

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
        techniques: selectedTechniques.join(', '),
        directions: selectedDirections.join(', '),
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
      <div className="w-full max-w-2xl bg-slate-800 p-5 sm:p-8 rounded-xl border border-slate-700 shadow-xl space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-center">Анкета художника</h1>
        <p className="text-slate-400 text-xs sm:text-sm text-center">Заповніть профіль для створення персонального алгоритму пошуку</p>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 text-red-200 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">ПІБ / Творчий псевдонім *</label>
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
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
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Місто</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-2 font-medium">
              Техніки <span className="text-slate-400 text-xs">(торкніться для вибору)</span>:
            </label>
            <div className="flex flex-wrap gap-2">
              {TECH_OPTIONS.map((tech) => {
                const isSelected = selectedTechniques.includes(tech);
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => toggleSelection(tech, selectedTechniques, setSelectedTechniques)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border active:scale-95 touch-manipulation ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{tech}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-2 font-medium">
              Напрямки <span className="text-slate-400 text-xs">(торкніться для вибору)</span>:
            </label>
            <div className="flex flex-wrap gap-2">
              {DIRECTION_OPTIONS.map((dir) => {
                const isSelected = selectedDirections.includes(dir);
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => toggleSelection(dir, selectedDirections, setSelectedDirections)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border active:scale-95 touch-manipulation ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{dir}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Жанри (наприклад: Пейзаж, Портрет)</label>
            <input
              type="text"
              name="genres"
              value={formData.genres}
              onChange={handleChange}
              className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Професійний рівень</label>
              <select
                name="professionalLevel"
                value={formData.professionalLevel}
                onChange={handleChange}
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
              >
                <option value="Початковий">Початковий</option>
                <option value="Незалежний художник">Незалежний художник</option>
                <option value="Професійний / Emerging">Професійний / Emerging</option>
                <option value="Established / Визнаний">Established / Визнаний</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Максимальний оргвнесок за подачу заявки ($ / €)</label>
              <input
                type="text"
                name="maxApplicationFee"
                placeholder="Безкоштовно або до $50"
                value={formData.maxApplicationFee}
                onChange={handleChange}
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
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
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
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
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
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
              className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="readyForExport"
              name="readyForExport"
              checked={formData.readyForExport}
              onChange={handleChange}
              className="w-6 h-6 accent-blue-600 rounded cursor-pointer touch-manipulation"
            />
            <label htmlFor="readyForExport" className="text-slate-300 cursor-pointer text-sm">
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
              placeholder="Розповісти про свій стиль та концепції..."
              className="w-full px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg font-medium transition disabled:opacity-50 text-base mt-4 touch-manipulation"
          >
            {loading ? 'Збереження...' : 'Створити персональний профіль'}
          </button>
        </form>
      </div>
    </main>
  );
}
