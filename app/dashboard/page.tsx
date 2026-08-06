'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

interface UserProfile {
  full_name?: string;
  country?: string;
  city?: string;
  techniques?: string;
  directions?: string;
  genres?: string;
  ready_for_export?: boolean;
  target_countries?: string;
  max_application_fee?: string;
  languages?: string;
  professional_level?: string;
  goals?: string;
  bio?: string;
}

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

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    fullName: '',
    country: '',
    city: '',
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
          genres: data.genres || '',
          readyForExport: data.ready_for_export || false,
          targetCountries: data.target_countries || '',
          maxApplicationFee: data.max_application_fee || '',
          languages: data.languages || '',
          professionalLevel: data.professional_level || '',
          goals: data.goals || '',
          bio: data.bio || '',
        });

        if (data.techniques) {
          setSelectedTechniques(data.techniques.split(', ').filter(Boolean));
        }
        if (data.directions) {
          setSelectedDirections(data.directions.split(', ').filter(Boolean));
        }
      }
      setLoading(false);
    }

    loadProfile();
  }, [router]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const techStr = selectedTechniques.join(', ');
      const dirStr = selectedDirections.join(', ');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: formData.fullName,
          country: formData.country,
          city: formData.city,
          techniques: techStr,
          directions: dirStr,
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
        setProfile({
          full_name: formData.fullName,
          country: formData.country,
          city: formData.city,
          techniques: techStr,
          directions: dirStr,
          genres: formData.genres,
          ready_for_export: formData.readyForExport,
          target_countries: formData.targetCountries,
          max_application_fee: formData.maxApplicationFee,
          languages: formData.languages,
          professional_level: formData.professionalLevel,
          goals: formData.goals,
          bio: formData.bio,
        });
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-5 sm:p-6 rounded-xl border border-slate-700">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Вітаємо, {profile?.full_name || 'Мистецю'}!</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              {profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : 'Локація не вказана'} • {profile?.professional_level || 'Рівень не вказано'}
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-sm font-medium transition touch-manipulation"
            >
              {isEditing ? 'Скасувати' : 'Редагувати'}
            </button>
            <button
              onClick={handleLogout}
              className="min-h-[44px] px-4 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 rounded text-sm font-medium transition touch-manipulation"
            >
              Вийти
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="bg-slate-800 p-5 sm:p-6 rounded-xl border border-slate-700 space-y-4 text-sm">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Редагування персонального профілю</h2>
            
            <div>
              <label className="block text-slate-300 mb-1 font-medium">ПІБ / Псевдонім</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="w-full min-h-[44px] px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white text-base focus:outline-none focus:border-blue-500"
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
                id="readyForExportEdit"
                name="readyForExport"
                checked={formData.readyForExport}
                onChange={handleChange}
                className="w-6 h-6 accent-blue-600 rounded cursor-pointer touch-manipulation"
              />
              <label htmlFor="readyForExportEdit" className="text-slate-300 cursor-pointer text-sm">
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
              disabled={saving}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded font-medium transition disabled:opacity-50 text-base touch-manipulation"
            >
              {saving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </form>
        ) : (
          <div className="bg-slate-800 p-5 sm:p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold border-b border-slate-700 pb-3">Персональний профіль пошуку</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong className="text-slate-400">Техніки:</strong> {profile?.techniques || '—'}</div>
              <div><strong className="text-slate-400">Напрямки:</strong> {profile?.directions || '—'}</div>
              <div><strong className="text-slate-400">Жанри:</strong> {profile?.genres || '—'}</div>
              <div><strong className="text-slate-400">Цілі:</strong> {profile?.goals || '—'}</div>
              <div><strong className="text-slate-400">Країни інтересу:</strong> {profile?.target_countries || '—'}</div>
              <div><strong className="text-slate-400">Макс. оргвнесок:</strong> {profile?.max_application_fee || '—'}</div>
              <div><strong className="text-slate-400">Мови:</strong> {profile?.languages || '—'}</div>
              <div><strong className="text-slate-400">Відправка за кордон:</strong> {profile?.ready_for_export ? 'Так' : 'Ні'}</div>
            </div>

            {profile?.bio && (
              <div className="pt-4 border-t border-slate-700">
                <strong className="text-slate-400 block mb-1">Про творчість:</strong>
                <p className="text-slate-300 whitespace-pre-wrap text-sm sm:text-base">{profile.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
