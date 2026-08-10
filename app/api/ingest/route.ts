import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchFromApprovedSources } from '../../../lib/parser'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const fetchedItems = await fetchFromApprovedSources()
    const totalFetched = fetchedItems.length

    let newInserted = 0
    const errors: string[] = []

    for (const item of fetchedItems) {
      const { data: existing, error: selectError } = await supabase
        .from('opportunities')
        .select('id')
        .eq('link', item.link)
        .maybeSingle()

      if (selectError) {
        errors.push(`Помилка перевірки: ${selectError.message}`)
        continue
      }

      if (!existing) {
        const { error: insertError } = await supabase
          .from('opportunities')
          .insert([item])

        if (!insertError) {
          newInserted++
        } else {
          errors.push(`Помилка запису ${item.link}:${insertError.message}`)
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        total_fetched: totalFetched,
        new_inserted: newInserted,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
