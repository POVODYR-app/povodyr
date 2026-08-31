import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { personalizeOpportunities } from '../../../lib/personalizeOpportunities';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const userId = authData?.user?.id;
    if (authError || !userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: profileError?.message || 'Profile not found' }, { status: 404 });
    }

    const nowISO = new Date().toISOString();
    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('is_active', true)
      .or(`deadline.gte.${nowISO},deadline.is.null`)
      .order('created_at', { ascending: false })
      .limit(250);

    if (oppError) {
      return NextResponse.json({ success: false, error: oppError.message }, { status: 500 });
    }

    const personalized = personalizeOpportunities(profile, opportunities || [], {
      minScore: 48,
      limit: 20,
    });

    const digestIds = Array.from(
      new Set(
        personalized
          .map((item) => item.opportunity && item.opportunity.id)
          .filter((id) => typeof id === 'string' && id.length > 0)
      )
    );

    const runAt = new Date().toISOString();
    const { error: digestError } = await supabaseAdmin
      .from('profiles')
      .update({
        digest_opportunity_ids: digestIds,
        digest_run_at: runAt,
      })
      .eq('id', userId);

    if (digestError) {
      return NextResponse.json({ success: false, error: digestError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      digest_run_at: runAt,
      count: digestIds.length,
      digest_opportunity_ids: digestIds,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
