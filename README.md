# LLM Video Analysis

An AI-powered YouTube video analysis application built with TanStack Start, Bun, and Google's Gemini models. Analyze video content with custom prompts to extract insights, summaries, and structured information.

## 🚀 Features

### Video Analysis

- **YouTube Video Analysis**: Analyze any YouTube video with custom prompts
- **AI-Powered Insights**: Extract summaries, key points, and structured information
- **Real-time Processing**: See results as they're generated
- **Flexible Prompts**: Ask specific questions about video content
- **Structured Output**: Get organized sections with timestamps

### Technical Features

- **TanStack Start + Form**: Modern React SSR with form validation
- **Bun Runtime**: Fast, efficient JavaScript runtime
- **Type-Safe API**: Zod schemas for request/response validation
- **Stub Mode**: Test without API keys using mock data
- **Production-Ready Server**: Optimized static asset serving with intelligent caching

## 📦 Installation

This project was created with TanStack Start:

```bash
bunx create-start-app@latest
```

Install dependencies:

```bash
bun install
```

## 🏃‍♂️ Development

### Prerequisites

- Bun 1.3+ (install with `curl -fsSL https://bun.sh/install | bash`)
- Node.js 20+ (for compatibility)
- Google API Key (optional, for production mode)

### Quick Start

1. Install dependencies:

   ```bash
   ~/.bun/bin/bun install
   ```

2. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

3. Start development server:

   ```bash
   ~/.bun/bin/bun run dev
   ```

4. Open http://localhost:3000 in your browser

### Environment Configuration

Create a `.env.local` file with the following variables:

```bash
# Stub Mode (default: true)
# Set to false to use real Google AI API
USE_STUB=true

# Google AI Configuration (required for production)
GOOGLE_API_KEY=your-gemini-api-key-here

# Vertex AI Configuration (optional, for advanced features)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
ENABLE_CHUNKING=false
SEGMENT_DURATION=180

# Model Configuration
DEFAULT_MODEL=gemini-2.0-flash-exp
```

### Getting API Keys

1. **Google AI (Gemini) API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/apikey)
   - Create a new API key
   - Add to `.env.local` as `GOOGLE_API_KEY`

2. **Vertex AI (Optional)**:
   - Set up a Google Cloud Project
   - Enable the Vertex AI API
   - Configure authentication
   - Add project details to `.env.local`

## 🔨 Production Build

Build the application for production:

```bash
bun run build
```

## 🚀 Production Server with server.ts

### Quick Start - Use in Your Project

You can easily use this production server in your own TanStack Start project:

1. **Copy the `server.ts` file** into your project root
2. **Build your project** with `bun run build`
3. **Start the server** directly with:
   ```bash
   bun run server.ts
   ```

Or add it to your `package.json` scripts:

```json
{
  "scripts": {
    "start": "bun run server.ts"
  }
}
```

Then run with:

```bash
bun run start
```

### Server Features

The `server.ts` implements a high-performance production server with the following features:

#### 1. Intelligent Asset Loading

The server automatically decides which files to preload into memory and which to serve on-demand:

- **In-Memory Loading**: Small files (default < 5MB) are loaded into memory at startup
- **On-Demand Loading**: Large files are loaded from disk only when requested
- **Optimized Performance**: Frequently used assets are served from memory

#### 2. Configuration via Environment Variables

```bash
# Server Port (default: 3000)
PORT=3000

# Maximum file size for in-memory loading (in bytes, default: 5MB)
STATIC_PRELOAD_MAX_BYTES=5242880

# Include patterns (comma-separated, only these files will be preloaded)
STATIC_PRELOAD_INCLUDE="*.js,*.css,*.woff2"

# Exclude patterns (comma-separated, these files will be excluded)
STATIC_PRELOAD_EXCLUDE="*.map,*.txt"

# Enable detailed logging
STATIC_PRELOAD_VERBOSE=true
```

### Example Configurations

#### Minimal Memory Footprint

```bash
# Preload only critical assets
STATIC_PRELOAD_MAX_BYTES=1048576 \
STATIC_PRELOAD_INCLUDE="*.js,*.css" \
STATIC_PRELOAD_EXCLUDE="*.map,vendor-*" \
bun run start
```

#### Maximum Performance

```bash
# Preload all small assets
STATIC_PRELOAD_MAX_BYTES=10485760 \
bun run start
```

#### Debug Mode

```bash
# With detailed logging
STATIC_PRELOAD_VERBOSE=true \
bun run start
```

### Server Output

The server displays a clear overview of all loaded assets at startup:

```txt
📦 Loading static assets from ./dist/client...
   Max preload size: 5.00 MB
   Include patterns: *.js,*.css,*.woff2

📁 Preloaded into memory:
   /assets/index-a1b2c3d4.js           45.23 kB │ gzip:  15.83 kB
   /assets/index-e5f6g7h8.css           12.45 kB │ gzip:   4.36 kB

💾 Served on-demand:
   /assets/vendor-i9j0k1l2.js          245.67 kB │ gzip:  86.98 kB

✅ Preloaded 2 files (57.68 KB) into memory
ℹ️  1 files will be served on-demand (1 too large, 0 filtered)

🚀 Server running at http://localhost:3000
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
bun run test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## 🚀 Deployment

### Railway (Recommended)

This project is configured for one-click deployment to Railway:

1. **Connect Repository**: Push your code to GitHub
2. **Deploy to Railway**:
   ```bash
   railway login
   railway init -n llm-video-analysis
   railway up
   ```
3. **Set Environment Variables** in Railway dashboard:
   - `USE_STUB=false` (for production)
   - `GOOGLE_API_KEY=your-api-key`
4. **Generate Domain**:
   ```bash
   railway domain
   ```

### Cloudflare Pages/Workers

For Cloudflare deployment (coming soon - see ticket 004):

- Static assets → Cloudflare Pages
- Server functions → Cloudflare Workers
- Use Cloudflare KV for caching

### Manual Deployment

1. Build the application:

   ```bash
   bun run build
   ```

2. Run the production server:
   ```bash
   PORT=3000 bun server.ts
   ```

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
bun run lint
bun run format
bun run check
```

## 📋 Project Tickets

The `tickets/` directory contains development tickets tracking the implementation:

- **001**: MVP Landing Page ✅ - Video analysis form with validation
- **002**: Server Analysis Stub ✅ - Typed server endpoint with mock responses
- **003**: Analyzer Pipeline Integration - Port Python analyzer to TypeScript
- **004**: Cloudflare Deployment - Production deployment configuration
