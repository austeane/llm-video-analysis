import * as z from 'zod'

// YouTube URL validation regex
const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}(?:\S+)?$/

// Request schema for video analysis
export const analyzeRequestSchema = z.object({
  youtubeUrl: z
    .string()
    .min(1, 'YouTube URL is required')
    .regex(YOUTUBE_URL_REGEX, 'Please enter a valid YouTube URL'),
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(500, 'Prompt must be less than 500 characters'),
})

export type AnalyzeFormData = z.infer<typeof analyzeRequestSchema>

// Response schema for analysis results
const billingMetadataSchema = z.object({
  totalCostUsd: z.number(),
  inputCostUsd: z.number(),
  outputCostUsd: z.number(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  cachedContentTokens: z.number().optional(),
  userDailyLimitUsd: z.number().optional(),
  globalDailyLimitUsd: z.number().optional(),
  userDailyTotalUsd: z.number().optional(),
  globalDailyTotalUsd: z.number().optional(),
  isUserCapped: z.boolean().optional(),
  isGlobalCapped: z.boolean().optional(),
  requestId: z.string().optional(),
})

export const analyzeResponseSchema = z.object({
  summary: z.string(),
  metadata: z
    .object({
      videoTitle: z.string().optional(),
      videoDuration: z.number().optional(), // in seconds
      analysisTimestamp: z.string(),
      model: z.string(),
      processingTime: z.number(), // in milliseconds
      analysisMode: z.enum(['direct-video', 'text-based']).optional(), // How the analysis was performed
    })
    .extend({
      billing: billingMetadataSchema.optional(),
    }),
  sections: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
        timestamp: z.number().optional(), // video timestamp in seconds
      }),
    )
    .optional(),
  rawAnalysis: z.string().optional(),
  error: z.string().optional(),
})

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>
export type AnalyzeBillingMetadata = z.infer<typeof billingMetadataSchema>

// Environment configuration schema - no defaults, fail if not set
export const envSchema = z.object({
  GOOGLE_CLOUD_PROJECT: z.string(),
  GOOGLE_CLOUD_LOCATION: z.string(),
  DEFAULT_MODEL: z.string(),
  ENABLE_CHUNKING: z.boolean(),
  SEGMENT_DURATION: z.number(),
})

export type EnvConfig = z.infer<typeof envSchema>
