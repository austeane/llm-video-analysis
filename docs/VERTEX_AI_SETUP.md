# Vertex AI Setup Guide

## Google Cloud CLI Installation ✅

Successfully installed Google Cloud SDK at `/Users/austin/google-cloud-sdk/`

Version installed:
- Google Cloud SDK 537.0.0
- bq 2.1.22
- core 2025.08.29

## Authentication Steps

To use Vertex AI, you need to complete authentication:

```bash
# 1. Authenticate with Google Cloud (opens browser)
/Users/austin/google-cloud-sdk/bin/gcloud auth application-default login

# 2. Set your project (you'll need a Google Cloud project ID)
/Users/austin/google-cloud-sdk/bin/gcloud config set project YOUR_PROJECT_ID

# 3. Enable Vertex AI API for your project
/Users/austin/google-cloud-sdk/bin/gcloud services enable aiplatform.googleapis.com
```

## Testing Vertex AI Video Chunking

I've created `analyze_video_vertex_chunked.py` to test whether VideoMetadata chunking actually works in Vertex AI.

### To Run the Test

Once authenticated with a Google Cloud project:

```bash
# Test without chunking (baseline)
GOOGLE_CLOUD_PROJECT='your-project-id' python analyze_video_vertex_chunked.py \
  'https://www.youtube.com/watch?v=eFV3vZYn_Z4' \
  'At what timestamps were goals scored'

# Test WITH chunking (if it works, this would be huge!)
GOOGLE_CLOUD_PROJECT='your-project-id' python analyze_video_vertex_chunked.py \
  'https://www.youtube.com/watch?v=u3eMw5XqCbQ' \
  'List major game events' \
  --enable-chunking \
  --video-duration 2824 \
  --segment-duration 180
```

## What We Know So Far

### VideoMetadata Documentation
- **Vertex AI docs say it's supported** ✅
- Shows `startOffset` and `endOffset` parameters
- Claims you can process video segments

### Real-World Status
- **Google AI (genai)**: VideoMetadata definitely broken ❌
- **Vertex AI**: Unknown - needs testing with real project ⚠️

### If It Works
This would be a game-changer because:
1. **Parallel processing** - 10x speed for long videos
2. **Better accuracy** - Each segment gets full token allocation
3. **Cost efficiency** - Only process relevant segments

### If It Doesn't Work
We're in the same boat as Google AI - full video processing only.

## Prerequisites for Testing

1. **Google Cloud Account** with billing enabled (new users get $300 credit)
2. **Create a project** at https://console.cloud.google.com
3. **Enable Vertex AI API** in your project
4. **Note your project ID** (looks like `my-project-123456`)

## The Big Question

**Does VideoMetadata chunking actually work in Vertex AI?**

The documentation says yes, but we've seen documentation be wrong before (Google AI claims the same but it's broken). The only way to know is to test with a real Google Cloud project.

## Cost Estimate

Testing would cost approximately:
- Short video (3 min): ~$0.01
- Long video (45 min): ~$0.06
- With your free $300 credit, you could run thousands of tests

## My Recommendation

If you have or can create a Google Cloud account:
1. Use the free $300 credit
2. Test the chunking feature
3. If it works → Major win for Vertex AI
4. If it doesn't → Stick with Google AI (free tier)

The potential performance improvement (10x for long videos) makes it worth testing!