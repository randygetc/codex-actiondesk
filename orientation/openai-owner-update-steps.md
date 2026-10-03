# Owner steps to approve OpenAI

These are owner edits because the repository locks architecture files against agent changes. Use your editor to make them; do not run database commands.

## 1. Create ADR 0006

Create `docs/adr/0006-openai-is-the-llm-provider.md` with:

```markdown
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
```

## 2. Mark ADR 0002 superseded

In `docs/adr/0002-llm-calls-are-server-side-only.md`, replace:

```markdown
- **Status:** Accepted
```

with:

```markdown
- **Status:** Superseded by 0006
```

Keep its historical contents.

## 3. Update docs/architecture.md

| Location | Change |
|---|---|
| Section 1 external services | Replace `Anthropic API` with `OpenAI API` |
| R2 | Replace `Anthropic SDK` with `OpenAI SDK`; change its ADR reference to `0006` |
| R6 ADR references | Replace `0002, 0004` with `0006, 0004` |

Keep the existing permitted directories and all other rules.

In section 6, replace references to Anthropic SDK import enforcement with OpenAI SDK import enforcement. The document currently mentions ESLint checks that have not been configured; describe dependency-cruiser as the existing configured import check.

## 4. Update CLAUDE.md

Replace `Anthropic TypeScript SDK` with `OpenAI TypeScript SDK`.

Replace working rule 8 with:

```text
8. OPENAI_API_KEY is server-only. Use the OpenAI Responses API
   through the approved LLM module. Check current model IDs
   and capabilities in official OpenAI documentation; don't guess.
```

Preserve the other working rules and locked paths.

## 5. Update the SDK import guardrail

In `guardrails/dependency-cruiser.cjs`, replace the first forbidden rule with:

```javascript
{
  name: 'R2-openai-sdk-only-in-llm',
  comment: 'ADR-0006: the OpenAI SDK may only be imported in src/lib/llm/.',
  severity: 'error',
  from: { pathNot: '^src/lib/llm/' },
  to: { path: '^openai($|/)' },
},
```

This matches both `openai` and SDK subpath imports. Keep the admin-client, component, circular-dependency, and `server-only` rules intact.

Edge Functions remain outside the current `depcruise ... src` scan; this change does not add enforcement for that directory.

## 6. Review your edits

Run these read-only checks:

```bash
git diff --check
git diff -- CLAUDE.md docs/architecture.md docs/adr/ guardrails/dependency-cruiser.cjs
```

Open the newly created ADR separately if it is still untracked: ordinary `git diff` does not show untracked file contents.

Confirm that the changes switch the provider while preserving RLS, validation, server-only keys, and confirmation requirements.

## 7. Commit through the owner's approval process

If GitHub protections are already configured, use a branch and PR. Apply the `architecture-approved` label yourself so the locked-path guardrail permits the changes, then merge after required checks pass.

The kickoff allows an initial owner setup commit directly to `main` in step 1.2. Use that exception only if you are still completing that initial setup.

## Next handoff

Once those owner changes are saved, tell the assistant:

> ADR 0006 is accepted and the locked files are updated. Verify them and complete the Phase 1 plan.

Saving this instruction document does not accept ADR 0006 or modify the locked architecture files.
