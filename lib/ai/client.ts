/**
 * Єдиний шлюз LLM.
 * Навіщо: усі виклики OpenAI тільки звідси — облік токенів/USD,
 * стоп по денному/місячному бюджету, 1 ретрай на 429/5xx.
 * Cheap — парсинг, переклад, класифікація.
 * Quality — лише application_letter; виняток hard_parse.
 * Таблиці ai_usage/ai_cache підключаються на кроці 2; тут м’який fallback у лог.
 */
import OpenAI from 'openai'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AiTask =
  | 'application_letter'
  | 'hard_parse'
  | 'parse_fields'
  | 'commercial_extract'
  | 'classify_opencall'
  | 'why_recommended'
  | 'translate'
  | string

export type AiCompletePayload = {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  json?: boolean
  userId?: string | null
  source?: string
  cacheKey?: string
}

export type AiCompleteResult = {
  text: string
  model: string
  task: string
  inputTokens: number
  outputTokens: number
  usd: number
  cacheHit: boolean
  stoppedByBudget: boolean
}

export class AiBudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiBudgetExceededError'
  }
}

export class AiQualityNotAllowedError extends Error {
  constructor(task: string) {
    super(`completeQuality заборонено для task="${task}". Allowlist: application_letter, hard_parse.`)
    this.name = 'AiQualityNotAllowedError'
  }
}

const QUALITY_ALLOWLIST = ['application_letter', 'hard_parse']

const DEFAULT_CHEAP_MODEL = 'gpt-4o-mini'
const DEFAULT_QUALITY_MODEL = 'gpt-4o-mini'

/** USD за 1M токенів. Перевизначається env, без секретів. */
const DEFAULT_INPUT_USD_PER_M = 0.15
const DEFAULT_OUTPUT_USD_PER_M = 0.6

function envString(name: string, fallback: string) {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : fallback
}

function envNumber(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function cheapModel() {
  return envString('AI_CHEAP_MODEL', DEFAULT_CHEAP_MODEL)
}

function qualityModel() {
  return envString('AI_QUALITY_MODEL', DEFAULT_QUALITY_MODEL)
}

function inputRate(model: string) {
  if (model.indexOf('gpt-4o-mini') >= 0) return envNumber('AI_USD_PER_1M_INPUT', DEFAULT_INPUT_USD_PER_M)
  return envNumber('AI_USD_PER_1M_INPUT_QUALITY', 2.5)
}

function outputRate(model: string) {
  if (model.indexOf('gpt-4o-mini') >= 0) return envNumber('AI_USD_PER_1M_OUTPUT', DEFAULT_OUTPUT_USD_PER_M)
  return envNumber('AI_USD_PER_1M_OUTPUT_QUALITY', 10)
}

function estimateUsd(model: string, inputTokens: number, outputTokens: number) {
  return (inputTokens / 1_000_000) * inputRate(model) + (outputTokens / 1_000_000) * outputRate(model)
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10)
}

function monthPrefix() {
  return new Date().toISOString().slice(0, 7)
}

let cachedAdmin: SupabaseClient | null = null

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!cachedAdmin) cachedAdmin = createClient(url, key)
  return cachedAdmin
}

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY не налаштовано')
  return new OpenAI({ apiKey })
}

async function spentUsdSince(fromIso: string): Promise<number | null> {
  const db = adminClient()
  if (!db) return null
  try {
    const { data, error } = await db.from('ai_usage').select('usd').gte('created_at', fromIso)
    if (error || !data) return null
    let sum = 0
    const rows = Array.from(data)
    for (let i = 0; i < rows.length; i++) {
      sum += Number((rows[i] as { usd?: number }).usd || 0)
    }
    return sum
  } catch {
    return null
  }
}

