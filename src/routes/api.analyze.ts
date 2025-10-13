/**
 * API route for video analysis using Vertex AI
 * This provides actual video content analysis, not just text-based inference
 */

import * as z from 'zod'

import { createFileRoute } from '@tanstack/react-router'

import type { AnalyzeResponse } from '@/lib/analysis-schema'
import { analyzeRequestSchema } from '@/lib/analysis-schema'
import {
  calculateCost,
  getBudgetConfig,
  getGlobalDailySpend,
  getUserDailySpend,
  recordUsage,
} from '@/lib/billing'
import { CONFIG } from '@/config'
import { auth } from '@/lib/auth'
import {
  analyzeVideoChunked,
  analyzeVideoVertex,
} from '@/server/analyze-vertex'

export const Route = createFileRoute('/api/analyze')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const validatedData = analyzeRequestSchema.parse(body)
          const enableChunking = Boolean(body.enableChunking)
          const segmentDuration =
            typeof body.segmentDuration === 'number'
              ? body.segmentDuration
              : 180

          const session = await auth.api.getSession({
            headers: request.headers,
          })

          if (!session) {
            return buildUnauthorizedResponse()
          }

          const sessionData = session as Record<string, any> | null
          const userId = sessionData?.user?.id as string | undefined
          const sessionId =
            sessionData?.session?.id ??
            (typeof sessionData?.id === 'string'
              ? sessionData.id
              : undefined)

          const { userDailyLimitUsd, globalDailyLimitUsd } =
            getBudgetConfig()

          const [globalSpendBefore, userSpendBefore] = await Promise.all([
            getGlobalDailySpend(),
            userId ? getUserDailySpend(userId) : Promise.resolve(undefined),
          ])

          if (globalSpendBefore >= globalDailyLimitUsd) {
            return buildGlobalBudgetExceededResponse(
              globalDailyLimitUsd,
              globalSpendBefore,
            )
          }

          if (
            userId &&
            (userSpendBefore ?? 0) >= userDailyLimitUsd
          ) {
            return buildUserBudgetExceededResponse(
              userDailyLimitUsd,
              userSpendBefore ?? 0,
            )
          }

          const willChunk = enableChunking
          const segmentsEstimate = willChunk
            ? Math.max(1, Math.ceil((10 * 60) / segmentDuration))
            : 1
          const maxOutputTokens = willChunk ? 1024 : 2048
          const promptTokensGuess = willChunk ? 2000 : 3000
          const preflightUsd = estimateUpperCostUsd(CONFIG.MODEL, {
            isChunked: willChunk,
            segments: segmentsEstimate,
            maxOutputTokens,
            promptTokensGuess,
          })

          if (globalSpendBefore + preflightUsd >= globalDailyLimitUsd) {
            return buildGlobalBudgetExceededResponse(
              globalDailyLimitUsd,
              globalSpendBefore,
            )
          }

          if (
            userId &&
            userSpendBefore !== undefined &&
            userSpendBefore + preflightUsd >= userDailyLimitUsd
          ) {
            return buildUserBudgetExceededResponse(
              userDailyLimitUsd,
              userSpendBefore,
            )
          }

          console.log(
            `[API] Received analysis request for: ${validatedData.youtubeUrl}`,
          )
          console.log(
            `[API] Mode: Vertex AI with ${enableChunking ? `chunking (${segmentDuration}s)` : 'full video'}`,
          )

          const analysisOutcome = enableChunking
            ? await analyzeVideoChunked({
                ...validatedData,
                enableChunking,
                segmentDuration,
              })
            : await analyzeVideoVertex(validatedData)

          const result = analysisOutcome.response
          const usage = analysisOutcome.usage

          const billing = calculateCost(result.metadata.model, usage)

          let requestId: string | undefined
          try {
            requestId = await recordUsage({
              userId,
              sessionId,
              model: result.metadata.model,
              youtubeUrl: validatedData.youtubeUrl,
              usage,
              billing,
            })
          } catch (loggingError) {
            console.error('[Billing] Failed to record usage:', loggingError)
          }

          let globalSpendAfter = globalSpendBefore + billing.totalCostUsd
          let userSpendAfter =
            userId && userSpendBefore !== undefined
              ? userSpendBefore + billing.totalCostUsd
              : userSpendBefore

          try {
            const [refreshedGlobal, refreshedUser] = await Promise.all([
              getGlobalDailySpend(),
              userId ? getUserDailySpend(userId) : Promise.resolve(undefined),
            ])
            globalSpendAfter = refreshedGlobal
            userSpendAfter = refreshedUser
          } catch (refreshError) {
            console.warn('[Billing] Unable to refresh spend totals:', refreshError)
          }

          result.metadata.billing = {
            totalCostUsd: roundCurrency(billing.totalCostUsd),
            inputCostUsd: roundCurrency(billing.inputCostUsd),
            outputCostUsd: roundCurrency(billing.outputCostUsd),
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
            totalTokens: usage?.totalTokens,
            cachedContentTokens: usage?.cachedContentTokens,
            userDailyLimitUsd,
            globalDailyLimitUsd,
            userDailyTotalUsd:
              userSpendAfter !== undefined
                ? roundCurrency(userSpendAfter)
                : undefined,
            globalDailyTotalUsd: roundCurrency(globalSpendAfter),
            isUserCapped:
              userId !== undefined
                ? (userSpendAfter ?? 0) >= userDailyLimitUsd
                : undefined,
            isGlobalCapped: globalSpendAfter >= globalDailyLimitUsd,
            requestId,
          }

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (error) {
          console.error('[API] Analysis error:', error)

          if (error instanceof z.ZodError) {
            return buildValidationErrorResponse(error)
          }

          if (error instanceof SyntaxError) {
            return buildJsonParseErrorResponse(error)
          }

          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          const isAuthError =
            errorMessage.includes('credentials') ||
            errorMessage.includes('authentication')

          return buildAnalysisFailureResponse(errorMessage, isAuthError)
        }
      },
    },
  },
})

