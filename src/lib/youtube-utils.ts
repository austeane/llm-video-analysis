export interface YouTubeVideoInfo {
  videoId: string
  title?: string
  duration?: number // in seconds
  thumbnail?: string
}

/**
 * Extracts video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([^&\s]{11})/,
    // Shortened URL: youtu.be/VIDEO_ID
    /youtu\.be\/([^?&\s]{11})/,
    // Embed URL: youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([^?&\s]{11})/,
    // Mobile URL: m.youtube.com/watch?v=VIDEO_ID
    /m\.youtube\.com\/watch\?v=([^&\s]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Gets basic video information from YouTube URL
 * Note: This is a simplified version. In production, you would use YouTube Data API
 */
export function getYouTubeVideoInfo(url: string): YouTubeVideoInfo | null {
  const videoId = extractVideoId(url)

  if (!videoId) {
    return null
  }

  // For now, return basic info based on the video ID
  // In production, this would make an API call to YouTube Data API
  return {
    videoId,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    // Title and duration would come from YouTube API
    // For now, we'll let the AI provider handle the analysis without this info
  }
}

/**
 * Formats seconds into a readable duration string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

/**
 * Builds a YouTube URL from a video ID
 */
export function buildYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
