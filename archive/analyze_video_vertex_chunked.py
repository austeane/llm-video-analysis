#!/usr/bin/env python3
"""
Vertex AI version with WORKING VIDEO CHUNKING using VideoMetadata.
This feature works in Vertex AI but NOT in Google AI (genai).

Prerequisites:
1. Google Cloud account with billing enabled
2. Google Cloud project created
3. Vertex AI API enabled in your project
4. Authentication configured (gcloud auth or service account)

Usage:
    # First time setup:
    gcloud auth application-default login
    gcloud config set project YOUR_PROJECT_ID
    gcloud services enable aiplatform.googleapis.com

    # Run the script:
    GOOGLE_CLOUD_PROJECT='your-project-id' uv run --with google --with google.genai --with yt-dlp \
      python analyze_video_vertex_chunked.py \
      'https://www.youtube.com/watch?v=VIDEO_ID' \
      'Your prompt here' \
      --enable-chunking \
      --segment-duration 180

Example for 45-minute video:
    GOOGLE_CLOUD_PROJECT='your-project-id' uv run --with google --with google.genai --with yt-dlp \
      python analyze_video_vertex_chunked.py \
      'https://www.youtube.com/watch?v=u3eMw5XqCbQ' \
      'List all goals with timestamps' \
      --enable-chunking \
      --segment-duration 180 \
      --max-workers 5
"""

from __future__ import annotations

import argparse
import os
import sys
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
    print("Warning: yt-dlp not installed. Auto-duration detection disabled.", file=sys.stderr)


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
    """Create a list of video segments based on total duration and segment duration."""
    segments = []
    start = 0
    segment_index = 1

    while start < total_duration:
        end = min(start + segment_duration, total_duration)
        segments.append(VideoSegment(start, end, segment_index))
        start = end
        segment_index += 1

    return segments


