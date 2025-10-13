import crypto from 'node:crypto'

import type { UsageMetadata } from '@google-cloud/vertexai'
import { db } from '@/lib/db'

const USER_DAILY_LIMIT_USD = parseBudget(
  process.env.BILLING_USER_DAILY_LIMIT_USD,
  3,
)
const GLOBAL_DAILY_LIMIT_USD = parseBudget(
  process.env.BILLING_GLOBAL_DAILY_LIMIT_USD,
  10,
)

type PricingMap = Record<string, { inputPerMillion: number; outputPerMillion: number }>

const DEFAULT_PRICING: PricingMap = {
  'gemini-1.5-pro': { inputPerMillion: 7, outputPerMillion: 21 },
  'gemini-1.5-flash': { inputPerMillion: 0.35, outputPerMillion: 0.7 },
  'gemini-2.0-flash': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gemini-2.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
}

const pricingOverrides = safeParsePricingOverrides(
  process.env.BILLING_PRICING_OVERRIDES,
)

const RESOLVED_PRICING: PricingMap = {
  ...DEFAULT_PRICING,
  ...pricingOverrides,
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedContentTokens: number
}

export interface BillingComputation {
  usage: TokenUsage | null
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
}

export interface RecordUsageParams {
  userId?: string | null
  sessionId?: string | null
  model: string
  youtubeUrl?: string | null
  usage: TokenUsage | null
  billing: BillingComputation
}

export function normalizeUsage(usage?: UsageMetadata | null): TokenUsage | null {
  if (!usage) {
    return null
  }

  const prompt = usage.promptTokenCount ?? 0
  const completion = usage.candidatesTokenCount ?? 0
  const total =
    usage.totalTokenCount ??
    (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0)
  const cached = usage.cachedContentTokenCount ?? 0

  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    cachedContentTokens: cached,
  }
}

export function mergeUsage(usages: Array<TokenUsage | null | undefined>): TokenUsage | null {
  const accumulator = usages.reduce<TokenUsage | null>((acc, current) => {
    if (!current) return acc

    if (!acc) {
      return { ...current }
    }

    return {
      promptTokens: acc.promptTokens + current.promptTokens,
      completionTokens: acc.completionTokens + current.completionTokens,
      totalTokens: acc.totalTokens + current.totalTokens,
      cachedContentTokens: acc.cachedContentTokens + current.cachedContentTokens,
    }
  }, null)

  return accumulator
}

export function calculateCost(model: string, usage: TokenUsage | null): BillingComputation {
  if (!usage) {
    return {
      usage: null,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
    }
  }

  const pricing = resolvePricing(model)
  const billablePromptTokens = Math.max(
    0,
    usage.promptTokens - usage.cachedContentTokens,
  )
  const inputCost =
    (billablePromptTokens / 1_000_000) * pricing.inputPerMillion
  const outputCost =
    (usage.completionTokens / 1_000_000) * pricing.outputPerMillion
  const total = inputCost + outputCost

  return {
    usage,
    inputCostUsd: inputCost,
    outputCostUsd: outputCost,
    totalCostUsd: total,
  }
}

export async function recordUsage({
  userId,
  sessionId,
  model,
  youtubeUrl,
  usage,
  billing,
}: RecordUsageParams) {
  const requestId = crypto.randomUUID()

  await db
    .insertInto('billing_usage_ledger')
    .values({
      request_id: requestId,
      user_id: userId ?? null,
      session_id: sessionId ?? null,
      model,
      prompt_token_count: usage?.promptTokens ?? null,
      candidates_token_count: usage?.completionTokens ?? null,
      total_token_count: usage?.totalTokens ?? null,
      cached_content_token_count: usage?.cachedContentTokens ?? null,
      input_cost_usd: billing.inputCostUsd,
      output_cost_usd: billing.outputCostUsd,
      cost_usd: billing.totalCostUsd,
      currency: 'USD',
      youtube_url: youtubeUrl ?? null,
    })
    .executeTakeFirst()

  return requestId
}

export async function getGlobalDailySpend(): Promise<number> {
  const row = await db
    .selectFrom('billing_usage_ledger')
    .select((eb) =>
      eb
        .fn.coalesce(
          eb.fn.sum<number>('billing_usage_ledger.cost_usd'),
          eb.val<number>(0),
        )
        .as('total'),
    )
    .where('created_at', '>=', startOfUtcDay())
    .executeTakeFirst()

  return row?.total ?? 0
}

export async function getUserDailySpend(userId: string): Promise<number> {
  const row = await db
    .selectFrom('billing_usage_ledger')
    .select((eb) =>
      eb
        .fn.coalesce(
          eb.fn.sum<number>('billing_usage_ledger.cost_usd'),
          eb.val<number>(0),
        )
        .as('total'),
    )
    .where('user_id', '=', userId)
    .where('created_at', '>=', startOfUtcDay())
    .executeTakeFirst()

  return row?.total ?? 0
}

export async function hasReachedGlobalLimit(bufferUsd = 0): Promise<boolean> {
  const total = await getGlobalDailySpend()
  return total + bufferUsd >= GLOBAL_DAILY_LIMIT_USD
}

export async function hasReachedUserLimit(
  userId: string,
  bufferUsd = 0,
): Promise<boolean> {
  const total = await getUserDailySpend(userId)
  return total + bufferUsd >= USER_DAILY_LIMIT_USD
}

export function getBudgetConfig() {
  return {
    userDailyLimitUsd: USER_DAILY_LIMIT_USD,
    globalDailyLimitUsd: GLOBAL_DAILY_LIMIT_USD,
  }
}

function resolvePricing(model: string) {
  const normalized = model.toLowerCase()
  if (!Object.hasOwn(RESOLVED_PRICING, normalized)) {
    throw new Error(
      `No billing pricing configured for model "${model}". Set BILLING_PRICING_OVERRIDES or update DEFAULT_PRICING.`,
    )
  }

  return RESOLVED_PRICING[normalized]
}

function parseBudget(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number(raw)
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid budget value provided: ${raw}`)
  }
  return parsed
}

function safeParsePricingOverrides(raw: string | undefined): PricingMap {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as PricingMap
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key.toLowerCase(),
        {
          inputPerMillion: Number(value.inputPerMillion),
          outputPerMillion: Number(value.outputPerMillion),
        },
      ]),
    )
  } catch (error) {
    throw new Error(
      `Failed to parse BILLING_PRICING_OVERRIDES. Expected JSON object mapping model names to { inputPerMillion, outputPerMillion } numbers. Original error: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
}
