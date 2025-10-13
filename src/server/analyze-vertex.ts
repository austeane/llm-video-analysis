/**
 * Vertex AI video analysis implementation matching analyze_video.py
 * This provides ACTUAL video content analysis, not just text-based inference
 */

import {
  HarmBlockThreshold,
  HarmCategory,
  VertexAI,
} from '@google-cloud/vertexai'

import type { AnalyzeFormData, AnalyzeResponse } from '@/lib/analysis-schema'
import type { TokenUsage } from '@/lib/billing'
import { mergeUsage, normalizeUsage } from '@/lib/billing'
import { CONFIG, validateConfig } from '@/config'
import { extractVideoId } from '@/lib/youtube-utils'

// Validate configuration on module load
validateConfig()

export interface VertexAnalysisResult {
  response: AnalyzeResponse
  usage: TokenUsage | null
}

/**
 * Initialize Vertex AI client
 */
function getVertexClient() {
  // No fallbacks - use centralized config
  return new VertexAI({
    project: CONFIG.GOOGLE_CLOUD_PROJECT,
    location: CONFIG.GOOGLE_CLOUD_LOCATION,
  })
}

/**
 * Analyze video using Vertex AI with direct video file support
 * This matches the Python script's approach of analyzing actual video content
 */
export async function analyzeVideoVertex(
  data: AnalyzeFormData,
): Promise<VertexAnalysisResult> {
  const startTime = Date.now()

  try {
    // Initialize Vertex AI
    const vertexAI = getVertexClient()
    const modelName = CONFIG.MODEL

    // Get the generative model
    const generativeModel = vertexAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        topK: 40,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    })

    // Extract video ID for logging
    const videoId = extractVideoId(data.youtubeUrl) || 'unknown'

    if (!/^https?:\/\//i.test(data.youtubeUrl)) {
      throw new Error(
        'Unsupported video URI. Provide an HTTP(S) URL or upload the asset before analysis.',
      )
    }

    console.log(
      `[Vertex AI] Analyzing video ${videoId} with model ${modelName}`,
    )

    /**
     * IMPORTANT: This is where we match the Python script's approach
     *
     * Python version:
     * ```python
     * contents = [
     *   types.Part(file_data=types.FileData(
     *     file_uri=youtube_url,
     *     mime_type="video/mp4"
     *   )),
     *   types.Part(text=prompt)
     * ]
     * ```
     *
     * JavaScript/TypeScript version with Vertex AI:
     */
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType: 'video/mp4',
                fileUri: data.youtubeUrl, // Vertex AI can fetch YouTube videos directly!
              },
            },
            {
              text: `Please analyze this video and ${data.prompt}.
                     Provide a structured analysis with:
                     1. A brief summary (2-3 sentences)
                     2. Detailed sections covering different aspects
                     3. Key insights and takeaways
                     4. Include approximate timestamps where relevant`,
            },
          ],
        },
      ],
    }

    // Generate content with actual video analysis
    const result = await generativeModel.generateContent(request)
    const response = result.response
    const usage = normalizeUsage(response.usageMetadata)

    // Extract text from response
    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        ?.filter(Boolean)
        ?.join('\n') || 'No response generated'

    // Parse response into sections
    const sections = parseResponseIntoSections(text)

    // Extract summary (first paragraph or section)
    const summary =
      sections.length > 0
        ? sections[0].content.split('\n')[0]
        : text.substring(0, 200)

    const analysisResponse: AnalyzeResponse = {
      summary,
      metadata: {
        videoTitle: `Video Analysis (${videoId})`,
        videoDuration: undefined, // TODO: Extract from video metadata
        analysisTimestamp: new Date().toISOString(),
        model: modelName,
        processingTime: Date.now() - startTime,
        analysisMode: 'direct-video', // We're analyzing the actual video!
      },
      sections: sections.slice(1), // Skip the summary section
      rawAnalysis: text,
    }

    console.log(
      `[Vertex AI] Analysis completed in ${analysisResponse.metadata.processingTime}ms`,
    )
    return {
      response: analysisResponse,
      usage,
    }
  } catch (error) {
    console.error('[Vertex AI] Analysis error:', error)

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during video analysis'

    // Check if it's an authentication error
    if (
      errorMessage.includes('credentials') ||
      errorMessage.includes('authentication')
    ) {
      return {
        response: {
          summary: 'Authentication Error',
          metadata: {
            analysisTimestamp: new Date().toISOString(),
            model: 'error',
            processingTime: Date.now() - startTime,
            analysisMode: 'direct-video',
          },
          error:
            'Vertex AI authentication failed. Please configure Google Cloud credentials.',
        },
        usage: null,
      }
    }

    return {
      response: {
        summary: 'Analysis Failed',
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          model: 'error',
          processingTime: Date.now() - startTime,
          analysisMode: 'direct-video',
        },
        error: errorMessage,
      },
      usage: null,
    }
  }
}

