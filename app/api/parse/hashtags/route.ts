import { NextResponse } from 'next/server';
import { fetchOpportunitiesByHashtags, saveHashtagOpportunitiesToDb } from '@/lib/parsers/hashtags';

export async function GET() {
  try {
    const fetchedItems = await fetchOpportunitiesByHashtags();
    const savedCount = await saveHashtagOpportunitiesToDb(fetchedItems);

    return NextResponse.json({
      success: true,
      found: fetchedItems.length,
      saved: savedCount,
      hashtags: ['#opencall', '#мистецькийконкурс'],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET();
}
