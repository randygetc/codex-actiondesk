# 0008. Account for LLM cost by workflow

- **Status:** Accepted
- **Date:** 2026-10-05

Number 0008 is proposed because the implementation plan already assigns proposed ADR 0007 to background writes. Saving this draft does not accept it or authorize implementation.

## Context

Individual API-call costs do not measure the cost of delivering a user-visible AI result. Extraction validation retries, Ask tool loops, and digest retries can consume multiple model calls within one operation. Failed and cancelled operations can also incur charges.

ActionDesk needs reliable workflow-level accounting for spending controls, operational reporting, and model evaluations. This must preserve OpenAI as the accepted provider under ADR 0006, user-scoped tools under ADR 0003, RLS, and content-free usage logging.

Workspaces and weekly digests arrive in Phase 3. Workflow accounting must begin in Phase 2 without prematurely introducing those features or authorizing background writes.

## Decision

### Workflow identity and outcomes

Create a server-generated workflow ID before the first provider request.

A workflow represents:

- `extract_tasks`: one extraction submission, including validation retries.
- `ask_actiondesk`: one submitted user turn, including its tool-loop model calls.
- `weekly_digest`: one workspace's scheduled digest for a defined reporting period, including resumptions and retries.

Automatic retries and resumptions retain the workflow ID. Duplicate delivery of the same operation must not create a second workflow. A deliberate new submission creates a new workflow.

Workflow status is `running`, `success`, `failed`, or `cancelled`. Accounting completeness is tracked separately from execution status.

Extraction succeeds when validated results are delivered to the review screen. User approval and task persistence remain separate operations. Ask succeeds when a final answer or validated action proposal is delivered; proposed writes still require confirmation. Digest AI generation succeeds when its validated summary is durably available; email delivery is tracked separately in digest run state.

### Per-attempt accounting

Record every actual provider request attempt in `llm_usage`, including validation retries, transport retries, failed requests, and cancelled requests.

Each attempt records:

- Internal call ID, workflow ID, attempt number, and retry classification.
- Verified user attribution and workspace scope when available.
- Feature, provider, exact model identifier, and provider request/response identifiers when available.
- Provider-reported numeric token counts and other applicable billable usage categories.
- Calculated USD cost and immutable pricing version.
- Start/completion timestamps, API latency, safe outcome code, and accounting state.

SDK retry behavior must be configured or instrumented so attempts are observable. A tool-loop continuation is an additional call, not automatically a retry.

Recording the same attempt repeatedly must not duplicate its usage or charge.

Missing usage after a timeout or interrupted stream is **unknown**, not zero. Zero cost may be recorded only when nonbilling is established. Late usage may settle an existing attempt without creating another charge.

Do not store prompts, responses, notes, extracted text, files, keys, or raw provider exceptions in usage records or structured logs. Persist only allowlisted accounting metadata and safe error codes.

### Pricing and workflow totals

Calculate costs from provider-reported usage and an immutable, versioned server-side pricing table. Do not estimate consumed tokens from text length.

Pricing must distinguish all billable categories applicable to the selected model and request configuration. Cached tokens must not be counted again as ordinary input. Any applicable non-token provider charges must be included or explicitly identified as outside the reported cost.

Use exact decimal arithmetic with a documented precision and rounding policy. Preserve historical pricing versions.

Create `llm_workflows` to hold workflow identity, attribution, status, accounting completeness, call/retry counts, aggregate token counts, calculated cost, and timestamps.

Usage rows are the accounting source of truth. Stored workflow totals are maintained summaries. For workflows with fully settled accounting:

**Workflow total cost = the sum of its recorded call costs.**

For incomplete accounting, the recorded total represents known cost and must be visibly marked incomplete.

Recording, settlement, and finalization must be idempotent and concurrency-safe. Reconciliation must recover unfinished workflows and late usage without duplicating charges. A passing sum invariant does not establish completeness if attempts are missing.

Track workflow elapsed time separately from summed API-call latency.

