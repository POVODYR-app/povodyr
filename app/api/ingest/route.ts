import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchFromApprovedSources } from '@/lib/parser'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const opportunities = await fetchFromApprovedSources()
    let insertedCount = 0

    for (const item of opportunities) {
      // Перевірка на наявність дубліката за посиланням
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id')
        .eq('link_url', item.link)
        .maybeSingle()

      if (!existing) {
        const { error } = await supabase.from('opportunities').insert({
          title: item.title,
          description: item.raw_description,
          link_url: item.link,
          source: item.source_name,
          category: item.opportunity_type,
          deadline: item.deadline,
          country: item.country,
          is_free: item.is_free,
          cost_amount: item.cost_amount,
          cost_currency: item.cost_currency,
          is_active: true,
          created_at: new Date().toISOString(),
        })

        if (!error) {
          insertedCount++
        } else {
          console.error('Помилка вставки в БД:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_fetched: opportunities.length,
      new_inserted: insertedCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Помилка під час виконання ingest:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
