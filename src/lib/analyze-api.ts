/**
 * API client for video analysis using Vertex AI
 * No fallbacks - fails loudly if something goes wrong
 */

import type { AnalyzeFormData, AnalyzeResponse } from './analysis-schema'

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

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(
      error?.error || `API request failed with status ${response.status}`,
    )
  }

  return response.json()
}