/**
 * Analyze video with chunking for long videos
 * This matches the Python script's chunking functionality
 */
export async function analyzeVideoChunked(
  data: AnalyzeFormData & {
    enableChunking?: boolean
    segmentDuration?: number // seconds
    maxWorkers?: number
  },
): Promise<VertexAnalysisResult> {
  const startTime = Date.now()

  // Configuration
  const segmentDuration = data.segmentDuration || 180 // 3 minutes default
  const maxWorkers = data.maxWorkers || 3

  try {
    const videoDuration = await resolveVideoDurationSeconds(data.youtubeUrl)

    if (!data.enableChunking) {
      return await analyzeVideoVertex(data)
    }

    if (!videoDuration || videoDuration <= 0) {
      console.warn(
        '[Vertex AI] Unable to determine video duration for chunked analysis. Falling back to single-pass analysis.',
      )
      return await analyzeVideoVertex(data)
    }

    if (videoDuration <= segmentDuration) {
      return await analyzeVideoVertex(data)
    }

    // Create video segments
    const segments = createVideoSegments(videoDuration, segmentDuration)
    console.log(
      `[Vertex AI] Analyzing video in ${segments.length} chunks of ${segmentDuration}s (concurrency: ${Math.max(
        1,
        Math.min(maxWorkers, segments.length),
      )})`,
    )

    // Initialize Vertex AI
    const vertexAI = getVertexClient()
    const modelName = CONFIG.MODEL
    const videoId = extractVideoId(data.youtubeUrl) || 'unknown'

    const generativeModel = vertexAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024, // Smaller for chunks
        topK: 40,
        topP: 0.95,
      },
    })

    // Analyze segments in parallel
    const chunkTasks = segments.map((segment, index) => async () => {
      console.log(
        `[Vertex AI] Processing chunk ${index + 1}/${segments.length}`,
      )

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: 'video/mp4',
                  fileUri: data.youtubeUrl,
                },
                videoMetadata: {
                  startOffset: { seconds: segment.start },
                  endOffset: { seconds: segment.end },
                },
              },
              {
                text: `Analyze this video segment from ${segment.start}s to ${segment.end}s. ${data.prompt}`,
              },
            ],
          },
        ],
      }

      const result = await generativeModel.generateContent(request)
      const text =
        result.response.candidates?.[0]?.content?.parts
          ?.map((part) => part.text)
          ?.filter(Boolean)
          ?.join('\n') || ''

      return {
        segmentIndex: index + 1,
        start: segment.start,
        end: segment.end,
        analysis: text,
        usage: normalizeUsage(result.response.usageMetadata),
      }
    })

    // Wait for all chunks with concurrency limit
    const chunkResults = await runWithConcurrency(chunkTasks, maxWorkers)

    // Combine results
    const combinedAnalysis = chunkResults
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .map(
        (chunk) =>
          `### Segment ${chunk.segmentIndex} (${formatTimestamp(chunk.start)} - ${formatTimestamp(chunk.end)})\n${chunk.analysis}`,
      )
      .join('\n\n')

    const usage = mergeUsage(chunkResults.map((chunk) => chunk.usage))

    // Create sections from combined analysis
    const sections = parseResponseIntoSections(combinedAnalysis)

    const analysisResponse: AnalyzeResponse = {
      summary: `Analyzed ${segments.length} video segments. ${sections[0]?.content || 'Video analysis complete.'}`,
      metadata: {
        videoTitle: `Video Analysis (${videoId})`,
        videoDuration: videoDuration,
        analysisTimestamp: new Date().toISOString(),
        model: modelName,
        processingTime: Date.now() - startTime,
        analysisMode: 'direct-video',
      },
      sections,
      rawAnalysis: combinedAnalysis,
    }

    return {
      response: analysisResponse,
      usage,
    }
  } catch (error) {
    console.error('[Vertex AI] Chunked analysis error:', error)

    return {
      response: {
        summary: 'Chunked Analysis Failed',
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          model: 'error',
          processingTime: Date.now() - startTime,
          analysisMode: 'direct-video',
        },
        error:
          error instanceof Error ? error.message : 'Chunked analysis failed',
      },
      usage: null,
    }
  }
}

