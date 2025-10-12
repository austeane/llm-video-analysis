#!/usr/bin/env python3
"""Test Vertex AI with YouTube video - with mimeType."""

import os
from google import genai
from google.genai import types

# Set project
os.environ["GOOGLE_CLOUD_PROJECT"] = "gen-lang-client-0487815497"

try:
    # Create Vertex AI client
    print("Creating Vertex AI client...")
    client = genai.Client(
        vertexai=True,
        project="gen-lang-client-0487815497",
        location="us-central1"
    )

    print("Analyzing YouTube video...")

    # Test with YouTube video - ADD MIMETYPE
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Part(file_data=types.FileData(
                file_uri="https://www.youtube.com/watch?v=eFV3vZYn_Z4",
                mime_type="video/mp4"  # Required for Vertex AI
            )),
            types.Part(text="List the first 3 goals with timestamps")
        ]
    )

    print("\nResponse:")
    print(response.text)

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()