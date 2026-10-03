# 0006. OpenAI is the application LLM provider

- **Status:** Accepted
- **Date:** 2026-10-03

## Context
The starter kit specifies Anthropic. The owner has selected
OpenAI for extraction, Ask ActionDesk, and weekly digests.

## Decision
Use the official OpenAI TypeScript SDK and Responses API.

Import the `openai` SDK only in `src/lib/llm/**` and
`supabase/functions/**`. Every application LLM module imports
`server-only`. Keep OPENAI_API_KEY exclusively server-side.

Preserve Zod validation, user-scoped Supabase tools, RLS,
human approval before saving extracted tasks, and UI confirmation
before assistant write tools execute.

This supersedes ADR 0002 while retaining its server-only
access and centralized LLM module requirements.

## Consequences
Use OpenAI-specific requests, streaming, file inputs, caching,
and usage accounting. Verify current model IDs and capabilities
during implementation and choose models using eval results.

## Rules affected
R2 changes from Anthropic SDK restrictions to OpenAI SDK
restrictions. R6 retains its existing server/browser boundary.

## Enforcement
Update dependency-cruiser's SDK import restriction to `openai`.
Retain the required `server-only` imports and browser/admin
boundaries. Prove unauthorized SDK imports fail before
implementing LLM features.