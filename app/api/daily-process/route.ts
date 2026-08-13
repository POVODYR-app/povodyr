import { NextRequest, NextResponse } from 'next/server';
import { fetchFromApprovedSources } from '../../../lib/parser';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!cronSecret) {
    console.error('CRON_SECRET is not set');
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration: CRON_SECRET missing' },
      { status: 500 }
    );
  }

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` || isVercelCron;

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Daily process started at', new Date().toISOString());

    const logs: string[] = [];
    const opportunities = await fetchFromApprovedSources(logs);

    console.log('Parsing logs:', logs);
    console.log(`Знайдено можливостей: ${opportunities.length}`);

    return NextResponse.json({
      success: true,
      message: 'Daily process completed',
      timestamp: new Date().toISOString(),
      triggeredBy: isVercelCron ? 'vercel-cron' : 'manual',
      found: opportunities.length,
      logs,
      // Показуємо перші 3 для перевірки (пізніше приберемо)
      sample: opportunities.slice(0, 3).map((o) => ({
        title: o.title,
        source: o.source_name,
        link: o.link,
      })),
    });
  } catch (error) {
    console.error('Daily process failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
