# Quidditch Video Analysis

Analyze YouTube videos using Google's Gemini AI. Choose between **Google AI** (free) or **Vertex AI** (with video chunking superpowers).

## Quick Start

### Option 1: Google AI (Free, Default)

```bash
# 1. Get API key from https://aistudio.google.com/app/apikey
export GOOGLE_API_KEY='your-api-key'

# 2. Install dependencies
pip install google-genai yt-dlp

# 3. Run analysis
python analyze_video.py 'https://youtube.com/watch?v=VIDEO_ID' 'Your prompt'
```

### Option 2: Vertex AI (Chunking Enabled!)

```bash
# 1. Setup Google Cloud (one-time)
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable aiplatform.googleapis.com

# 2. Run with chunking for long videos
python analyze_video.py 'https://youtube.com/watch?v=VIDEO_ID' 'Your prompt' \
  --api vertex-ai \
  --enable-chunking \
  --segment-duration 180
```

## Key Difference: Video Chunking

### Google AI ❌
- Processes entire video at once
- Free tier available
- Simple API key setup

### Vertex AI ✅
- **VIDEO CHUNKING WORKS!** Process long videos in parallel segments
- 10x faster for long videos
- ~$0.06 per 45-minute video

## Examples

### Basic Analysis (Google AI, Free)
```bash
python analyze_video.py \
  'https://www.youtube.com/watch?v=eFV3vZYn_Z4' \
  'At what timestamps were goals scored'
```

### 45-Minute Game with Chunking (Vertex AI)
```bash
python analyze_video.py \
  'https://www.youtube.com/watch?v=u3eMw5XqCbQ' \
  'List all goals with timestamps' \
  --api vertex-ai \
  --enable-chunking \
  --segment-duration 180 \
  --max-workers 5 \
  --max-output-tokens 4096
```

### Specific Video Segment (Vertex AI Only)
```bash
# Analyze just minutes 10-15 of a video
python analyze_video.py \
  'https://www.youtube.com/watch?v=VIDEO_ID' \
  'What happens in this segment' \
  --api vertex-ai \
  --enable-chunking \
  --segment-duration 300  # Process just that 5-minute chunk
```

## Command-Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--api` | `google-ai` | Choose API: `google-ai` (free) or `vertex-ai` (chunking) |
| `--model` | `gemini-2.0-flash` | Model to use |
| `--temperature` | `0.2` | Creativity level (0.0-1.0) |
| `--max-output-tokens` | `2048` | Response length limit |

### Chunking Options (Vertex AI Only)
| Option | Default | Description |
|--------|---------|-------------|
| `--enable-chunking` | `False` | Enable parallel video chunking |
| `--segment-duration` | `180` | Seconds per chunk (3 minutes) |
| `--max-workers` | `3` | Parallel processing threads |

## Installation

### With uv (Auto-install Dependencies)
```bash
uv run --with google --with google.genai --with yt-dlp python analyze_video.py URL PROMPT
```

### Traditional Setup
```bash
pip install google-genai yt-dlp
```

### For Vertex AI
Additionally need [Google Cloud SDK](https://cloud.google.com/sdk/docs/install):
```bash
# macOS
brew install google-cloud-sdk

# Or download from https://cloud.google.com/sdk/docs/install
```

## Performance Comparison

### 45-Minute Quidditch Match Analysis

| Feature | Google AI | Vertex AI |
|---------|-----------|-----------|
| Processing Method | Single request | 16 parallel chunks |
| Processing Time | ~2 minutes | ~2-3 minutes |
| Accuracy | Good | Better (focused segments) |
| Cost | Free | ~$0.06 |
| Can process segments | ❌ | ✅ |

## Understanding Timestamps

⚠️ **Timestamps are approximate (±2-3 seconds)** due to 1 FPS video sampling.

## Tips

1. **Long videos (>10 min)**: Use Vertex AI with chunking for better analysis
2. **Free usage**: Stick with Google AI for short clips
3. **Detailed results**: Increase `--max-output-tokens`
4. **Faster processing**: Increase `--max-workers` (Vertex AI)

## Project Structure

```
quidditch-video-analysis/
├── analyze_video.py          # Main unified script
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── docs/                     # Documentation
│   ├── vertex_ai_comparison.md
│   ├── VERTEX_AI_RESULTS.md
│   └── ...
└── archive/                  # Old versions for reference
```

## Troubleshooting

**No API key**: Set `GOOGLE_API_KEY` for Google AI

**Vertex AI errors**: Ensure you've run `gcloud auth application-default login`

**Chunking not working**: Only works with Vertex AI, not Google AI

**Import errors**: Install dependencies with `pip install google-genai yt-dlp`

## License

MIT