async function resolveVideoDurationSeconds(
  youtubeUrl: string,
): Promise<number | null> {
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) {
    return null
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`

  try {
    const response = await fetch(watchUrl, {
      headers: {
        // Spoof a minimal browser user-agent to avoid lightweight bot filtering
        'User-Agent':
          'Mozilla/5.0 (compatible; LLMVideoAnalysis/1.0; +https://quidditch.video)',
      },
    })

    if (!response.ok) {
      console.warn(
        `[Vertex AI] Failed to fetch YouTube metadata (${response.status}).`,
      )
      return null
    }

    const html = await response.text()
    const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/)
    if (lengthMatch) {
      return Number.parseInt(lengthMatch[1], 10)
    }

    const approxMatch = html.match(/"approxDurationMs":"(\d+)"/)
    if (approxMatch) {
      return Math.round(Number.parseInt(approxMatch[1], 10) / 1_000)
    }

    return null
  } catch (error) {
    console.warn(
      '[Vertex AI] Unable to determine YouTube video duration:',
      error,
    )
    return null
  }
}

/**
 * Parse AI response into structured sections
 */
function parseResponseIntoSections(
  text: string,
): Array<{ title: string; content: string; timestamp?: number }> {
  const sections: Array<{
    title: string
    content: string
    timestamp?: number
  }> = []
  const lines = text.split('\n')
  let currentSection: {
    title: string
    content: string
    timestamp?: number
  } | null = null
  let contentBuffer: Array<string> = []

  for (const line of lines) {
    // Check for timestamp in format [MM:SS] or (MM:SS)
    const timestampMatch = line.match(/(?:\(|\[)(\d{1,2}):(\d{2})(?:\)|\])/)
    const timestamp = timestampMatch
      ? parseInt(timestampMatch[1]) * 60 + parseInt(timestampMatch[2])
      : undefined

    // Check if this line is a section header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)

    if (headerMatch) {
      // Save the previous section if it exists
      if (currentSection && contentBuffer.length > 0) {
        currentSection.content = contentBuffer.join('\n').trim()
        sections.push(currentSection)
        contentBuffer = []
      }

      // Start a new section
      currentSection = {
        title: headerMatch[2].trim(),
        content: '',
        timestamp,
      }
    } else if (line.trim()) {
      // Add content to the buffer
      contentBuffer.push(line)
    }
  }

  // Save the last section
  if (currentSection && contentBuffer.length > 0) {
    currentSection.content = contentBuffer.join('\n').trim()
    sections.push(currentSection)
  }

  // If no sections were parsed, create a single section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      title: 'Analysis',
      content: text.trim(),
    })
  }

  return sections
}

/**
 * Create video segments for chunking
 */
function createVideoSegments(
  totalDuration: number,
  segmentDuration: number,
): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = []
  let start = 0

  while (start < totalDuration) {
    const end = Math.min(start + segmentDuration, totalDuration)
    segments.push({ start, end })
    start = end
  }

  return segments
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<T>> {
  if (tasks.length === 0) {
    return []
  }

  const results: Array<T> = new Array(tasks.length)
  let nextIndex = 0

  const workerCount = Math.max(1, Math.min(limit, tasks.length))

  const getNextIndex = (): number | null => {
    const currentIndex = nextIndex++
    if (currentIndex >= tasks.length) {
      return null
    }
    return currentIndex
  }

  const workers = Array.from({ length: workerCount }, async () => {
    for (
      let currentIndex = getNextIndex();
      currentIndex !== null;
      currentIndex = getNextIndex()
    ) {
      results[currentIndex] = await tasks[currentIndex]()
    }
  })

  await Promise.all(workers)
  return results
}

/**
 * Format seconds to MM:SS
 */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
