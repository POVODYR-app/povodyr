import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchFromApprovedSources } from '../../../lib/parser'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const fetchedItems = await fetchFromApprovedSources()
    const totalFetched = fetchedItems.length

    let newInserted = 0

    for (const item of fetchedItems) {
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id')
        .eq('link', item.link)
        .maybeSingle()

      if (!existing) {
        const { error } = await supabase
          .from('opportunities')
          .insert([item])

        if (!error) {
          newInserted++
        } else {
          console.error('Помилка вставки запису в Supabase:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_fetched: totalFetched,
      new_inserted: newInserted,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Помилка у роуті /api/ingest:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
