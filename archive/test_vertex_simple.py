#!/usr/bin/env python3
"""Simple test of Vertex AI with YouTube video."""

import os
from google import genai

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

    print("Sending request...")
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="What is 2+2?"
    )

    print("Response:", response.text)

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()