#!/usr/bin/env python3
"""
Unified video analysis script supporting both Google AI and Vertex AI.

Features:
- Google AI: Free tier, simple API key auth, no chunking
- Vertex AI: Pay-per-use, GCloud auth, VIDEO CHUNKING WORKS!

Usage Examples:

1. Google AI (default, free):
   python analyze_video.py 'https://youtube.com/watch?v=VIDEO_ID' 'Your prompt'

2. Vertex AI with chunking:
   python analyze_video.py 'https://youtube.com/watch?v=VIDEO_ID' 'Your prompt' \
     --api vertex-ai \
     --enable-chunking \
     --segment-duration 180

3. With environment variables:
   GOOGLE_API_KEY='your-key' python analyze_video.py URL PROMPT
   GOOGLE_CLOUD_PROJECT='project-id' python analyze_video.py URL PROMPT --api vertex-ai
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Tuple

from google import genai
from google.genai import types

# Try to import yt-dlp for video duration detection
try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False


@dataclass
class VideoSegment:
    """Represents a segment of video with start and end times."""
    start_offset: float  # in seconds
    end_offset: float    # in seconds
    segment_index: int

    def __str__(self) -> str:
        """Human-readable string representation."""
        start_min = int(self.start_offset // 60)
        start_sec = int(self.start_offset % 60)
        end_min = int(self.end_offset // 60)
        end_sec = int(self.end_offset % 60)
        return f"Segment {self.segment_index}: {start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}"


class VideoAnalyzer:
    """Unified video analyzer supporting both Google AI and Vertex AI."""

    def __init__(self, api_type: str = "google-ai", project_id: str = None, location: str = "us-central1"):
        """
        Initialize the video analyzer.

        Args:
            api_type: Either "google-ai" or "vertex-ai"
            project_id: Required for Vertex AI
            location: GCloud region for Vertex AI (default: us-central1)
        """
        self.api_type = api_type

        if api_type == "google-ai":
            # Google AI setup (simple API key)
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if not api_key:
                sys.exit("Error: Set GOOGLE_API_KEY environment variable for Google AI")
            self.client = genai.Client(api_key=api_key)
            self.model_prefix = "models/"
            print("Using Google AI (free tier, no chunking)", file=sys.stderr)

        elif api_type == "vertex-ai":
            # Vertex AI setup (GCloud project)
            if not project_id:
                project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
            if not project_id:
                sys.exit("Error: Set --project or GOOGLE_CLOUD_PROJECT for Vertex AI")

            self.client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location
            )
            self.model_prefix = ""  # Vertex AI doesn't use "models/" prefix
            print(f"Using Vertex AI (project: {project_id}, chunking available)", file=sys.stderr)
        else:
            sys.exit(f"Error: Invalid API type '{api_type}'. Use 'google-ai' or 'vertex-ai'")

    def analyze_full_video(
        self,
        youtube_url: str,
        prompt: str,
        model: str,
        config: Dict[str, Any]
    ) -> str:
        """Analyze entire video without chunking."""
        try:
            print("Processing full video...", file=sys.stderr)

            # Build content based on API type
            if self.api_type == "vertex-ai":
                # Vertex AI requires mime_type and uses list format
                contents = [
                    types.Part(file_data=types.FileData(
                        file_uri=youtube_url,
                        mime_type="video/mp4"
                    )),
                    types.Part(text=prompt)
                ]
            else:
                # Google AI doesn't require mime_type
                contents = [
                    types.Part(file_data=types.FileData(file_uri=youtube_url)),
                    types.Part(text=prompt)
                ]

            response = self.client.models.generate_content(
                model=self.model_prefix + model,
                contents=contents,
                config=types.GenerateContentConfig(**config)
            )

            return self._extract_text(response)

        except Exception as e:
            return f"Error: {str(e)}"

    def analyze_segment(
        self,
        youtube_url: str,
        prompt: str,
        segment: VideoSegment,
        model: str,
        config: Dict[str, Any]
    ) -> Tuple[VideoSegment, str]:
        """Analyze a video segment (Vertex AI only)."""
        if self.api_type != "vertex-ai":
            return segment, "Error: Chunking only works with Vertex AI"

        try:
            print(f"  Processing {segment}...", file=sys.stderr)

            segment_prompt = (
                f"Analyze video from {int(segment.start_offset)}s to {int(segment.end_offset)}s. "
                f"{prompt}"
            )

            contents = [
                types.Part(
                    file_data=types.FileData(
                        file_uri=youtube_url,
                        mime_type="video/mp4"
                    ),
                    video_metadata=types.VideoMetadata(
                        start_offset=f"{int(segment.start_offset)}s",
                        end_offset=f"{int(segment.end_offset)}s"
                    )
                ),
                types.Part(text=segment_prompt)
            ]

            response = self.client.models.generate_content(
                model=self.model_prefix + model,
                contents=contents,
                config=types.GenerateContentConfig(**config)
            )

            return segment, self._extract_text(response)

        except Exception as e:
            return segment, f"Error in segment: {str(e)}"

    def analyze_chunked(
        self,
        youtube_url: str,
        prompt: str,
        segments: List[VideoSegment],
        model: str,
        config: Dict[str, Any],
        max_workers: int = 3
    ) -> Dict[int, Tuple[VideoSegment, str]]:
        """Analyze video in parallel chunks (Vertex AI only)."""
        if self.api_type != "vertex-ai":
            return {1: (segments[0], "Error: Chunking only works with Vertex AI")}

        results = {}

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(
                    self.analyze_segment,
                    youtube_url,
                    prompt,
                    segment,
                    model,
                    config
                ): segment
                for segment in segments
            }

            for future in as_completed(futures):
                segment, result = future.result()
                results[segment.segment_index] = (segment, result)
                print(f"  ✓ Segment {segment.segment_index} complete", file=sys.stderr)

        return results

    def _extract_text(self, response) -> str:
        """Extract text from response."""
        texts = []
        for candidate in response.candidates or []:
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if getattr(part, "text", None):
                        texts.append(part.text.strip())

        result = "\n\n".join(texts).strip()
        return result if result else "No response generated."


def get_video_duration(youtube_url: str) -> Optional[int]:
    """Fetch video duration in seconds using yt-dlp."""
    if not YT_DLP_AVAILABLE:
        return None

    try:
        print("Fetching video metadata...", file=sys.stderr)

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            duration = info.get('duration')

            if duration:
                duration_min = int(duration // 60)
                duration_sec = int(duration % 60)
                print(f"Video duration: {duration_min:02d}:{duration_sec:02d} ({duration} seconds)", file=sys.stderr)
                return duration

    except Exception as e:
        print(f"Error fetching duration: {str(e)}", file=sys.stderr)

    return None


def create_video_segments(total_duration: int, segment_duration: int) -> List[VideoSegment]:
    """Create a list of video segments."""
    segments = []
    start = 0
    segment_index = 1

    while start < total_duration:
        end = min(start + segment_duration, total_duration)
        segments.append(VideoSegment(start, end, segment_index))
        start = end
        segment_index += 1

    return segments


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze YouTube videos with Gemini (Google AI or Vertex AI)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Google AI (free, default):
  python analyze_video.py 'https://youtube.com/watch?v=ID' 'Find goals'

  # Vertex AI with chunking:
  python analyze_video.py 'https://youtube.com/watch?v=ID' 'Find goals' \\
    --api vertex-ai --enable-chunking --segment-duration 180

Environment Variables:
  GOOGLE_API_KEY: Required for Google AI
  GOOGLE_CLOUD_PROJECT: Required for Vertex AI
        """
    )

    parser.add_argument("youtube_url", help="YouTube URL to analyze")
    parser.add_argument("prompt", help="Analysis prompt")

    # API selection
    parser.add_argument(
        "--api",
        choices=["google-ai", "vertex-ai"],
        default="google-ai",
        help="Which API to use (default: google-ai)"
    )

    # Vertex AI specific
    parser.add_argument(
        "--project",
        help="GCloud project ID (for Vertex AI)"
    )
    parser.add_argument(
        "--location",
        default="us-central1",
        help="GCloud location (for Vertex AI, default: us-central1)"
    )

    # Model configuration
    parser.add_argument(
        "--model",
        default="gemini-2.5-pro",
        help="Model name (default: gemini-2.0-flash)"
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.2,
        help="Temperature (default: 0.2)"
    )
    parser.add_argument(
        "--max-output-tokens",
        type=int,
        default=2048,
        help="Max output tokens (default: 2048)"
    )
    parser.add_argument(
        "--top-k",
        type=int,
        help="Top-k sampling"
    )
    parser.add_argument(
        "--top-p",
        type=float,
        help="Top-p sampling"
    )

    # Chunking (Vertex AI only)
    parser.add_argument(
        "--enable-chunking",
        action="store_true",
        help="Enable video chunking (Vertex AI only)"
    )
    parser.add_argument(
        "--segment-duration",
        type=int,
        default=180,
        help="Segment duration in seconds (default: 180)"
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=3,
        help="Max parallel workers for chunking (default: 3)"
    )

    return parser.parse_args()


