'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

const TECHNIQUES = [
  'Акварель',
  'Акрил',
  'Графіка',
  'Гуаш',
  'Імпасто',
  'Олійний живопис',
  'Колаж',
  'Змішана техніка',
  'Пастель',
  'Цифрове мистецтво',
  'Фотографія',
  'Скульптура',
  'Кераміка',
];

const COUNTRY_OPTIONS = ['Україна', 'ЄС', 'США'];
const DIRECTIONS = [
  { id: 'exhibition', label: 'Виставки' },
  { id: 'open_call', label: 'Конкурси / open call' },
  { id: 'grant', label: 'Гранти' },
  { id: 'residency', label: 'Резиденції' },
  { id: 'commercial', label: 'Комерційні запити' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Україна');
  const [city, setCity] = useState('');
  const [artistLevel, setArtistLevel] = useState('вільний художник');
  const [searchCountries, setSearchCountries] = useState<string[]>(['Україна']);
  const [directions, setDirections] = useState<string[]>(['exhibition', 'open_call']);
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);

  useEffect(() => {
    async function loadExistingProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUserId(user.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) setFullName(profile.full_name);
          if (profile.country) setCountry(profile.country);
          if (profile.city) setCity(profile.city);
          if (profile.artist_level) setArtistLevel(profile.artist_level);
          if (Array.isArray(profile.search_countries) && profile.search_countries.length) {
            setSearchCountries(profile.search_countries);
          }
          if (Array.isArray(profile.profile_techniques) && profile.profile_techniques.length) {
            setSelectedTechniques(profile.profile_techniques);
          } else if (Array.isArray(profile.techniques) && profile.techniques.length) {
            setSelectedTechniques(profile.techniques);
          }
        }
      } catch (err) {
        console.error('Помилка завантаження профілю:', err);
      } finally {
        setLoading(false);
      }
    }
    loadExistingProfile();
  }, [router]);

  const toggleIn = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const saveProgress = async (markCompleted = false) => {
    if (!userId) return false;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      country,
      city,
      artist_level: artistLevel,
      techniques: selectedTechniques,
      profile_techniques: selectedTechniques,
      search_countries: searchCountries,
      notifications_enabled: true,
      profile_completed: markCompleted,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      alert('Помилка збереження: ' + error.message);
      return false;
    }
    return true;
  };

  const next = async () => {
    if (step === 1 && !fullName.trim()) {
      alert('Вкажіть ПІБ або творчий псевдонім');
      return;
    }
    if (step === 3 && selectedTechniques.length === 0) {
      alert('Оберіть хоча б одну техніку');
      return;
    }
    const ok = await saveProgress(false);
    if (ok) setStep((s) => Math.min(s + 1, 5));
  };

  const finishToProfile = async () => {
    const ok = await saveProgress(true);
    if (ok) router.push('/profile');
  };

  const finishToDashboard = async () => {
    const ok = await saveProgress(true);
    if (ok) router.push('/dashboard');
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm border font-medium transition ${
      active
        ? 'bg-blue-600 border-blue-500 text-white'
        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
    }`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">Завантаження анкети...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-800/80 p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-6">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-sky-400' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-sky-400 text-xs font-semibold tracking-wide">POVODYR</p>
              <h1 className="text-2xl font-bold mt-1">Бачить можливості. Художник обирає шлях.</h1>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                POVODYR не показує все, що є в інтернеті. Він шукає те, що підходить саме вам.
              </p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Для цього йому потрібно познайомитися з вами: хто ви, де шукати і в яких техніках працюєте.
              </p>
            </div>
            <button type="button" onClick={() => setStep(1)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              Почати знайомство
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Хто ви як художник?</h1>
              <p className="text-slate-400 text-sm mt-1">Це основа персонального пошуку.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ПІБ / Творчий псевдонім *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="Введіть ваш псевдонім"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Країна проживання</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Місто</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="Київ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Рівень митця</label>
              <select
                value={artistLevel}
                onChange={(e) => setArtistLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="початківець">початківець</option>
                <option value="вільний художник">вільний художник</option>
                <option value="професіонал">професіонал</option>
              </select>
            </div>
            <button type="button" onClick={next} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              {saving ? 'Збереження...' : 'Далі'}
            </button>
            <button type="button" onClick={() => setStep(0)} className="w-full text-sm text-slate-400">
              Назад
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Що шукати для вас?</h1>
              <p className="text-slate-400 text-sm mt-1">Географія і напрями. Це можна змінити пізніше в профілі.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Країни пошуку</label>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_OPTIONS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleIn(searchCountries, setSearchCountries, c)}
                    className={chip(searchCountries.includes(c))}
                  >
                    {searchCountries.includes(c) ? '✓ ' : '+ '} {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Напрями</label>
              <div className="flex flex-wrap gap-2">
                {DIRECTIONS.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => toggleIn(directions, setDirections, d.id)}
                    className={chip(directions.includes(d.id))}
                  >
                    {directions.includes(d.id) ? '✓ ' : '+ '} {d.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={next} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              {saving ? 'Збереження...' : 'Далі'}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-slate-400">
              Назад
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">У яких техніках працюєте?</h1>
              <p className="text-slate-400 text-sm mt-1">Торкніться, щоб обрати.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TECHNIQUES.map((tech) => {
                const isSelected = selectedTechniques.includes(tech);
                return (
                  <button
                    type="button"
                    key={tech}
                    onClick={() => toggleIn(selectedTechniques, setSelectedTechniques, tech)}
                    className={chip(isSelected)}
                  >
                    {isSelected ? '✓ ' : '+ '} {tech}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={next} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              {saving ? 'Збереження...' : 'Далі'}
            </button>
            <button type="button" onClick={() => setStep(2)} className="w-full text-sm text-slate-400">
              Назад
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Покажіть свої роботи</h1>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Тоді POVODYR зможе підбирати не лише можливості для вас, а й конкретні твори під запити дизайнерів, готелів і галерей.
              </p>
            </div>
            <button type="button" onClick={finishToProfile} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              {saving ? 'Збереження...' : 'Додати роботи в профіль'}
            </button>
            <button type="button" onClick={() => setStep(5)} className="w-full text-sm text-slate-400">
              Зроблю пізніше
            </button>
            <button type="button" onClick={() => setStep(3)} className="w-full text-sm text-slate-500">
              Назад
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Готово. Шукаємо під ваш профіль</h1>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                Щодня POVODYR принесе добірки в «Сьогодні я знайшов для вас» і «Відібрав для вас».
              </p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Якщо за 7 днів знахідок мало — оновіть профіль, географію або техніки.
              </p>
            </div>
            <button type="button" onClick={finishToDashboard} disabled={saving} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              {saving ? 'Збереження...' : 'Перейти до перших знахідок'}
            </button>
            <button type="button" onClick={() => setStep(4)} className="w-full text-sm text-slate-400">
              Назад
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
