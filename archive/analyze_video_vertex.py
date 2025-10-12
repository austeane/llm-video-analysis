#!/usr/bin/env python3
"""
Vertex AI version of the video analysis script.
Shows how to use Vertex AI instead of Google AI for the same functionality.

Prerequisites:
1. Google Cloud account with billing enabled
2. Google Cloud project created
3. Vertex AI API enabled in your project
4. Authentication configured (gcloud auth or service account)

Usage:
    # First time setup:
    gcloud auth application-default login

    # Run the script:
    GOOGLE_CLOUD_PROJECT='your-project-id' python analyze_video_vertex.py \
      'https://www.youtube.com/watch?v=VIDEO_ID' \
      'Your prompt here'
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Optional

from google import genai
from google.genai import types

# Try to import yt-dlp for video duration detection
try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False


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
                print(f"Video duration: {duration_min:02d}:{duration_sec:02d}", file=sys.stderr)
                return duration

    except Exception as e:
        print(f"Error fetching duration: {str(e)}", file=sys.stderr)
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze YouTube videos using Vertex AI's Gemini API.",
        epilog=(
            "Example:\n"
            "  GOOGLE_CLOUD_PROJECT='my-project' python analyze_video_vertex.py \\\n"
            "    'https://www.youtube.com/watch?v=VIDEO_ID' 'What happens in this video?'"
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
    print("YouTube Video Analysis with Vertex AI")
    print("=" * 80)
    print(f"Project: {project_id}")
    print(f"Location: {args.location}")
    print(f"Model: {args.model}")
    print(f"URL: {args.youtube_url}")
    print(f"Prompt: {args.prompt}")

    # Optional: Show video duration
    if YT_DLP_AVAILABLE:
        duration = get_video_duration(args.youtube_url)
        if duration and duration > 1800:
            print("\nNote: Long video detected. Consider increasing --max-output-tokens", file=sys.stderr)

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
        config = types.GenerateContentConfig(
            temperature=args.temperature,
            max_output_tokens=args.max_output_tokens,
        )

        # Analyze video
        print("Processing video...", file=sys.stderr)
        print("Note: Timestamps are approximate (±2-3 seconds) due to 1 FPS sampling", file=sys.stderr)

        response = client.models.generate_content(
            model=args.model,  # Note: No "models/" prefix for Vertex AI
            contents=types.Content(parts=[
                types.Part(file_data=types.FileData(file_uri=args.youtube_url)),
                types.Part(text=args.prompt)
            ]),
            config=config
        )

        # Extract and display results
        print("\n" + "=" * 80)
        print("ANALYSIS RESULTS")
        print("=" * 80 + "\n")

        # Extract text from response
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
                 "3. Your project has billing enabled")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled by user.")