/**
 * API route for video analysis using Vertex AI
 * This provides actual video content analysis, not just text-based inference
 */

import * as z from 'zod'

import { createFileRoute } from '@tanstack/react-router'

import type { AnalyzeResponse } from '@/lib/analysis-schema'
import { analyzeRequestSchema } from '@/lib/analysis-schema'
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
          const session = await auth.api.getSession({
            headers: request.headers,
          })

          if (!session) {
            return new Response(
              JSON.stringify({
                summary: 'Authentication Required',
                metadata: {
                  analysisTimestamp: new Date().toISOString(),
                  model: 'unauthorized',
                  processingTime: 0,
                  analysisMode: 'text-based',
                },
                error: 'You must be signed in to analyze videos.',
              } satisfies AnalyzeResponse),
              {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Parse the request body
          const body = await request.json()

          // Validate the request data
          const validatedData = analyzeRequestSchema.parse(body)

          // Check if chunking is requested
          const enableChunking = body.enableChunking || false
          const segmentDuration = body.segmentDuration || 180

          console.log(
            `[API] Received analysis request for: ${validatedData.youtubeUrl}`,
          )
          console.log(
            `[API] Mode: Vertex AI with ${enableChunking ? `chunking (${segmentDuration}s)` : 'full video'}`,
          )

          // Perform the analysis using Vertex AI
          let result: AnalyzeResponse

          if (enableChunking) {
            result = await analyzeVideoChunked({
              ...validatedData,
              enableChunking,
              segmentDuration,
            })
          } else {
            result = await analyzeVideoVertex(validatedData)
          }

          // Return the analysis result
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (error) {
          console.error('[API] Analysis error:', error)

          // Handle validation errors
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({
                summary: 'Validation Error',
                metadata: {
                  analysisTimestamp: new Date().toISOString(),
                  model: 'error',
                  processingTime: 0,
                  analysisMode: 'text-based',
                },
                error: `Invalid input: ${error.errors.map((e) => e.message).join(', ')}`,
              } as AnalyzeResponse),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Handle authentication errors specially
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred'
          const isAuthError =
            errorMessage.includes('credentials') ||
            errorMessage.includes('authentication')

          return new Response(
            JSON.stringify({
              summary: isAuthError
                ? 'Authentication Required'
                : 'Analysis Failed',
              metadata: {
                analysisTimestamp: new Date().toISOString(),
                model: 'error',
                processingTime: 0,
                analysisMode: 'text-based',
              },
              error: isAuthError
                ? 'Vertex AI requires Google Cloud authentication. Please configure GOOGLE_APPLICATION_CREDENTIALS or use Application Default Credentials.'
                : errorMessage,
            } as AnalyzeResponse),
            {
              status: isAuthError ? 401 : 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
