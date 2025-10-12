# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a video analysis webapp built on TanStack Start with Bun 1.3 as the runtime. The project implements an LLM-backed video analysis pipeline for sports footage (originally designed for Quidditch), forked from the `tanstack-start-bun-hosting` template with production-ready server optimizations.

## LLM Documentation References

When working with this project, Claude Code can reference these comprehensive documentation sources:

- **Bun Runtime Documentation**: https://bun.sh/llms-full.txt
  - Complete Bun API reference, performance optimizations, and runtime features
  - Includes TypeScript/JavaScript bundling, testing, and deployment guidance

- **Railway Deployment Documentation**: https://docs.railway.com/api/llms-docs.md
  - Railway CLI usage, deployment patterns, and configuration
  - Environment variables, domains, and production deployment strategies

- **TanStack Start Cookbook**: https://raw.githubusercontent.com/jherr/tanstack-start-cookbook/refs/heads/main/TanStack-Start-React-Cookbook.md
  - Comprehensive patterns and recipes for TanStack Start applications
  - Server functions, routing, data fetching, and SSR best practices

- **TanStack Start Migration Tracking**: https://github.com/TanStack/router/discussions/2863#discussioncomment-14052148
  - Important changes and migration steps during TanStack Start BETA
  - Breaking changes between versions (especially the Vite migration in v1.121.0)
  - Configuration updates and renamed exports/components

These documentation sources provide Claude Code with detailed context for framework-specific features, deployment strategies, and runtime optimizations.

## Essential Commands

### Development
```bash
# Install dependencies (requires Bun 1.3+)
~/.bun/bin/bun install

# Start development server on port 3000
~/.bun/bin/bun run dev

# Run in background for concurrent development
~/.bun/bin/bun run dev &
```

### Production
```bash
# Build for production (creates dist/client and dist/server)
~/.bun/bin/bun run build

# Start production server with optimized asset loading
~/.bun/bin/bun server.ts

# With environment configuration
PORT=3000 STATIC_PRELOAD_MAX_BYTES=5242880 ~/.bun/bin/bun server.ts
```

### Testing & Quality
```bash
# Run tests with Vitest
~/.bun/bin/bun run test

# Run specific test file
~/.bun/bin/bun run test src/routes/__tests__/analyzer.test.tsx

# Linting and formatting
~/.bun/bin/bun run lint
~/.bun/bin/bun run format
~/.bun/bin/bun run check  # Runs both prettier and eslint with fixes
```

## Architecture

### Tech Stack
- **Runtime**: Bun 1.3 (required - install with `curl -fsSL https://bun.sh/install | bash`)
- **Framework**: TanStack Start (React SSR with file-based routing)
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite)
- **Build Tool**: Vite 7
- **Type Safety**: TypeScript with strict mode
- **Path Aliases**: `@/*` maps to `./src/*`

### Core Architecture Patterns

#### 1. Server Functions (API Layer)
TanStack Start uses `createServerFn` for server-side logic that runs only on the backend:
```typescript
// Pattern: Server functions in route files
const analyzeVideo = createServerFn({
  method: 'POST'
})
  .inputValidator((data: AnalyzeVideoInput) => data)
  .handler(async ({ data }) => {
    // Server-only code - has access to env vars, filesystem, etc.
    return await processVideo(data)
  })
```

#### 2. Route-based Code Splitting
Routes in `src/routes/` are automatically code-split. The `__root.tsx` provides the shell component wrapping all routes.

#### 3. Production Server (`server.ts`)
Custom Bun server with intelligent static asset management:
- Preloads small assets (<5MB) into memory at startup
- Serves large files on-demand from disk
- Configurable via environment variables (STATIC_PRELOAD_*)
- Shows Vite-like asset overview on startup

#### 4. Video Analysis Pipeline Integration Points
Based on the webapp plan, the architecture should support:
- **Input Layer**: YouTube URL validation and prompt collection (Zod schemas)
- **Processing Layer**: Server functions calling Python analyzer or TypeScript port
- **Provider Abstraction**: Support for both Google AI (free) and Vertex AI (chunking)
- **Response Streaming**: Progressive updates during long-running analysis

### Directory Structure
```
src/
  routes/           # File-based routing (TanStack Start)
    __root.tsx      # Root layout with head content
    index.tsx       # Landing page (to be replaced with analysis form)
    api.*.ts        # API routes (server-only)
  components/       # Shared React components
  lib/             # Business logic and utilities
    analyzer.ts    # Video analysis core (to be implemented)
  styles.css       # Global styles (Tailwind directives)

dist/              # Production build output
  client/          # Client-side assets
  server/          # SSR server bundle
```

## Video Analysis Implementation Strategy

The project needs to integrate the Python video analyzer (`analyze_video.py`) as a TypeScript module:

### Current Python Pipeline Components
1. **Video Input**: YouTube URL processing with yt-dlp
2. **Provider Support**: Google AI (simple) and Vertex AI (with chunking)
3. **Chunking Strategy**: Split long videos into segments for parallel processing
4. **LLM Integration**: Google Gemini models for analysis

### TypeScript Port Requirements
- Use `@google/generative-ai` package for Gemini integration
- Implement YouTube video info extraction (consider `ytdl-core` alternative)
- Create provider abstraction layer for Google AI vs Vertex AI
- Support streaming responses for real-time updates

### Environment Variables Needed
```bash
# For Google AI
GOOGLE_API_KEY=your-api-key

# For Vertex AI
GOOGLE_CLOUD_PROJECT=project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Analysis Configuration
ENABLE_CHUNKING=true
SEGMENT_DURATION=180
DEFAULT_MODEL=gemini-2.0-flash-exp
```

## Development Workflow

1. **Server Functions First**: Implement backend logic in server functions before UI
2. **Type Safety**: Define shared types in `src/lib/types.ts` for client-server communication
3. **Progressive Enhancement**: Build forms that work without JavaScript, enhance with React
4. **Asset Optimization**: Use Vite's build optimization; server.ts handles production serving
5. **Environment Management**: Use `.env.local` for local development (git-ignored)

## Deployment Considerations

### Railway (Recommended)
Deploy directly to Railway with automatic Bun support:
```bash
# Login to Railway
railway login

# Initialize project
railway init -n quidditch-video-analysis

# Deploy to Railway
railway up

# Generate public domain
railway domain

# Set environment variables
railway variables set GOOGLE_API_KEY=your-api-key
```
Railway automatically detects Bun via nixpacks.toml and handles the build/deployment process.

### Cloudflare Pages/Workers
The build output is compatible with Cloudflare deployment:
- Static assets from `dist/client` → Pages
- Server bundle from `dist/server` → Workers
- Use Cloudflare KV for temporary video cache

### Bun Production Compilation
For standalone deployment:
```bash
bun build --compile --minify --bytecode ./server.ts --outfile quidditch-analyzer
```

## Testing Strategy

### Unit Tests
- Test analyzer functions in isolation
- Mock external API calls (Google AI, YouTube)
- Use Vitest's built-in mocking capabilities

### Integration Tests
- Test full server function flows
- Validate error handling for invalid URLs
- Test streaming response handling

### E2E Considerations
- Test actual video analysis with small sample videos
- Validate UI form submissions and loading states
- Test error recovery and retry mechanisms