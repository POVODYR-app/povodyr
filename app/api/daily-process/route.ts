import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 хвилин (на Pro можна більше)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Перевірка секрету (обов'язково!)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET is not set');
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Тут поки що просто заглушка.
    // На наступних кроках ми додамо реальний пайплайн.
    console.log('Daily process started at', new Date().toISOString());

    // TODO: тут буде виклик runFullIngestPipeline()

    return NextResponse.json({
      success: true,
      message: 'Daily process endpoint is ready',
      timestamp: new Date().toISOString(),
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
