# Use OpenAI models in ActionDesk

ActionDesk can use OpenAI models for its AI features. Since application code has not been built yet, this is mainly a change to architecture documents, guardrails, and kickoff instructions.

Using Codex to build the app and choosing the app's LLM provider are separate choices.

| File | Required change |
|---|---|
| `CLAUDE.md` | Replace Anthropic SDK/key/model guidance with OpenAI SDK/key/model guidance |
| `docs/architecture.md` | Replace the external provider and update R2 to restrict the `openai` SDK to `src/lib/llm/**` and Edge Functions |
| `docs/adr/` | Add ADR 0006 accepting OpenAI as the provider; mark ADR 0002 superseded without deleting it |
| `guardrails/dependency-cruiser.cjs` | Restrict imports of `openai` instead of `@anthropic-ai/sdk`; retain server-only and admin-client restrictions |
| `docs/KICKOFF.md` | Update account setup, extraction API instructions, model comparisons, caching, usage accounting, attachments, and incident exercises |
| `docs/plan.md` | Record the OpenAI integration and its acceptance tests |

References to Claude Code as the development assistant can be updated separately if the guide should be adapted to Codex.

For implementation, use the official `openai` TypeScript SDK with the Responses API, keeping `OPENAI_API_KEY` exclusively in server environment variables. The official OpenAI documentation supports this setup: [Developer quickstart](https://developers.openai.com/api/docs/quickstart).

Extraction should produce structured task proposals and validate them with Zod. Ask ActionDesk should use function tools whose implementations query through the user's Supabase client; write tools still require UI confirmation. See [Function calling guidance](https://developers.openai.com/api/docs/guides/function-calling).

The security architecture stays intact: RLS authorization, user-scoped tools, server-only keys, validated Server Actions, human approval, and append-only migrations.

## Proposed ADR 0006 — Use OpenAI for application LLM features

- **Status:** Proposed

### Context

ActionDesk's starter kit specifies Anthropic, but the owner wants OpenAI models.

### Decision

Use the OpenAI SDK and Responses API through `src/lib/llm/**`, with Edge Functions permitted for background jobs. Preserve all existing validation, authorization, and confirmation requirements.

### Consequences

Update provider-specific prompts, streaming, file inputs, token accounting, caching, and eval comparisons. Select model IDs during implementation using current documentation and measured eval results.

### Rules affected

R2's provider restriction changes. R6's server/browser boundary remains unchanged.

### Enforcement

Update the SDK import guardrail and prove browser imports are rejected.

## Required owner action

The architecture-change procedure in `docs/architecture.md` requires the owner to accept and commit the ADR and locked-file updates before implementation proceeds against them.

This file records the proposal only. It does not change or supersede the accepted architecture or ADRs.
