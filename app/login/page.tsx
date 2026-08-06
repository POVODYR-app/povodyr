'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError('Невірний email або пароль');
      setLoading(false);
    } else if (data?.session) {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-4 bg-slate-900 text-white">
      <div className="w-full max-w-sm space-y-6 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
        <h1 className="text-2xl font-bold text-center">Вхід у POVODYR</h1>
        
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 text-red-200 text-sm rounded text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded font-medium transition disabled:opacity-50 text-base mt-2"
          >
            {loading ? 'Завантаження...' : 'Увійти'}
          </button>
        </form>
      </div>
    </main>
  );
}
