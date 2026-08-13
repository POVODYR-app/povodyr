import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Дозволяємо виклик від Vercel Cron
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

    return NextResponse.json({
      success: true,
      message: 'Daily process endpoint is ready',
      timestamp: new Date().toISOString(),
      triggeredBy: isVercelCron ? 'vercel-cron' : 'manual',
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