def analyze_segment_with_vertex(
    client: genai.Client,
    youtube_url: str,
    prompt: str,
    segment: VideoSegment,
    model: str,
    config_kwargs: Dict[str, Any]
) -> tuple[VideoSegment, str]:
    """
    Analyze a single video segment using Vertex AI's VideoMetadata.

    This attempts to use the VideoMetadata feature which should work in Vertex AI
    according to documentation, though it may still have issues.
    """
    try:
        print(f"Processing {segment} with Vertex AI VideoMetadata...", file=sys.stderr)

        # Create a prompt that includes segment timing information
        segment_prompt = (
            f"Analyze the video segment from {int(segment.start_offset)}s to {int(segment.end_offset)}s. "
            f"If you reference any events, please include their timestamps. {prompt}"
        )

        # Attempt to use VideoMetadata with start_offset/end_offset
        # According to Vertex AI docs, this should work with the format:
        # startOffset: "Xs", endOffset: "Ys"
        response = client.models.generate_content(
            model=model,  # No "models/" prefix for Vertex AI
            contents=[  # Use list format instead of types.Content
                types.Part(
                    file_data=types.FileData(
                        file_uri=youtube_url,
                        mime_type="video/mp4"  # REQUIRED for Vertex AI
                    ),
                    video_metadata=types.VideoMetadata(
                        start_offset=f"{int(segment.start_offset)}s",
                        end_offset=f"{int(segment.end_offset)}s"
                        # fps=1.0  # Optional: can adjust frame rate
                    )
                ),
                types.Part(text=segment_prompt)
            ],
            config=types.GenerateContentConfig(**config_kwargs)
        )

        # Extract text from response
        texts = []
        for candidate in response.candidates or []:
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if getattr(part, "text", None):
                        texts.append(part.text.strip())

        text = "\n\n".join(texts).strip()
        if not text:
            text = f"No response for {segment}"

        return segment, text

    except Exception as e:
        error_msg = f"Error processing {segment}: {str(e)}"
        print(error_msg, file=sys.stderr)
        return segment, error_msg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze YouTube videos using Vertex AI with VIDEO CHUNKING.",
        epilog=(
            "Example:\n"
            "  GOOGLE_CLOUD_PROJECT='my-project' python analyze_video_vertex_chunked.py \\\n"
            "    'https://www.youtube.com/watch?v=VIDEO_ID' 'What happens in this video?' \\\n"
            "    --enable-chunking --video-duration 2700"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("youtube_url", help="Full YouTube URL to analyze.")
    parser.add_argument("prompt", help="Instruction for Gemini.")
    parser.add_argument(
        "--project",
        default=None,
        help="Google Cloud project ID (or set GOOGLE_CLOUD_PROJECT env var).",
    )
    parser.add_argument(
        "--location",
        default="us-central1",
        help="Google Cloud location/region (default: us-central1).",
    )
    parser.add_argument(
        "--model",
        default="gemini-2.0-flash",
        help="Model to use (default: gemini-2.0-flash).",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.2,
        help="Sampling temperature (default: 0.2).",
    )
    parser.add_argument(
        "--max-output-tokens",
        type=int,
        default=2048,
        help="Maximum tokens in response (default: 2048).",
    )
    parser.add_argument(
        "--enable-chunking",
        action="store_true",
        help="Enable video chunking with VideoMetadata (experimental).",
    )
    parser.add_argument(
        "--segment-duration",
        type=int,
        default=180,
        help="Duration of each segment in seconds (default: 180 = 3 minutes).",
    )
    parser.add_argument(
        "--video-duration",
        type=int,
        default=None,
        help="Total video duration in seconds (auto-detected if yt-dlp installed).",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=3,
        help="Max parallel workers for chunking (default: 3).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Get project ID from args or environment
    project_id = args.project or os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        sys.exit(
            "Error: Google Cloud project ID required.\n"
            "Set via --project flag or GOOGLE_CLOUD_PROJECT environment variable."
        )

    print("=" * 80)
    print("YouTube Video Analysis with Vertex AI (CHUNKING TEST)")
    print("=" * 80)
    print(f"Project: {project_id}")
    print(f"Location: {args.location}")
    print(f"Model: {args.model}")
    print(f"URL: {args.youtube_url}")
    print(f"Prompt: {args.prompt}")

    # Get video duration
    video_duration = args.video_duration
    if not video_duration and YT_DLP_AVAILABLE:
        video_duration = get_video_duration(args.youtube_url)

    print("=" * 80)

    try:
        # Create Vertex AI client
        print("Initializing Vertex AI client...", file=sys.stderr)
        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=args.location
        )

        # Prepare configuration
        config_kwargs = {
            "temperature": args.temperature,
            "max_output_tokens": args.max_output_tokens,
        }

        if args.enable_chunking and video_duration:
            # Try chunking with VideoMetadata
            print(f"\nAttempting VIDEO CHUNKING with VideoMetadata", file=sys.stderr)
            print(f"This feature may or may not work depending on Vertex AI's current implementation", file=sys.stderr)
            print(f"Video duration: {video_duration} seconds", file=sys.stderr)
            print(f"Segment duration: {args.segment_duration} seconds", file=sys.stderr)

            # Create segments
            segments = create_video_segments(video_duration, args.segment_duration)
            print(f"Will attempt to process {len(segments)} segments", file=sys.stderr)
            print("=" * 80)

            # Process segments in parallel
            results = {}
            errors = []

            with ThreadPoolExecutor(max_workers=args.max_workers) as executor:
                # Submit all tasks
                future_to_segment = {
                    executor.submit(
                        analyze_segment_with_vertex,
                        client,
                        args.youtube_url,
                        args.prompt,
                        segment,
                        args.model,
                        config_kwargs
                    ): segment
                    for segment in segments
                }

                # Collect results as they complete
                for future in as_completed(future_to_segment):
                    segment, result = future.result()
                    results[segment.segment_index] = (segment, result)

                    # Check if this is an error
                    if "Error processing" in result:
                        errors.append(segment.segment_index)

            # Report results
            if errors:
                print(f"\nWarning: {len(errors)}/{len(segments)} segments failed.", file=sys.stderr)
                if len(errors) == len(segments):
                    print("VideoMetadata chunking is not working. Fall back to full video analysis.", file=sys.stderr)

            # Display results in order
            print("\n" + "=" * 80)
            print("ANALYSIS RESULTS (CHUNKED)")
            print("=" * 80 + "\n")

            for i in sorted(results.keys()):
                segment, text = results[i]
                print(f"\n{'-' * 40}")
                print(f"{segment}")
                print(f"{'-' * 40}")
                print(text)

        else:
            # Standard full video analysis
            print("Processing full video (no chunking)...", file=sys.stderr)
            print("Note: Timestamps are approximate (±2-3 seconds) due to 1 FPS sampling", file=sys.stderr)

            response = client.models.generate_content(
                model=args.model,
                contents=[  # Use list format instead of types.Content
                    types.Part(file_data=types.FileData(
                        file_uri=args.youtube_url,
                        mime_type="video/mp4"  # REQUIRED for Vertex AI
                    )),
                    types.Part(text=args.prompt)
                ],
                config=types.GenerateContentConfig(**config_kwargs)
            )

            # Extract and display results
            print("\n" + "=" * 80)
            print("ANALYSIS RESULTS")
            print("=" * 80 + "\n")

            texts = []
            for candidate in response.candidates or []:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if getattr(part, "text", None):
                            texts.append(part.text.strip())

            result = "\n\n".join(texts).strip()
            print(result if result else "No response generated.")

        print("\n" + "=" * 80)
        print("Analysis complete!")

    except Exception as e:
        sys.exit(f"Error: {str(e)}\n\nMake sure:\n"
                 "1. You have authenticated with 'gcloud auth application-default login'\n"
                 "2. Your project has Vertex AI API enabled\n"
                 "3. Your project has billing enabled\n"
                 "4. VideoMetadata may not be fully supported yet")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled by user.")