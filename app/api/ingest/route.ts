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
  const logs: string[] = []

  try {
    logs.push('Запуск парсингу джерел...')
    const fetchedItems = await fetchFromApprovedSources()
    logs.push(`Отримано елементів з парсера: ${fetchedItems.length}`)

    let newInserted = 0
    const errors: string[] = []

    for (const item of fetchedItems) {
      logs.push(`Обробка: ${item.title} (${item.link})`)
      
      const { data: existing, error: selectError } = await supabase
        .from('opportunities')
        .select('id')
        .eq('link', item.link)
        .maybeSingle()

      if (selectError) {
        errors.push(`Помилка перевірки Supabase: ${selectError.message}`)
        continue
      }

      if (!existing) {
        const { error: insertError } = await supabase
          .from('opportunities')
          .insert([item])

        if (!insertError) {
          newInserted++
          logs.push(`Успішно збережено: ${item.link}`)
        } else {
          errors.push(`Помилка вставки (${item.link}): ${insertError.message}`)
        }
      } else {
        logs.push(`Запис вже існує в базі: ${item.link}`)
      }
    }

    return NextResponse.json(
      {
        success: true,
        total_fetched: fetchedItems.length,
        new_inserted: newInserted,
        execution_logs: logs,
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
      { 
        success: false, 
        error: error.message,
        execution_logs: logs
      },
      { status: 500 }
    )
  }
}
