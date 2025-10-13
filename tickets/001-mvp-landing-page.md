# Ticket: Replace Landing Page with LLM Video Analysis MVP

## Context

- The current home route (`src/routes/index.tsx`) still renders the template React/TanStack starter.
- We need a focused LLM video analysis experience that matches the MVP flow from the Astro plan: capture a YouTube URL and a prompt, submit, wait, and display a textual summary.
- This ticket covers all client-side work to present the form, handle local validation/state, call the server stub, and render the response.

## Non-Goals

- Wiring the real analysis pipeline (stubbed response is fine here).
- Server-side validation or data processing (covered separately).

## Acceptance Criteria

- Home route shows LLM Video Analysis–branded hero copy, input form (YouTube URL + prompt), submit CTA, and a result panel.
- Client-side validation prevents submission without both fields and highlights invalid YouTube URLs before calling the server.
- Submission lifecycle includes loading state, disabled controls, optimistic progress indicator, and clear error surfacing.
- Successful responses render formatted markdown/text output that is easy to copy/share and persists until the next run.

## Tasks

- Replace `src/routes/index.tsx` component with the new layout, hero, and form.
- Extract reusable UI helpers if needed (`src/components/AnalysisForm.tsx`, `src/components/AnalysisResult.tsx`, etc.).
- Leverage TanStack Start hooks (`useMutation`, router invalidate, etc.) to call the new server function stub.
- Add lightweight client validation (regex or shared schema import) and inline error messaging.
- Style with Tailwind classes already available in the project; ensure dark-friendly look consistent with the LLM Video Analysis theme.
