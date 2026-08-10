import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Помилка з\'єднання з Supabase',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      database: {
        connected: true,
        total_opportunities: count || 0,
      },
      cron_endpoints: [
        '/api/ingest',
        '/api/daily-notification',
        '/api/parse/hashtags'
      ],
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
