# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the LLM Video Analysis webapp built on TanStack Start with Bun 1.3 as the runtime. The project implements an LLM-backed video analysis pipeline for sports footage, forked from the `tanstack-start-bun-hosting` template with production-ready server optimizations.

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

- **Better Auth Documentation**: https://www.better-auth.com/llms.txt
  - Installation, configuration, and plugin ecosystem reference
  - Includes dedicated guidance for [TanStack Start integration](https://www.better-auth.com/docs/integrations/tanstack)
  - Session management patterns for both server handlers and the React client SDK

These documentation sources provide Claude Code with detailed context for framework-specific features, deployment strategies, and runtime optimizations.

## Runtime Constraints

- Stick to Bun 1.3 for all tooling and scripts—do not fall back to Node-specific CLIs or runtimes.
- PostgreSQL access must go through Bun’s built-in `SQL` client (`new SQL(...)`); do not add the `pg` package or other Node-only drivers.

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
- **Database Driver**: Bun SQL client (PostgreSQL adapter bundled with Bun 1.3)
- **Type Safety**: TypeScript with strict mode
- **Path Aliases**: `@/*` maps to `./src/*`

### Core Architecture Patterns

#### 1. Server Functions (API Layer)

TanStack Start uses `createServerFn` for server-side logic that runs only on the backend:

```typescript
// Pattern: Server functions in route files
const analyzeVideo = createServerFn({
  method: 'POST',
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
- Configurable via environment variables (STATIC*PRELOAD*\*)
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

## Authentication

- **Better Auth Integration**
  - Server entry: `src/lib/auth.ts` configures Better Auth with Bun's built-in `SQL` client wired to the Railway PostgreSQL service (no local fallback) and the `reactStartCookies` plugin so TanStack Start server routes manage cookies automatically.
  - Client SDK: `src/lib/auth-client.ts` exports a shared `authClient` instance (React variant) that powers session hooks and email/password flows on the frontend.
  - API handler: `src/routes/api/auth/$.ts` routes `GET`/`POST` requests to `auth.handler`, matching the TanStack integration guide.

- **Session Enforcement**
  - Protected operations (e.g., `src/routes/api.analyze.ts`) call `auth.api.getSession({ headers })` and return `401` when sessions are missing.
  - The home route (`src/routes/index.tsx`) gates the analyzer UI behind Better Auth's `useSession` hook and exposes sign-in/sign-up/sign-out flows via the shared `authClient`.

- **Environment & Secrets**: Set `BETTER_AUTH_SECRET` in `.env` (Better Auth throws in production when absent). `BETTER_AUTH_DATABASE_URL` (or `DATABASE_URL`) must point to the Railway Postgres instance—grab `DATABASE_PUBLIC_URL` via `railway variables --service Postgres --json` and append `?sslmode=require` for local development. `BETTER_AUTH_DATABASE_POOL_MAX` tunes Bun SQL pool size, and `VITE_BETTER_AUTH_URL` is only needed when the auth handler lives on another origin.
- **TLS**: Download the Railway Postgres CA certificate (see Railway CLI workflow below) and point `RAILWAY_CA_CERT_PATH` at that PEM file so Bun's SQL client can keep `rejectUnauthorized: true`. Without the cert the code falls back to `rejectUnauthorized: false` with a warning.

## Database Architecture Clarification

### The Three-Layer Database Stack

1. **Railway PostgreSQL** (Infrastructure Layer)
   - Railway provides the actual PostgreSQL database instance running on their cloud infrastructure
   - Accessible via connection string: `postgresql://user:pass@crossover.proxy.rlwy.net:11287/railway`
   - Railway requires TLS/SSL connections (`sslmode=require`) for security
   - Provides the CA certificate for secure connections with certificate verification

2. **Bun's SQL Client** (Driver & Query Layer)
   - Bun 1.3+ includes a built-in `SQL` class that provides a full PostgreSQL client
   - Supports direct queries via tagged template literals: `db\`SELECT \* FROM users\``
   - Can also use the global `sql` tagged template after setting `sql.default`
   - Configured via `new SQL(options)` where options include:
     - `url`: The Railway PostgreSQL connection string
     - `tls`: TLS configuration including CA certificate for secure connections
     - `max`: Connection pool size
     - `prepare`: Whether to use prepared statements (default: true)
   - **Key Features in Bun 1.3:**
     - Tagged template queries with automatic parameterization
     - Array helpers: `sql.array(values, type)` for PostgreSQL arrays
     - Dynamic column operations: `sql(object, ...columns)`
     - Simple query protocol: `.simple()` for multi-statement queries
     - Full PostgreSQL type support including JSONB, arrays, etc.

3. **Better Auth** (Application Layer)
   - Better Auth accepts Bun's SQL client instance as its database adapter
   - While Bun's SQL _can_ run direct queries, Better Auth handles all auth-related SQL internally
   - Manages tables like `user`, `session`, `account`, etc.
   - Provides high-level APIs instead of raw SQL:
     - `auth.api.signUpEmail()`
     - `auth.api.getSession()`
     - etc.

### How They Work Together

```typescript
// 1. Railway provides the database URL and TLS cert
const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL

// 2. Bun's SQL client creates the connection
const database = new SQL({
  url: databaseUrl,
  tls: {
    ca: railwayCertificate, // Railway's CA cert for secure connection
    rejectUnauthorized: true, // Verify the server's identity
  },
})

// 3a. You CAN use Bun SQL directly for custom queries (Bun 1.3+)
const users = await database`SELECT * FROM users WHERE age > ${18}`

// 3b. But for auth, Better Auth uses the connection internally
const auth = betterAuth({
  database, // Pass Bun's SQL client to Better Auth
  // Better Auth handles all auth SQL queries internally
})
```

### Usage Patterns

```typescript
// Using 'await using' for automatic cleanup (recommended)
await using db = new SQL({ url: databaseUrl, tls: tlsConfig })
const result = await db`SELECT * FROM users`

// Or traditional approach with manual connection management
const db = new SQL({ url: databaseUrl, tls: tlsConfig })
const result = await db`SELECT * FROM users`
// Remember to close when done: db.close()
```

### Key Points

- **Bun 1.3+ has full SQL query capabilities** - not just a connection wrapper
- Better Auth uses Bun's SQL client but handles auth queries internally
- You can use Bun SQL directly for non-auth database operations if needed
- Railway PostgreSQL is the database server itself
- TLS with CA verification ensures secure communication
- The `await using` syntax ensures proper connection cleanup

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
railway init -n llm-video-analysis

# Deploy to Railway
railway up

# Generate public domain
railway domain

# Set environment variables
railway variables set GOOGLE_API_KEY=your-api-key
```

Railway automatically detects Bun via nixpacks.toml and handles the build/deployment process.

### Railway CLI Workflow (Agents)

- Default project: `quidditch-video-analysis` (environment `production`)
- Switch services non-interactively with `railway service quidditch-video-analysis` (app) and `railway service Postgres` (database) before running CLI commands
- Capture deployment status with `railway status`, `railway deployment list --json`, and `railway logs -n 20` to verify the Bun server boots cleanly
- Use `railway variables --json` (per service) to confirm domains, internal hosts, and proxy ports; document findings in `PROJECT_STATUS.md` under the Railway CLI snapshot section with a fresh timestamp
- Preserve sensitive strings already tracked in status docs; avoid duplicating secrets elsewhere
- When hacking on auth/database flows, keep everything on Bun’s SQL driver—no `pg` install step is needed or desired
- Download the Postgres CA for local TLS once via:

  ```bash
  python3 - <<'PY'
  import pathlib, re, subprocess

  cmd = [
      "openssl",
      "s_client",
      "-showcerts",
      "-servername",
      "crossover.proxy.rlwy.net",
      "-connect",
      "crossover.proxy.rlwy.net:11287",
  ]
  result = subprocess.run(cmd, input="\n", text=True, capture_output=True)
  certs = re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", result.stdout, re.S)
  if len(certs) < 2:
      raise SystemExit("CA certificate not found in chain")
  pathlib.Path("certs").mkdir(exist_ok=True)
  pathlib.Path("certs/railway-ca.pem").write_text(certs[-1] + "\n")
  print("wrote certs/railway-ca.pem")
  PY
  ```

  Add `certs/railway-ca.pem` to `.gitignore` (already configured) and surface the file path through `RAILWAY_CA_CERT_PATH`.

### Cloudflare Pages/Workers

The build output is compatible with Cloudflare deployment:

- Static assets from `dist/client` → Pages
- Server bundle from `dist/server` → Workers
- Use Cloudflare KV for temporary video cache

### Bun Production Compilation

For standalone deployment:

```bash
bun build --compile --minify --bytecode ./server.ts --outfile llm-video-analysis
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

## Known Issues

- TanStack Devtools (`@tanstack/react-devtools`) remains **alpha** ([overview](https://tanstack.com/devtools/latest/docs/framework/react/overview)) but we enable it for a unified panel. We run it without any extra plugins to avoid Solid duplication issues; if you ever add additional panels (e.g., router/query devtools), keep `resolve.dedupe = ['solid-js']` in `vite.config.ts` to prevent the `"You appear to have multiple instances of Solid"` warning, and review their changelog for breaking API updates.
- Railway's external Postgres proxy (`*.proxy.rlwy.net`) serves a certificate with `CN=localhost`. `src/lib/auth.ts` loads the bundled CA and overrides `checkServerIdentity` only for that proxy so Better Auth can connect while keeping TLS validation. If Railway updates their certificates, revisit this override.
