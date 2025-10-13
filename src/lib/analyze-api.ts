/**
 * API client for video analysis using Vertex AI
 * No fallbacks - fails loudly if something goes wrong
 */

import type { AnalyzeFormData, AnalyzeResponse } from './analysis-schema'

export class AnalyzeApiError extends Error {
  readonly status: number
  readonly payload?: AnalyzeResponse

  constructor(message: string, status: number, payload?: AnalyzeResponse) {
    super(message)
    this.name = 'AnalyzeApiError'
    this.status = status
    this.payload = payload
  }
}

/**
 * Analyze video using Vertex AI - no fallbacks
 */
export async function analyzeVideo(
  data: AnalyzeFormData,
  options?: {
    enableChunking?: boolean
    segmentDuration?: number
  },
): Promise<AnalyzeResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      ...options,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | AnalyzeResponse
    | null

  if (!response.ok) {
    const message = payload?.error
      ? payload.error
      : `API request failed with status ${response.status}`
    throw new AnalyzeApiError(message, response.status, payload ?? undefined)
  }

  if (!payload) {
    throw new AnalyzeApiError(
      'API returned an empty response payload.',
      response.status,
    )
  }

  return payload
}