function estimateUpperCostUsd(
  model: string,
  opts: {
    isChunked: boolean
    segments: number
    maxOutputTokens: number
    promptTokensGuess?: number
  },
): number {
  const segments = Math.max(1, opts.segments || 1)
  const promptTokens = (opts.promptTokensGuess ?? 2000) * segments
  const completionTokens = opts.maxOutputTokens * segments
  const usage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cachedContentTokens: 0,
  }

  return calculateCost(model, usage).totalCostUsd
}

function buildUnauthorizedResponse(): Response {
  const { userDailyLimitUsd, globalDailyLimitUsd } = getBudgetConfig()

  const payload: AnalyzeResponse = {
    summary: 'Sign in to view analysis results',
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      model: 'unauthorized',
      processingTime: 0,
      analysisMode: 'text-based',
      billing: {
        totalCostUsd: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
        userDailyLimitUsd,
        globalDailyLimitUsd,
        isGlobalCapped: false,
      },
    },
    error:
      'Please sign in to run video analyses. Your prompt has not been processed yet.',
  }

  return new Response(JSON.stringify(payload), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildGlobalBudgetExceededResponse(
  limit: number,
  total: number,
): Response {
  const payload: AnalyzeResponse = {
    summary: 'Daily budget exhausted',
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      model: 'budget-exceeded',
      processingTime: 0,
      analysisMode: 'text-based',
      billing: {
        totalCostUsd: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
        globalDailyLimitUsd: limit,
        globalDailyTotalUsd: roundCurrency(total),
        isGlobalCapped: true,
      },
    },
    error: `The application has reached the global daily spending cap of $${limit.toFixed(2)}. Please try again after the budget resets (midnight UTC).`,
  }

  return new Response(JSON.stringify(payload), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildUserBudgetExceededResponse(
  limit: number,
  total: number,
): Response {
  const payload: AnalyzeResponse = {
    summary: 'Personal daily limit reached',
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      model: 'user-budget-exceeded',
      processingTime: 0,
      analysisMode: 'text-based',
      billing: {
        totalCostUsd: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
        userDailyLimitUsd: limit,
        userDailyTotalUsd: roundCurrency(total),
        isUserCapped: true,
      },
    },
    error: `You have reached the daily spending limit of $${limit.toFixed(2)} for your account. Your total for today is $${roundCurrency(total).toFixed(2)}.`,
  }

  return new Response(JSON.stringify(payload), {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildValidationErrorResponse(error: z.ZodError): Response {
  const payload: AnalyzeResponse = {
    summary: 'Validation Error',
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      model: 'error',
      processingTime: 0,
      analysisMode: 'text-based',
      billing: {
        totalCostUsd: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
      },
    },
    error: `Invalid input: ${error.issues
      .map((issue) => issue.message)
      .join(', ')}`,
  }

  return new Response(JSON.stringify(payload), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildJsonParseErrorResponse(_error: SyntaxError): Response {
  const payload: AnalyzeResponse = {
    summary: 'Invalid JSON payload',
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      model: 'error',
      processingTime: 0,
      analysisMode: 'text-based',
      billing: {
        totalCostUsd: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
      },
    },
    error: 'Request body must be valid JSON.',
  }

  return new Response(JSON.stringify(payload), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildAnalysisFailureResponse(
  message: string,
  authRelated: boolean,
): Response {
  const payload: AnalyzeResponse = {
    summary: authRelated ? 'Authentication Required' : 'Analysis Failed',
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      model: 'error',
      processingTime: 0,
      analysisMode: 'text-based',
      billing: {
        totalCostUsd: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
      },
    },
    error: authRelated
      ? 'Vertex AI requires Google Cloud authentication. Please configure GOOGLE_APPLICATION_CREDENTIALS or use Application Default Credentials.'
      : message,
  }

  return new Response(JSON.stringify(payload), {
    status: authRelated ? 401 : 500,
    headers: { 'Content-Type': 'application/json' },
  })
}

function roundCurrency(value: number, precision = 6): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}
