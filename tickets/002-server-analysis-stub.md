# Ticket: Scaffold Typed Server Analysis Stub

## Context

- The MVP needs a server endpoint that validates inputs, returns a typed payload, and isolates analysis logic for future expansion.
- TanStack Start supports server functions via `createServerFn`; we want to use that pattern with shared schemas (Zod).
- The implementation should prepare for future Gemini/Vertex integrations without calling external services yet.

## Acceptance Criteria

- A `createServerFn` is available to the client (e.g. exported from `src/routes/index.server.ts` or a new module) that accepts `{ youtubeUrl, prompt }`.
- Request and response schemas live in a shared module (e.g. `src/lib/analysis-schema.ts`) using Zod and are reused on both client and server.
- The server handler returns a stubbed but structured payload (summary text, metadata placeholders, timing, etc.) and handles validation errors cleanly.
- Environment variables needed for future integrations (`GOOGLE_API_KEY`, `GOOGLE_CLOUD_PROJECT`, etc.) are parsed via a dedicated config helper with helpful error messages when missing (but stubbing mode skips external calls).
- Type exports allow the React side to infer the response shape without duplication.

## Tasks

- Add `zod` to dependencies if not already present and wire a shared schema module (`src/lib/analysis-schema.ts`).
- Create a dedicated server function file (e.g. `src/routes/index.server.ts` or `src/server/analyze.ts`) that wraps the `createServerFn` handler.
- Implement validation, stubbed response, and error handling (including distinguishing validation vs unexpected server errors).
- Expose a typed helper (e.g. `export type AnalyzeFormData`) for the client.
- Document expected environment variables and stub behavior in code comments or a short README note.
