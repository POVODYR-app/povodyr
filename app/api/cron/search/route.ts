import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // 1. Отримуємо активних користувачів із заповненим профілем
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .eq('notifications_enabled', true)
      .eq('profile_completed', true)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'Немає активних профілів для пошуку' })
    }

    // 2. Симуляція/збір даних (парсер шукає нові виставки та гранти)
    // У реальному середовищі тут виконується fetch() до джерел (наприклад, Artopps, CallForEntries тощо)
    const mockOpportunities = [
      {
        title: 'Міжнародна виставка сучасного колажу та графіки',
        type: 'exhibition',
        country: 'Україна',
        fee_amount: 0,
        fee_currency: 'UAH',
        techniques: ['Колаж', 'Графіка'],
        description: 'Безкоштовна участь для українських митців.',
        link: 'https://example.com/exhibition-1'
      },
      {
        title: 'Європейський грант для живописців',
        type: 'grant',
        country: 'ЄС',
        fee_amount: 20,
        fee_currency: 'EUR',
        techniques: ['Олійний живопис', 'Акрил', 'Змішана техніка'],
        description: 'Фінансування матеріалів та оренди майстерні.',
        link: 'https://example.com/grant-eu-2024'
      }
    ]

    // 3. Зберігаємо нові можливості в базу
    for (const opp of mockOpportunities) {
      await supabase
        .from('opportunities')
        .upsert(opp, { onConflict: 'link' })
    }

    // 4. Фільтрація під кожного користувача
    const results = []

    for (const user of users) {
      // Отримуємо всі нові можливості
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('*')

      if (!opportunities) continue

      // Фільтруємо за країнами, техніками та максимальним внеском
      const matched = opportunities.filter(opp => {
        const matchCountry = user.search_countries?.includes(opp.country)
        const matchTechnique = opp.techniques?.some((t: string) => user.techniques?.includes(t))
        
        // Перевірка допустимого внеску
        const matchFee = opp.fee_amount === 0 || (
          opp.type === 'exhibition' 
            ? opp.fee_amount <= (user.org_fee_max || 0)
            : opp.fee_amount <= (user.reg_fee_max || 0)
        )

        return matchCountry && matchTechnique && matchFee
      })

      results.push({
        userId: user.id,
        userName: user.full_name,
        matchedCount: matched.length,
        opportunities: matched
      })
    }

    return NextResponse.json({
      success: true,
      processedUsers: users.length,
      results
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
