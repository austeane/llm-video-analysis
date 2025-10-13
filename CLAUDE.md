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
- PostgreSQL connections are centralized through the shared `pg` `Pool` exported from `src/lib/auth.ts`. Reuse `authDbPool` (e.g., via Kysely) instead of introducing Bun’s `SQL` client or additional drivers.

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
- **Database Driver**: `pg` Pool shared via Kysely (`PostgresDialect`)
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
  - Server entry: `src/lib/auth.ts` configures Better Auth with a shared `pg` connection pool wired to the Railway PostgreSQL service (no local fallback) and the `reactStartCookies` plugin so TanStack Start server routes manage cookies automatically.
  - Client SDK: `src/lib/auth-client.ts` exports a shared `authClient` instance (React variant) that powers session hooks and email/password flows on the frontend.
  - API handler: `src/routes/api/auth/$.ts` routes `GET`/`POST` requests to `auth.handler`, matching the TanStack integration guide.

- **Session Enforcement**
  - Protected operations (e.g., `src/routes/api.analyze.ts`) call `auth.api.getSession({ headers })` and return `401` when sessions are missing.
  - The home route (`src/routes/index.tsx`) gates the analyzer UI behind Better Auth's `useSession` hook and exposes sign-in/sign-up/sign-out flows via the shared `authClient`.

- **Environment & Secrets**: Set `BETTER_AUTH_SECRET` in `.env` (Better Auth throws in production when absent). `BETTER_AUTH_DATABASE_URL` (or `DATABASE_URL`) must point to the Railway Postgres instance—grab `DATABASE_PUBLIC_URL` via `railway variables --service Postgres --json` and append `?sslmode=require` for local development. `BETTER_AUTH_DATABASE_POOL_MAX` tunes the shared `pg` pool size, and `VITE_BETTER_AUTH_URL` is only needed when the auth handler lives on another origin.
- **TLS**: Download the Railway Postgres CA certificate (see Railway CLI workflow below) and point `RAILWAY_CA_CERT_PATH` at that PEM file so the `pg` client can keep `rejectUnauthorized: true`. Without the cert the code falls back to `rejectUnauthorized: false` with a warning.

## Database Architecture Clarification

### The Three-Layer Database Stack

1. **Railway PostgreSQL** (Infrastructure Layer)
   - Railway hosts the production database and enforces TLS (`sslmode=require`)
   - Connection strings live in `BETTER_AUTH_DATABASE_URL` / `DATABASE_URL`
   - Railway’s CA certificate enables full certificate verification locally

2. **Shared `pg` Pool** (Driver Layer)
   - `src/lib/auth.ts` instantiates a single `Pool` from the `pg` package
   - TLS is configured based on the connection string and Railway CA cert
   - Pool size is controlled via `BETTER_AUTH_DATABASE_POOL_MAX` (defaults to 10)

3. **Application Access (Better Auth + Kysely)** (Query Layer)
   - Better Auth receives the pool for auth tables (`user`, `session`, etc.)
   - `src/lib/db.ts` wraps the same pool with Kysely’s `PostgresDialect` for app tables (e.g., `billing_usage_ledger`)
   - All downstream code should import either `auth` or `db` instead of creating new connections

### How They Work Together

```typescript
// 1. Railway provides the database URL and TLS cert
const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL

// 2. Initialize a single pg Pool with TLS
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    ca: railwayCertificate,
    rejectUnauthorized: true,
  },
})

// 3a. Share the pool with Better Auth
export const auth = betterAuth({
  database: pool,
})

// 3b. Reuse the pool via Kysely for application queries
export const db = new Kysely({
  dialect: new PostgresDialect({ pool }),
})
```

### Usage Patterns

```typescript
// Fetch data with Kysely (reuses the shared pool automatically)
const latestRuns = await db
  .selectFrom('billing_usage_ledger')
  .selectAll()
  .orderBy('created_at', 'desc')
  .limit(10)
  .execute()

// Better Auth APIs use the same pool under the hood
const session = await auth.api.getSession({ headers: request.headers })
```

### Key Points

- One pool to rule them all—do not instantiate additional drivers
- Kysely is the preferred query builder for app tables; it already shares the pool
- `BETTER_AUTH_DATABASE_POOL_MAX` controls pooling for both auth and app queries
- Railway PostgreSQL expects TLS; keep `RAILWAY_CA_CERT_PATH` in sync locally
- The shared pool ensures predictable connection counts in production
- Close the pool (`await pool.end()`) only during graceful shutdown flows

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

### Billing & Usage Limits

- Usage accounting lives in `src/lib/billing.ts`, which derives token counts from Vertex AI `usageMetadata` and converts them to USD using Google’s public pricing (`/M tokens`). Default mapping covers Gemini 1.5/2.x Flash/Pro; override or extend via `BILLING_PRICING_OVERRIDES` (JSON map of model → `{ inputPerMillion, outputPerMillion }`).
- Per-user and global budgets default to $3 and $10 per UTC day. Override with `BILLING_USER_DAILY_LIMIT_USD` and `BILLING_GLOBAL_DAILY_LIMIT_USD`. All comparisons truncate to the start of the current UTC day.
- Persist cost snapshots in PostgreSQL table `billing_usage_ledger`. Create it by running `tickets/021-billing-usage-ledger.sql` against the Better Auth database (uses `DOUBLE PRECISION` USD columns and a unique `request_id`).
- Each analysis request inserts a ledger row (only when authenticated). Anonymous submissions short‑circuit with a 401 response so we never spend budget on unauthenticated users.
- The frontend now renders the analysis form for guests, shows a “preview mode” banner, and surfaces API responses (including budget blockers) via the shared `AnalyzeResponse.metadata.billing` payload.

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

# Billing Configuration
BILLING_USER_DAILY_LIMIT_USD=3
BILLING_GLOBAL_DAILY_LIMIT_USD=10
# Optional JSON overrides e.g. {"gemini-2.5-pro":{"inputPerMillion":1.25,"outputPerMillion":10}}
BILLING_PRICING_OVERRIDES=
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
