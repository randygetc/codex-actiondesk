# LLM workflow cost review

Date: 2026-10-05

Status: Review comments only. This document does not authorize implementation, change accepted ADRs, or override locked architecture and guardrails.

Introducing `workflow_id` in Phase 2 is a useful extension. It answers the product question: “What does it cost to deliver one successful extraction or answer, including failures and retries?” The proposal needs the following refinements before implementation.

## 1. Align with the accepted provider and phase boundaries

ActionDesk uses OpenAI under [ADR 0006](../docs/adr/0006-openai-is-the-llm-provider.md). Replace Anthropic/Haiku/Sonnet references with OpenAI and evaluated model IDs.

Demonstrate Extraction and Ask in Phase 2; demonstrate the digest in Phase 3. Mandatory workspace IDs need a transitional design because workspaces arrive in Phase 3. Background digest writes remain subject to the existing ADR gate in [the implementation plan](../docs/plan.md).

## 2. Define workflow boundaries and success

Suggested boundaries are one extraction submission, one Ask turn, and one scheduled digest per workspace and period. Automatic retries and tool-loop model calls retain the workflow ID. A deliberate new submission gets a new ID.

Decide whether extraction succeeds when validated results reach the review screen or when tasks are saved. These measure different outcomes. Likewise, distinguish digest generation from email delivery.

## 3. Separate two meanings of cost per success

| Metric | Calculation |
|---|---|
| Average cost of successful workflows | Spend on successful workflows divided by successful workflows |
| Effective cost per successful workflow | Spend on all workflows, including failed/cancelled ones, divided by successful workflows |

The second measures the cost of delivering successful outcomes. For example, $10 total spend producing five successes means $2 per success, even if the successful runs themselves consumed only $6.

Report undefined when there are zero successes. Apply the same distinction to eval cases.

## 4. Treat usage rows as the accounting source of truth

Stored workflow totals are useful summaries, but aggregating only at completion leaves gaps after crashes, interrupted streams, or late usage arrival. Add an active state, an accounting-completeness indicator, and a reconciliation policy.

Finalization must be repeatable without duplicating charges. Use exact decimal arithmetic and specify rounding so the proposed accounting invariant can hold exactly.

The invariant is necessary, but insufficient: a missing usage row can make both sides agree while underreporting spend.

## 5. Track each actual provider attempt exactly once

Add an internal call ID, attempt number, retry reason, and provider request/response identifier where available. Include SDK retries, not just explicit validation retries.

Multiple calls are not necessarily retries: Ask may legitimately make several calls to process tools.

A timeout without returned usage must remain unknown rather than being recorded as zero cost. Provider-reported usage multiplied by configured prices is a calculated charge; reconciliation is needed before claiming invoice-exact spend.

## 6. Expand pricing categories

One `cached_tokens` field may not capture every billable category. Current OpenAI documentation distinguishes cached reads and cache writes for applicable models; avoid counting those categories again as ordinary input. Store the categories needed by the selected model and its pricing version.

Source: [OpenAI prompt-caching documentation](https://developers.openai.com/api/docs/guides/prompt-caching), reviewed 2026-10-05.

If Anthropic were selected later, cache creation and cache reads also require separate accounting. Provider-hosted tools can introduce additional charges beyond tokens.

Source: [Anthropic pricing documentation](https://platform.claude.com/docs/en/about-claude/pricing), reviewed 2026-10-05.

Label cached-token savings as a calculated comparison against uncached pricing, including any cache-write overhead.

## 7. Enforce caps during execution

Waiting for workflow completion allows concurrent workflows and long tool loops to overspend. The existing plan already anticipates atomic reservations followed by settlement against measured usage.

Recheck before every additional call; retain reservations for unresolved attempts. Choose the cap timezone and define how workflows crossing midnight are charged.

Accounting must also be unforgeable through direct database requests. Resolve its write privileges without adding the admin client to user request paths. The global admin dashboard requires explicit authorization; workspace ownership alone is insufficient.

## 8. Clarify latency and strengthen failure tests

Keep workflow elapsed time separate from summed API-call latency: parallel calls, retry backoff, and tool execution make them different.

Extend the proposed tests with duplicate recording, repeated finalization, concurrency, crashes after provider completion, unknown usage, late settlement, and cross-user access.

Use allowlisted metadata and safe error codes so provider exceptions cannot leak content into logs.

## Recommendation

Retain the quality threshold, content exclusions, versioned pricing, and manual verification checkpoint. Make workflow accounting part of the Phase 2 foundation before the first live feature, then build the dashboard and model comparisons on those records.
