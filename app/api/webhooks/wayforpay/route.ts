import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { planFromAmount, GRACE_DAYS } from '../../../../lib/access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const MERCHANT_SECRET = process.env.WAYFORPAY_SECRET_KEY || ''

function hmac(value: string) {
  return crypto.createHmac('md5', MERCHANT_SECRET).update(value, 'utf8').digest('hex')
}

function verifyIncoming(data: any) {
  if (!MERCHANT_SECRET) return false
  const parts = [
    data.merchantAccount,
    data.orderReference,
    data.amount,
    data.currency,
    data.authCode,
    data.cardPan,
    data.transactionStatus,
    data.reasonCode,
  ].map((v) => (v === undefined || v === null ? '' : String(v)))
  const expected = hmac(parts.join(';'))
  const got = String(data.merchantSignature || '')
  return expected.toLowerCase() === got.toLowerCase()
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

async function findUser(data: any) {
  const email = String(data.clientEmail || data.email || '').trim().toLowerCase()

  if (email) {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id, email, subscription_end, billing_exempt')
      .ilike('email', email)
      .maybeSingle()
    if (byEmail) return byEmail

    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = (usersData?.users || []).find(
      (u) => String(u.email || '').toLowerCase() === email
    )
    if (authUser) {
      const { data: byId } = await supabase
        .from('profiles')
        .select('id, email, subscription_end, billing_exempt')
        .eq('id', authUser.id)
        .maybeSingle()
      if (byId) {
        await supabase.from('profiles').update({ email }).eq('id', byId.id)
        return byId
      }
    }
  }

  const ref = String(data.orderReference || '')
  const m = ref.match(/^SUB-([0-9a-f-]{36})-/i)
  if (m) {
    const { data: byRef } = await supabase
      .from('profiles')
      .select('id, email, subscription_end, billing_exempt')
      .eq('id', m[1])
      .maybeSingle()
    if (byRef) return byRef
  }

  return null
}

  const ref = String(data.orderReference || '')
  const m = ref.match(/^SUB-([0-9a-f-]{36})-/i)
  if (m) {
    const { data: byId } = await supabase
      .from('profiles')
      .select('id, email, subscription_end, billing_exempt')
      .eq('id', m[1])
      .maybeSingle()
    if (byId) return byId
  }

  return null
}

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    let data: any = {}
    try {
      data = JSON.parse(raw)
    } catch {
      const params = new URLSearchParams(raw)
      params.forEach((v, k) => {
        data[k] = v
      })
    }

    if (data.merchantSignature && !verifyIncoming(data)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const status = String(data.transactionStatus || '')
    const user = await findUser(data)

    if (user && status === 'Approved') {
      const plan = planFromAmount(data.amount)
      const base =
        user.subscription_end && new Date(user.subscription_end) > new Date()
          ? new Date(user.subscription_end)
          : new Date()
      const end = addMonths(base, plan.months)

      await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          subscription_end: end.toISOString(),
          grace_until: null,
          wayforpay_rec_token: data.recToken || null,
          wayforpay_order_ref: data.orderReference || null,
          subscription_plan: plan.label,
        })
        .eq('id', user.id)
    }

    if (user && ['Declined', 'Expired', 'Refunded', 'Voided', 'Reasoned'].includes(status)) {
      const grace = new Date()
      grace.setDate(grace.getDate() + GRACE_DAYS)
      await supabase
        .from('profiles')
        .update({
          subscription_status: 'past_due',
          grace_until: grace.toISOString(),
        })
        .eq('id', user.id)
    }

    const time = Math.floor(Date.now() / 1000)
    const orderReference = String(data.orderReference || '')
    const signature = hmac(`${orderReference};ACCEPT;${time}`)

    return NextResponse.json({
      orderReference,
      status: 'ACCEPT',
      time,
      signature,
    })
  } catch (err: any) {
    console.error('WayForPay webhook error', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
