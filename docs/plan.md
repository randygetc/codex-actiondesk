# Plan

Written by Claude Code in step 1.1. Editable. Must conform to docs/architecture.md.

## Current status

- Starter kit only: application source, package manifest, Supabase configuration, and application tests have not been scaffolded.
- Phase 1 step 1.1 still needs a complete plan covering data model, RLS policies, routes, acceptance criteria, and tests.
- The owner has selected OpenAI for application LLM features. This is a requested provider change, not yet an accepted architecture change.

## Owner-controlled prerequisite: OpenAI provider approval

Before implementing OpenAI access, the owner must accept and commit ADR 0006 and update the locked files listed in `orientation/openai-provider-change.md`: `CLAUDE.md`, `docs/architecture.md`, the affected ADRs, and `guardrails/dependency-cruiser.cjs`.

Until those changes are accepted, the current Anthropic-specific architecture remains authoritative. Do not install or integrate the OpenAI SDK to work around the existing rule.

## Intended OpenAI integration after approval

- Use the official `openai` TypeScript SDK and Responses API through `src/lib/llm/**`; approved Edge Functions may call OpenAI for background jobs.
- Keep `OPENAI_API_KEY` server-side and require `server-only` in application LLM modules.
- Validate extraction output and tool arguments with Zod. Save extracted tasks only after review; execute assistant writes only after UI confirmation through validated Server Actions.
- Give application tools the current user's Supabase client so RLS applies. Scope the background digest explicitly to its workspace.
- Verify current model IDs, supported file inputs, caching behavior, and pricing against official OpenAI documentation during implementation.
- Compare lower-cost and higher-capability models using extraction evals; record exact model IDs, quality, latency, and cost.
- Log usage metadata and enforce application daily spending caps without logging user content or secrets.

### Acceptance checks

- The updated import guardrail rejects `openai` imports in components and other unauthorized application modules.
- A browser import of the LLM module fails because of `server-only`.
- Invalid LLM output cannot become a saved task; unconfirmed write tools cannot mutate data.
- Cross-user tests prove assistant tools cannot read or write another user's data.
- Recorded extraction evals run deterministically without paid API calls; live evals report quality, latency, and cost.
- Usage accounting distinguishes cached input, uncached input, and output tokens; the application cap blocks further calls as specified.

## Other setup gaps

- Owner: resolve the missing Claude guard hook and replace the CODEOWNERS placeholder.
- Owner: configure and verify required GitHub checks and branch protection.
- During scaffolding: activate import and database checks, which currently skip without their prerequisites.
- Treat `.claude/` hooks and permissions as Claude Code configuration, not automatic Codex runtime enforcement.