def main():
    args = parse_args()

    # Header
    print("=" * 70)
    print("YouTube Video Analysis with Gemini")
    print("=" * 70)
    print(f"API: {args.api}")
    print(f"Model: {args.model}")
    print(f"URL: {args.youtube_url}")
    print(f"Prompt: {args.prompt}")

    # Initialize analyzer
    analyzer = VideoAnalyzer(
        api_type=args.api,
        project_id=args.project,
        location=args.location
    )

    # Prepare config
    config = {
        "temperature": args.temperature,
        "max_output_tokens": args.max_output_tokens,
    }
    if args.top_k is not None:
        config["top_k"] = args.top_k
    if args.top_p is not None:
        config["top_p"] = args.top_p

    # Get video duration if available
    video_duration = get_video_duration(args.youtube_url) if YT_DLP_AVAILABLE else None

    # Chunking logic (Vertex AI only)
    if args.enable_chunking and args.api == "vertex-ai":
        if not video_duration:
            print("\nWarning: Could not detect video duration. Processing full video.", file=sys.stderr)
            args.enable_chunking = False
        elif video_duration <= args.segment_duration:
            print(f"\nVideo too short for chunking ({video_duration}s). Processing full video.", file=sys.stderr)
            args.enable_chunking = False
        else:
            segments = create_video_segments(video_duration, args.segment_duration)
            print(f"\nChunking enabled: {len(segments)} segments of {args.segment_duration}s", file=sys.stderr)
            print(f"Using {args.max_workers} parallel workers", file=sys.stderr)
            print("=" * 70)

            start_time = time.time()
            results = analyzer.analyze_chunked(
                args.youtube_url,
                args.prompt,
                segments,
                args.model,
                config,
                args.max_workers
            )
            elapsed = time.time() - start_time

            # Display results
            print("\n" + "=" * 70)
            print("RESULTS (CHUNKED)")
            print("=" * 70)

            for i in sorted(results.keys()):
                segment, text = results[i]
                print(f"\n{'-' * 40}")
                print(f"{segment}")
                print(f"{'-' * 40}")
                print(text)

            print(f"\n{'=' * 70}")
            print(f"Total time: {elapsed:.1f} seconds for {len(segments)} segments")
            print("=" * 70)
            return

    elif args.enable_chunking and args.api == "google-ai":
        print("\n⚠️  Warning: Chunking not supported with Google AI. Processing full video.", file=sys.stderr)

    # Full video analysis (default)
    print("=" * 70)

    if video_duration and video_duration > 600:  # More than 10 minutes
        print("\nNote: Long video detected. Consider:", file=sys.stderr)
        if args.api == "google-ai":
            print("  - Using --api vertex-ai --enable-chunking for faster parallel processing", file=sys.stderr)
        print("  - Increasing --max-output-tokens for detailed results", file=sys.stderr)

    print("\nNote: Timestamps are approximate (±2-3 seconds)", file=sys.stderr)

    result = analyzer.analyze_full_video(
        args.youtube_url,
        args.prompt,
        args.model,
        config
    )

    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70 + "\n")
    print(result)
    print("\n" + "=" * 70)
    print("Analysis complete!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled by user.")
    except Exception as e:
        sys.exit(f"Error: {str(e)}")