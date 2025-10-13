# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

LLM Video Analysis webapp built on TanStack Start with Bun 1.3 runtime. Implements video analysis pipeline for YouTube videos using Google's Vertex AI.

## Tech Stack

- **Runtime**: Bun 1.3 (required)
- **Framework**: TanStack Start (React SSR with file-based routing)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL via Railway (shared `pg` pool)
- **Auth**: Better Auth
- **AI**: Google Vertex AI / Gemini models

## Essential Commands

```bash
# Development
~/.bun/bin/bun install
~/.bun/bin/bun run dev

# Production
~/.bun/bin/bun run build
~/.bun/bin/bun server.ts

# Railway deployment
railway up
railway status
railway variables --set "KEY=value"
```

## Architecture

### Database Layer
- Single `pg` Pool shared between Better Auth and Kysely
- Pool exported from `src/lib/auth.ts`
- App queries via `src/lib/db.ts` (Kysely wrapper)
- Never create additional database connections

### Authentication
- Server: `src/lib/auth.ts` - Better Auth configuration
- Client: `src/lib/auth-client.ts` - React hooks
- API handler: `src/routes/api/auth/$.ts`
- Protected routes check `auth.api.getSession({ headers })`

### Video Analysis
- Entry: `src/routes/api.analyze.ts`
- Vertex AI integration: `src/server/analyze-vertex.ts`
- Billing tracking: `src/lib/billing.ts`
- Database table: `billing_usage_ledger`

## Environment Variables

```bash
# Required for production
BETTER_AUTH_SECRET=<secure-random-string>
BETTER_AUTH_DATABASE_URL=<railway-postgres-url>?sslmode=require
GOOGLE_API_KEY=<your-api-key>
GOOGLE_CLOUD_PROJECT=<vertex-ai-project>
DEFAULT_MODEL=gemini-2.5-pro
PORT=3000

# Billing limits
BILLING_USER_DAILY_LIMIT_USD=3
BILLING_GLOBAL_DAILY_LIMIT_USD=10

# Optional
RAILWAY_CA_CERT_PATH=certs/railway-ca.pem
```

## Railway Deployment

1. **Production URL**: https://quidditch-video-analysis-production.up.railway.app
2. **Services**:
   - Main app: `quidditch-video-analysis`
   - Database: `Postgres`
3. **Switch services**: `railway service <name>`
4. **Check logs**: `railway logs`

### TLS Certificate (for local development)
```bash
# Download Railway's CA cert for local PostgreSQL connections
python3 - <<'PY'
import pathlib, re, subprocess
cmd = ["openssl", "s_client", "-showcerts", "-servername", "crossover.proxy.rlwy.net", "-connect", "crossover.proxy.rlwy.net:11287"]
result = subprocess.run(cmd, input="\n", text=True, capture_output=True)
certs = re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", result.stdout, re.S)
if len(certs) < 2: raise SystemExit("CA certificate not found")
pathlib.Path("certs").mkdir(exist_ok=True)
pathlib.Path("certs/railway-ca.pem").write_text(certs[-1] + "\n")
print("wrote certs/railway-ca.pem")
PY
```

## Key Files

- `src/routes/index.tsx` - Main UI with navigation and forms
- `src/components/navigation.tsx` - Top navigation bar
- `src/routes/api.analyze.ts` - Video analysis API endpoint
- `src/lib/billing.ts` - Usage tracking and cost calculation
- `server.ts` - Production server with asset optimization
- `nixpacks.toml` - Railway build configuration

## Development Notes

- Always use `~/.bun/bin/bun` not `npm` or `node`
- Reuse the shared database pool - don't create new connections
- Server functions use `createServerFn` for backend-only code
- Protected routes must check session before processing
- Billing tracks every authenticated API call in `billing_usage_ledger`

## Known Issues

- Railway external proxy serves cert with `CN=localhost` - handled in `src/lib/auth.ts`
- TanStack Devtools is alpha - may need `resolve.dedupe = ['solid-js']` in vite.config.ts
## MCP Tooling

- Use the Playwright MCP agent located under `.playwright-mcp` for UI verification.
- Capture before/after screenshots and attach them when validating visual changes.
- Prefer MCP-based navigation and evaluation before modifying UI components.