### Spending caps and privileges

Enforce caps before every additional provider attempt using atomic reservations. Settle reservations against actual recorded usage, including failures and retries. Unresolved attempts retain a reservation until reconciliation or an explicit resolution policy applies.

Define the cap timezone, daily attribution rule, reservation bounds, and maximum output/call limits during Phase 2 planning.

Clients must not be able to forge, alter, or delete authoritative accounting records through direct database requests. RLS must protect usage visibility and workflow scope.

This ADR does **not** authorize admin-client imports into user request paths or LLM tools. The trusted accounting write mechanism requires review before implementation; any necessary privilege exception requires a separate accepted ADR.

Global usage reporting requires explicitly defined application-admin authorization. Workspace ownership does not confer global administration privileges.

### Reporting and evaluations

Report spend by feature, model, user/workspace, and day, with incomplete accounting clearly identified.

Distinguish:

- **Average workflow cost:** total cost divided by workflow count.
- **Average successful-workflow cost:** successful-workflow cost divided by successful-workflow count.
- **Effective cost per success:** total cost, including failed and cancelled workflows, divided by successful-workflow count.

Use a consistent reporting cohort and return undefined when a denominator is zero.

Also report success rate, calls and tokens per workflow, workflows requiring retries, failed/cancelled workflow spend, and elapsed latency. Cached-token savings are a calculated comparison against uncached pricing, including applicable cache-write overhead.

Live evaluations use the same accounting logic, with eval traffic separately identified from production traffic. Compare models on identical cases using quality, latency, and effective cost per successful case. A cheaper model is eligible only if it satisfies the agreed quality threshold.

### Phasing

Introduce workflow accounting before the first live Phase 2 feature.

Phase 2 demonstrates Extraction and Ask accounting, including a retry and a failed workflow. Manually verify at least one calculation against provider usage and the recorded pricing version.

Phase 3 adds workspace attribution through an explicit migration/backfill policy and demonstrates weekly digest accounting. Define scheduled-job attribution separately from interactive user identity. Digest background writes remain gated by the separate background-write ADR.

Record checkpoint evidence in `docs/learnings.md` without sensitive content.

## Consequences

ActionDesk can measure the cost of successful outcomes, expose retry/failure spend, and compare model economics without ignoring quality.

The system requires durable attempt tracking, pricing history, reservations, reconciliation, and additional authorization tests. Calculated charges may temporarily be incomplete and must not be presented as invoice-reconciled spend.

Alternatives considered:

- **Call-only tracking:** simpler, but does not measure user-visible operation cost.
- **Completion-only aggregation:** simpler, but misses interrupted workflows and cannot enforce caps during execution.
- **Provider billing dashboards alone:** useful for reconciliation, but insufficient for application workflow attribution.
- **Admin-client accounting in user paths:** rejected because it violates existing architectural boundaries.

## Rules affected

- **R2/R6:** unchanged; provider access and keys remain within approved server boundaries.
- **R3/R4:** unchanged; LLM tools retain user-scoped clients and write confirmation.
- **R1:** applies to both accounting tables, with tested visibility and write restrictions.
- **R5:** unchanged by this ADR. Background writes or additional accounting privilege exceptions require separate approval.
- **R7:** unchanged; schema changes use new migrations.

This adds workflow accounting requirements without superseding ADRs 0001, 0003, 0004, or 0006.

## Enforcement

Add database tests for aggregate invariants, scope consistency, write restrictions, concurrent settlement, and idempotent finalization.

Add application tests covering single and multiple calls, validation and transport retries, billable failures, cancellation, unknown and late usage, duplicate recording, crash recovery, pricing versions, token categories, spending-cap concurrency, and content exclusion.

Run deterministic accounting and recorded-eval tests in CI. Live evaluations require explicit invocation.

Existing dependency-cruiser restrictions, locked-path checks, and append-only migration checks remain unchanged. Any required change to locked enforcement belongs to the owner.