async function assertBudget() {
  const dailyCap = envNumber('AI_DAILY_BUDGET_USD', 3)
  const monthlyCap = envNumber('AI_MONTHLY_BUDGET_USD', 40)

  const now = new Date()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const daySpent = await spentUsdSince(dayStart)
  const monthSpent = await spentUsdSince(monthStart)

  if (daySpent !== null && daySpent >= dailyCap) {
    throw new AiBudgetExceededError(
      `AI daily budget exceeded: ${daySpent.toFixed(4)} >= ${dailyCap} USD`
    )
  }
  if (monthSpent !== null && monthSpent >= monthlyCap) {
    throw new AiBudgetExceededError(
      `AI monthly budget exceeded: ${monthSpent.toFixed(4)} >= ${monthlyCap} USD`
    )
  }

  if (monthSpent !== null && monthSpent > monthlyCap * 0.2) {
    const dayShare = daySpent === null ? 0 : daySpent
    if (dayShare > monthlyCap * 0.2) {
      console.warn(
        `[ai] ALERT day spend ${dayShare.toFixed(4)} USD > 20% of monthly cap ${monthlyCap}`
      )
    }
  }
}

async function logUsage(row: {
  task: string
  model: string
  inputTokens: number
  outputTokens: number
  usd: number
  cacheHit: boolean
  source?: string
  userId?: string | null
}) {
  console.log(
    `[ai] task=${row.task} model=${row.model} in=${row.inputTokens} out=${row.outputTokens} usd=${row.usd.toFixed(6)} cache=${row.cacheHit} source=${row.source || '-'} date=${todayUtcDate()} month=${monthPrefix()}`
  )

  const db = adminClient()
  if (!db) return
  try {
    await db.from('ai_usage').insert({
      created_at: new Date().toISOString(),
      user_id: row.userId || null,
      task: row.task,
      model: row.model,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      usd: row.usd,
      cache_hit: row.cacheHit,
      source: row.source || null,
    })
  } catch (err) {
    console.warn('[ai] ai_usage insert skipped', err)
  }
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500
}

function errorStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const anyErr = err as { status?: number; statusCode?: number }
  if (typeof anyErr.status === 'number') return anyErr.status
  if (typeof anyErr.statusCode === 'number') return anyErr.statusCode
  return null
}

async function callOpenAi(model: string, payload: AiCompletePayload) {
  const client = getOpenAi()
  const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: payload.messages,
    temperature: payload.temperature ?? 0.2,
    max_tokens: payload.maxTokens,
    response_format: payload.json ? { type: 'json_object' } : undefined,
  }

  try {
    return await client.chat.completions.create(body)
  } catch (err) {
    const status = errorStatus(err)
    if (status !== null && isRetryableStatus(status)) {
      console.warn(`[ai] retry once after ${status}`)
      return await client.chat.completions.create(body)
    }
    throw err
  }
}

async function completeWithModel(
  task: AiTask,
  payload: AiCompletePayload,
  model: string
): Promise<AiCompleteResult> {
  await assertBudget()

  const completion = await callOpenAi(model, payload)
  const text = completion.choices[0]?.message?.content || ''
  const inputTokens = completion.usage?.prompt_tokens || 0
  const outputTokens = completion.usage?.completion_tokens || 0
  const usd = estimateUsd(model, inputTokens, outputTokens)

  await logUsage({
    task: String(task),
    model,
    inputTokens,
    outputTokens,
    usd,
    cacheHit: false,
    source: payload.source,
    userId: payload.userId,
  })

  return {
    text,
    model,
    task: String(task),
    inputTokens,
    outputTokens,
    usd,
    cacheHit: false,
    stoppedByBudget: false,
  }
}

export async function completeCheap(task: AiTask, payload: AiCompletePayload) {
  return completeWithModel(task, payload, cheapModel())
}

export async function completeQuality(task: AiTask, payload: AiCompletePayload) {
  const allowed = QUALITY_ALLOWLIST.indexOf(String(task)) >= 0
  if (!allowed) throw new AiQualityNotAllowedError(String(task))
  return completeWithModel(task, payload, qualityModel())
}
