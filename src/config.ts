/**
 * Centralized configuration with no fallbacks
 * App fails loudly if configuration is missing
 */

export const CONFIG = {
  // Model configuration - single source of truth
  MODEL: process.env.DEFAULT_MODEL || 'gemini-2.5-pro',

  // Google Cloud configuration
  GOOGLE_CLOUD_PROJECT:
    process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0487815497',
  GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',

  // Video chunking configuration
  ENABLE_CHUNKING: process.env.ENABLE_CHUNKING === 'true',
  SEGMENT_DURATION: parseInt(process.env.SEGMENT_DURATION || '180'),
} as const

// Validate required configuration at startup
export function validateConfig(): void {
  if (!CONFIG.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required but not configured')
  }

  if (!CONFIG.MODEL) {
    throw new Error('DEFAULT_MODEL is required but not configured')
  }

  // Log configuration for transparency
  console.log('[Config] Using configuration:', {
    model: CONFIG.MODEL,
    project: CONFIG.GOOGLE_CLOUD_PROJECT,
    location: CONFIG.GOOGLE_CLOUD_LOCATION,
  })
}
