# Ticket: Prepare Cloudflare Deployment Workflow

## Context

- The long-term plan targets Cloudflare Pages/Workers, and the MVP should be deployable with minimal friction.
- We need infrastructure docs + config so the team can ship after the MVP functionality is ready.

## Acceptance Criteria

- Cloudflare deployment instructions live in the repo (README section or `docs/deploy-cloudflare.md`) covering build command, output directory, environment variables, and how to configure server functions (if using Workers).
- CI/CD plan captured (manual trigger acceptable for now) including secrets management for API keys.
- Local `.dev.vars` or similar template exists for developers to mirror the production environment locally.

## Tasks

- Audit Vite/TanStack build output to confirm compatibility with Cloudflare Pages/Workers. Document required adapter steps if any.
- Create deployment guide with step-by-step instructions, including Bun/Node version requirements.
- Outline how to set environment variables for Google/Vertex APIs within Cloudflare, including warnings about billing.
- Add follow-up TODO(s) for automating deployments once CI choice (GitHub Actions, etc.) is finalized.
