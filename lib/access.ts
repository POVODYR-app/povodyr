export type AccessProfile = {
  id?: string
  created_at?: string | null
  billing_exempt?: boolean | null
  subscription_status?: string | null
  subscription_end?: string | null
  grace_until?: string | null
}

export const TRIAL_DAYS = 14
export const GRACE_DAYS = 7

export const PLANS = {
  month: { amount: 149, months: 1, label: '1 місяць' },
  halfyear: { amount: 849, months: 6, label: '6 місяців' },
  year: { amount: 1698, months: 12, label: '1 рік' },
} as const

export function planFromAmount(amount: number | string | null | undefined) {
  const n = Number(amount)
  if (n === PLANS.year.amount) return PLANS.year
  if (n === PLANS.halfyear.amount) return PLANS.halfyear
  if (n === PLANS.month.amount) return PLANS.month
  return PLANS.month
}

export function trialEndsAt(profile: AccessProfile) {
  if (!profile.created_at) return null
  const start = new Date(profile.created_at)
  const end = new Date(start)
  end.setDate(end.getDate() + TRIAL_DAYS)
  return end
}

export function isInTrial(profile: AccessProfile, now = new Date()) {
  if (profile.billing_exempt) return false
  if (profile.subscription_status === 'active' && profile.subscription_end) return false
  const end = trialEndsAt(profile)
  return !!end && end > now
}

export function hasPaidAccess(profile: AccessProfile | null | undefined, now = new Date()) {
  if (!profile) return false
  if (profile.billing_exempt) return true
  if (profile.subscription_status === 'active' && profile.subscription_end) {
    if (new Date(profile.subscription_end) > now) return true
  }
  if (profile.subscription_status === 'past_due' && profile.grace_until) {
    if (new Date(profile.grace_until) > now) return true
  }
  if (isInTrial(profile, now)) return true
  return false
}

export function accessReason(profile: AccessProfile, now = new Date()) {
  if (profile.billing_exempt) return 'exempt'
  if (
    profile.subscription_status === 'active' &&
    profile.subscription_end &&
    new Date(profile.subscription_end) > now
  ) {
    return 'paid'
  }
  if (
    profile.subscription_status === 'past_due' &&
    profile.grace_until &&
    new Date(profile.grace_until) > now
  ) {
    return 'grace'
  }
  if (isInTrial(profile, now)) return 'trial'
  return 'locked'
}
