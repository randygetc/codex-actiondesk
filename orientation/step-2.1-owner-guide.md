# Step 2.1 — Owner's step-by-step guide

Date: 2026-10-05

Step 2.1 is the planning and approval step. Completing it gives us an agreed design for implementation. This guide does not accept an ADR or authorize implementation.

## 1. Close the Phase 1 checkpoint

PR #18 and required CI checks were verified complete on 2026-10-05. Run the remaining fresh-session refusal exercise: ask a new chat to let LLM tools use the admin client. It should refuse and propose an ADR without changing code. Record that evidence in `docs/plan.md`.

## 2. Review the step 2.1 draft

Read [the draft](step-2.1-draft.md) and mark product decisions you want changed. Focus on extraction success, UTC budget days, retries, cancellation, and whether global usage reporting can wait.

## 3. Accept or revise proposed ADR 0008

Review [proposed ADR 0008](proposed-adr-0008-workflow-cost-accounting.md). Once satisfied, publish the accepted ADR under `docs/adr/` in your own commit, following the repository's locked-path process.

## 4. Request the concrete accounting privilege proposal

Suggested instruction:

> Investigate the Step 2.1 accounting write mechanism and propose the necessary ADR. Do not implement it.

The investigation must establish how trusted server code can record usage while ordinary users cannot forge it. The dedicated accounting identity in the draft still needs feasibility and architecture review.

## 5. Decide on that proposal

If it needs an architectural exception, accept the separate ADR and make the required locked architecture or guardrail changes yourself. Implementation waits for that decision.

## 6. Choose limits and operating policies

Request a decision table with recommendations for:

- Daily budget and live evaluation budget.
- Input, output, call, retry, and timeout limits.
- Confirmation expiry and extraction save behavior.
- Quality thresholds.
- Handling permanently unknown usage.

Review and approve those values before live calls.

## 7. Approve the detailed implementation plan

Have the accepted decisions consolidated into `docs/plan.md`, with schema fields, RLS policies, streaming behavior, tests, and separate implementation steps. Review it through a PR; you handle the merge.

## 8. Authorize the first implementation step

Start with deterministic evaluation fixtures, then the accounting foundation. Suggested instruction:

> Implement the first approved Phase 2 step from docs/plan.md. Keep live API calls disabled.

## Completion criteria

Step 2.1 is complete when the plan, privilege design, limits, and verification criteria are settled. You do not need to provision new credentials or install anything until the reviewed design specifies what is required.
