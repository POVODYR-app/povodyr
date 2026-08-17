import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Отримує відфільтровані актуальні можливості через RPC-функцію бази даних
 * Використовується для вебдодатка та Telegram-бота
 */
export async function fetchActiveOpportunities() {
  try {
    const { data, error } = await supabase.rpc('get_active_opportunities')

    if (error) {
      console.error('Помилка отримання можливостей з Supabase:', error.message)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Непередбачена помилка під час запиту:', err)
    return []
  }
}
