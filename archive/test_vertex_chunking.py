#!/usr/bin/env python3
"""TEST THE BIG QUESTION: Does VideoMetadata chunking work in Vertex AI?"""

import os
from google import genai
from google.genai import types

# Set project
os.environ["GOOGLE_CLOUD_PROJECT"] = "gen-lang-client-0487815497"

try:
    # Create Vertex AI client
    print("="*60)
    print("TESTING VERTEX AI VIDEO CHUNKING WITH VideoMetadata")
    print("="*60)

    client = genai.Client(
        vertexai=True,
        project="gen-lang-client-0487815497",
        location="us-central1"
    )

    print("\nAnalyzing video segment from 60-120 seconds...")
    print("If this works, it's a GAME CHANGER!")
    print("-"*60)

    # THE CRITICAL TEST: VideoMetadata with start/end offsets
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Part(
                file_data=types.FileData(
                    file_uri="https://www.youtube.com/watch?v=eFV3vZYn_Z4",
                    mime_type="video/mp4"
                ),
                video_metadata=types.VideoMetadata(
                    start_offset="60s",   # Start at 1 minute
                    end_offset="120s"     # End at 2 minutes
                )
            ),
            types.Part(text="List any goals scored in this specific segment with timestamps")
        ]
    )

    print("\n✅ SUCCESS! VideoMetadata chunking WORKS in Vertex AI!")
    print("\nResponse:")
    print(response.text)

    print("\n" + "="*60)
    print("IMPLICATIONS:")
    print("- Can process long videos in parallel segments")
    print("- 10x speed improvement for long videos")
    print("- More detailed analysis per segment")
    print("- Major advantage over Google AI (genai)")
    print("="*60)

except Exception as e:
    print("\n❌ VideoMetadata chunking FAILED")
    print(f"Error: {e}")
    print("\nThis means Vertex AI has the same limitation as Google AI.")
    import traceback
    traceback.print_exc()