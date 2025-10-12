#!/usr/bin/env python3
"""Analyse a YouTube video with Gemini using a natural-language prompt.

Automatically detects video duration for informational purposes.

IMPORTANT: Timestamp Accuracy
- Gemini samples videos at 1 frame per second (FPS) by default
- This means timestamps may be off by 1-3 seconds
- For fast-moving events, the model sees one frame before and one after the event
- Consider using "approximate timestamps" in your prompts for best results

Usage:
    GOOGLE_API_KEY='your-api-key' uv run --with google --with google.genai --with yt-dlp analyze_video.py 'https://www.youtube.com/watch?v=VIDEO_ID' 'Your prompt here'

Example:
    GOOGLE_API_KEY='' uv run --with google --with google.genai --with yt-dlp analyze_video.py 'https://www.youtube.com/watch?v=eFV3vZYn_Z4' 'At what timestamps were goals scored (quaffle goes through a hoop)'

Note: The API key can also be set in your shell environment (e.g., .zshrc or .bashrc)
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
    """
    Fetch video duration in seconds using yt-dlp.
    Returns None if unable to fetch duration.
    """
    if not YT_DLP_AVAILABLE:
        return None

    try:
        print("Fetching video metadata...", file=sys.stderr)

        # Configure yt-dlp to only fetch metadata
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,  # We need full extraction for duration
            'skip_download': True,   # Don't download the video
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            duration = info.get('duration')

            if duration:
                duration_min = int(duration // 60)
                duration_sec = int(duration % 60)
                print(f"Video duration detected: {duration_min:02d}:{duration_sec:02d} ({duration} seconds)", file=sys.stderr)
                return duration
            else:
                print("Could not determine video duration", file=sys.stderr)
                return None

    except Exception as e:
        print(f"Error fetching video duration: {str(e)}", file=sys.stderr)
        return None


def format_duration(seconds: int) -> str:
    """Format duration in seconds to human-readable string."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Send a YouTube video to Gemini together with a prompt and "
            "print the model's response."
        ),
        epilog=(
            "Example usage:\n"
            "  GOOGLE_API_KEY='your-key' uv run --with google --with google.genai --with yt-dlp analyze_video.py \\\n"
            "    'https://www.youtube.com/watch?v=VIDEO_ID' 'What events happen in this video?'\n\n"
            "Note: For best results with long videos (>10 minutes), consider:\n"
            "  - Being specific in your prompt\n"
            "  - Increasing --max-output-tokens for detailed responses\n"
            "  - Using a more powerful model (e.g., gemini-2.5-pro)"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("youtube_url", help="Full YouTube URL to analyse.")
    parser.add_argument("prompt", help="Instruction for Gemini.")
    parser.add_argument(
        "--model",
        default="models/gemini-2.0-flash",
        help="Gemini model to use (default: models/gemini-2.0-flash).",
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
        help="Maximum number of tokens to generate (default: 2048).",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        help="Restrict sampling to top-k tokens (optional).",
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=None,
        help="Nucleus sampling probability (optional).",
    )
    parser.add_argument(
        "--show-duration",
        action="store_true",
        help="Show video duration if available (requires yt-dlp).",
    )
    return parser.parse_args()


def resolve_api_key() -> str:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        sys.exit("Set GOOGLE_API_KEY (or GEMINI_API_KEY) before running this script.")
    return api_key


def youtube_part(url: str) -> types.Part:
    """Create a YouTube part for the Gemini API."""
    return types.Part(file_data=types.FileData(file_uri=url))


def prompt_part(text: str) -> types.Part:
    """Create a prompt part."""
    return types.Part(text=text)


def extract_text(response: types.GenerateContentResponse) -> str:
    """Extract text from the Gemini response."""
    texts: list[str] = []
    for candidate in response.candidates or []:
        texts.extend(_text_parts(candidate.content))
    return "\n\n".join(texts).strip()


def _text_parts(content: Optional[types.Content]) -> list[str]:
    """Extract text parts from content."""
    if not content or not content.parts:
        return []
    return [
        part.text.strip()
        for part in content.parts
        if getattr(part, "text", None) and part.text.strip()
    ]


def print_safety_warnings(response: types.GenerateContentResponse) -> None:
    """Print any safety warnings from the response."""
    feedback = response.prompt_feedback
    if feedback and feedback.block_reason:
        print(
            f"Prompt feedback: {feedback.block_reason} - {feedback.block_reason_message}",
            file=sys.stderr,
        )
    for idx, candidate in enumerate(response.candidates or []):
        for rating in candidate.safety_ratings or []:
            if rating.probability and rating.probability.name != "NEGLIGIBLE":
                label = rating.category.name if rating.category else "unknown"
                print(
                    f"Warning: candidate {idx} flagged {label} ({rating.probability.name})",
                    file=sys.stderr,
                )


def analyze_video(
    client: genai.Client,
    youtube_url: str,
    prompt: str,
    model: str,
    config_kwargs: dict
) -> str:
    """Analyze the video using Gemini API."""
    try:
        print("Processing video...", file=sys.stderr)

        response = client.models.generate_content(
            model=model,
            contents=types.Content(parts=[
                youtube_part(youtube_url),
                prompt_part(prompt)
            ]),
            config=types.GenerateContentConfig(**config_kwargs),
        )

        print_safety_warnings(response)
        text = extract_text(response)

        if not text:
            text = "Gemini did not return any text."

        return text
    except Exception as e:
        error_msg = f"Error processing video: {str(e)}"
        print(error_msg, file=sys.stderr)
        return error_msg


def main() -> None:
    args = parse_args()

    print("=" * 80)
    print("YouTube Video Analysis with Gemini")
    print("=" * 80)
    print(f"URL: {args.youtube_url}")
    print(f"Prompt: {args.prompt}")
    print(f"Model: {args.model}")

    # Optionally fetch and display video duration
    video_duration = None
    if args.show_duration or YT_DLP_AVAILABLE:
        video_duration = get_video_duration(args.youtube_url)
        if video_duration:
            formatted_duration = format_duration(video_duration)
            print(f"Video Duration: {formatted_duration}")

            # Provide guidance for long videos
            if video_duration > 1800:  # More than 30 minutes
                print("\nNote: This is a long video. For best results:", file=sys.stderr)
                print("  - Be specific about what you're looking for", file=sys.stderr)
                print("  - Consider using --model models/gemini-2.5-pro for better accuracy", file=sys.stderr)
                print("  - Increase --max-output-tokens if you need detailed analysis", file=sys.stderr)
            elif video_duration > 600:  # More than 10 minutes
                print("\nNote: For videos over 10 minutes, consider increasing --max-output-tokens", file=sys.stderr)

    print("=" * 80)

    api_key = resolve_api_key()
    client = genai.Client(api_key=api_key)

    config_kwargs = {
        "temperature": args.temperature,
        "max_output_tokens": args.max_output_tokens,
    }
    if args.top_k is not None:
        config_kwargs["top_k"] = args.top_k
    if args.top_p is not None:
        config_kwargs["top_p"] = args.top_p

    # Note about timestamp accuracy
    print("\nNote: Timestamps are approximate (±2-3 seconds) due to 1 FPS video sampling", file=sys.stderr)

    # Analyze the video
    result = analyze_video(
        client,
        args.youtube_url,
        args.prompt,
        args.model,
        config_kwargs
    )

    print("\n" + "=" * 80)
    print("GEMINI ANALYSIS RESULTS")
    print("=" * 80 + "\n")
    print(result)

    print("\n" + "=" * 80)
    print("Analysis complete!")

    # Note about video chunking
    if video_duration and video_duration > 600:
        print("\nNote: Video chunking is not currently supported by the google.genai library.", file=sys.stderr)
        print("The entire video was processed as a single unit.", file=sys.stderr)
        print("For very long videos, results may be less detailed than for shorter clips.", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled by user.")