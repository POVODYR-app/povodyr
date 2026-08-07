'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Україна');
  const [city, setCity] = useState('');
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);

  const techniquesList = [
    'Акварель', 'Акрил', 'Графіка', 'Гуаш', 'Імпасто', 'Олійний живопис', 'Цифрове мистецтво', 'Скульптура'
  ];

  useEffect(() => {
    async function loadExistingProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.full_name) setFullName(profile.full_name);
          if (profile.country) setCountry(profile.country);
          if (profile.city) setCity(profile.city);
          if (profile.techniques && Array.isArray(profile.techniques)) {
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

  const toggleTechnique = (tech: string) => {
    if (selectedTechniques.includes(tech)) {
      setSelectedTechniques(selectedTechniques.filter(t => t !== tech));
    } else {
      setSelectedTechniques([...selectedTechniques, tech]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName,
        country,
        city,
        techniques: selectedTechniques,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert('Помилка збереження: ' + error.message);
    } else {
      router.push('/dashboard');
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold text-center">Анкета художника</h1>
          <p className="text-slate-400 text-sm text-center mt-1">
            Заповніть профіль для створення персонального алгоритму пошуку
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium mb-2">Техніки (торкніться для вибору):</label>
            <div className="flex flex-wrap gap-2">
              {techniquesList.map((tech) => {
                const isSelected = selectedTechniques.includes(tech);
                return (
                  <button
                    type="button"
                    key={tech}
                    onClick={() => toggleTechnique(tech)}
                    className={`px-3 py-2 rounded-lg text-sm border font-medium transition ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '} {tech}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition mt-6"
          >
            Зберегти профіль
          </button>
        </form>
      </div>
    </div>
  );
}
