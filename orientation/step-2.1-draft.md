# Step 2.1 — Phase 2 detailed plan and accounting design

Date: 2026-10-05
Status: Draft for owner review. Planning only; no implementation authorization or architectural exception is implied.

## Objective and entry gates

Plan Extraction and Ask around validated output, user-scoped tools, explicit write confirmation, and reliable workflow cost accounting. Accounting must be ready before the first live application LLM call.

Before implementation:

- Reconcile the Phase 1 checkpoint in `docs/plan.md`: PR #18 is merged, its `ci` and `guardrails` checks passed, and both checks are required with strict branch protection. The fresh-session refusal exercise still needs recorded evidence.
- Owner accepts or revises proposed ADR 0008. The owner publishes accepted decisions in locked ADR paths; this draft does not edit them.
- Resolve the trusted accounting privilege proposal below. If an exception is necessary, stop implementation at that boundary and propose a separate ADR in the review response.
- Confirm application OpenAI project/billing and approve the live test budget. Verify current official model IDs, SDK behavior, usage categories, and prices when selecting models. This draft selects no model or price.

Workspaces, invitations, digest execution, and production deployment remain Phase 3 scope.

## Proposed product decisions

These are review defaults, not settled requirements.

| Decision | Proposed default |
|---|---|
| Extraction success | Validated draft reaches the review screen; saving approved tasks is a separate operation |
| Ask success | Validated final answer or action proposal reaches the user |
| Workflow identity | One server-generated ID per submission; automatic retries retain it; intentional resubmission gets a new ID |
| Duplicate submission | User-scoped submission key reuses the existing workflow; changed input with the same key is rejected |
| Budget day | UTC in Phase 2, shown explicitly in the UI; profile timezone affects task interpretation, not budget boundaries |
| Midnight attribution | Attribute each attempt to the UTC day its reservation was created; retries after midnight reserve against the new day |
| Budget configuration | Server-controlled per-user daily cap, workflow call limit, and output limit; numeric values approved before live calls |
| Concurrency | Sequential calls inside one workflow initially; simultaneous workflows remain supported through atomic reservations |
| Extraction retry | At most one validation retry; transport retries share a separately bounded total-attempt ceiling |
| Ask limits | Bounded model calls, tool calls, result rows, tool payload size, and elapsed time; choose numeric bounds before implementation |
| Global administration | Defer `/admin/usage` until an explicit application-admin identity and authorization policy are approved |
| Conversation retention | No persisted conversation or note contents in accounting; decide any separate Ask history feature explicitly |

Set input size limits, rate limits, daily USD caps, timeout durations, confirmation expiry, maximum proposed tasks, and quality thresholds during review. Live mode stays disabled until those values and model-specific reservation bounds are documented.

## Trusted accounting privilege proposal — unresolved gate

User ownership proves whose workflow a request belongs to. It does not prove that submitted token counts or costs came from the provider. An authenticated settlement RPC available through the public Data API would allow users to forge accounting even if it checks `auth.uid()`.

Preferred design to investigate: a dedicated, least-privilege server accounting identity that can execute a small set of private accounting operations, with no general table mutation privileges and no project/task access. Ordinary anonymous/authenticated identities receive no authoritative accounting write grants. Each operation binds verified user attribution to an existing workflow and enforces its state transitions. Client input never supplies authoritative usage, prices, ownership, or settlement amounts.

Interactive accounting writes originate from authenticated, Zod-validated Server Actions. The separate accounting capability may reserve, record, settle, and finalize only; LLM tools continue to query through the user's Supabase client. It must never become a general privileged database client.

This is a candidate design, not an approved connection method. Review credential provisioning, database connectivity, secret rotation, identity binding, deployment support, and compatibility with R1/R3/R5 before choosing it. A private schema or security-definer function alone does not establish trusted caller identity. Do not expose a settlement function to ordinary users or substitute the service-role client into request paths.

If this needs a new privileged server boundary or an R5 exception, the owner must accept a separate ADR and update any affected locked enforcement before implementation. This draft proposes no bypass.

Phase 2 reconciliation initially runs through an explicitly invoked, authorized Server Action, including on the user's next visit. It can identify stale attempts and settle trustworthy recovered usage; missing usage remains unknown. No automatic Cron or Edge Function writes are authorized here. If operator-wide or scheduled reconciliation is necessary, resolve its authorization in the separate ADR. Unresolved reservations cannot expire into assumed zero spend.

## Data and invariants

All new public tables enable RLS in their creating migration. Accounting rows are owner-readable and cannot be directly inserted, updated, or deleted by ordinary clients. Phase 2 uses verified `user_id`; Phase 3 adds workspace attribution through a reviewed migration/backfill.

| Record | Proposed responsibility |
|---|---|
| `llm_workflows` | Submission identity, user, feature, traffic class, execution status, accounting completeness, safe timestamps, maintained cost/count summaries |
| `llm_usage` | Durable attempt identity, workflow, logical call and attempt ordinal, retry reason, exact model/pricing version, validated usage categories, cost, outcome, provider IDs where available |
| Pricing versions | Immutable model/category rates, units, currency, effective date, and source reference; server-controlled |
| Budget reservations | Attempt, owner, budget day, reserved amount, settlement state; unique reservation per attempt |
| Budget ledger | Atomic per-user/day coordination of known spend and unresolved reserved amounts |

Persist an attempt and reserve funds before dispatch. A crash between recording intent and sending the request leaves an uncertain attempt; it must not be classified as nonbilling without evidence. Provider IDs may arrive later.

Required invariants:

- Workflow, attempt, reservation, and budget owner attribution agree. IDs cannot be moved between users or workflows.
- An attempt is recorded and charged at most once. Repeated settlement/finalization cannot increment totals again.
- Fully settled workflow cost equals the sum of its attempt costs; incomplete totals are explicitly known cost only.
- Final execution status and accounting completeness are independent. Failed and cancelled workflows can incur spend.
- Atomic reservations prevent concurrent admission beyond the approved budget. Settlement replaces its reservation with actual cost, rather than counting both.
- Every additional attempt reserves first. Its bound covers all enabled billable categories and request limits. If a safe bound cannot be established, that request configuration is disabled.
- Pricing versions are immutable and retained. Use PostgreSQL exact decimal values and integer usage units; select precision and rounding before migration. Sum rounded attempt charges consistently; no floating-point money arithmetic.
- Unknown usage retains its unresolved reservation. Late usage settles the existing attempt. Any actual charge above the bound is recorded, blocks further admission as needed, and triggers review of the faulty bound.

No accounting record or logger entry contains prompts, notes, answers, extracted text, files, secrets, or raw provider exceptions. Submission deduplication must not persist plaintext input; review any keyed fingerprint for privacy and key lifecycle.

## Request, streaming, cancellation, and recovery

1. A Server Action validates input and verifies the user with `getUser()`.
2. It resolves the submission key and creates or resumes the workflow through the approved accounting mechanism.
3. The provider wrapper validates configuration, durably records intent, reserves the attempt, then dispatches.
4. It validates usage metadata and output independently. Usage can be recorded even when output is malformed or refused.
5. It settles known usage, leaves missing usage unknown, and finalizes execution without implying accounting completeness.

All provider integration stays in `src/lib/llm/**` with `server-only`; all shared input/output schemas stay in `src/lib/validation/**`. Choose the actual Server Action streaming transport only after reading the installed Next.js guides and proving support; do not introduce a business-write route to make streaming easier.

A proposed UI event contract includes workflow ID, ordered sequence, draft progress, final validated result, safe failure, and completion. Partial output is untrusted and cannot enable Save or write confirmation. React renders plain text. Distinguish empty valid output, refusal, truncation, malformed output, timeout, and cancellation.

Disable opaque SDK retries where supported and implement bounded observable retries, or prove every internal attempt is captured. Retry exhaustion includes every attempt, not only explicit validation retries. A tool continuation is a new logical call, not a retry.

Cancellation requests abort ongoing work best-effort, prevent new calls, and preserve known charges and uncertain reservations. Disconnect does not establish cancellation or nonbilling. Recovery must not blindly replay an uncertain provider request: reconcile if trustworthy usage is recoverable; otherwise retain unknown accounting and surface a safe status.

## Extraction and Ask boundaries

Extraction freezes a reference instant and profile timezone, sends only bounded notes and RLS-visible project choices, and validates the complete response with Zod. Unknown or archived project assignments fail revalidation. Dates use the existing manual DST rules. Reviewed tasks save through a separate validated action with current authorization, duplicate-acceptance protection, and an explicit all-or-nothing or partial-save contract decided before implementation.

Ask tools initially provide bounded search, overdue tasks, and summaries. Tools query with the current user's client; model-supplied owner IDs never determine scope. Returned fields and result sizes are allowlisted. Tool arguments and every model result are validated; tool iteration limits are enforced by application code.

A create-task tool returns a proposal. The confirmation action uses a server-bound proposal ID, checks expiry, current user, current project access, and the approved payload. Tampering fails. Repeated confirmation returns the original result instead of creating duplicate tasks. Model output cannot self-confirm. Decide where proposal payloads live and their retention separately from accounting; never place task text in usage tables.

## Evaluations, attachments, and reporting

Step 2.2 supplies 15–20 approved or synthetic fixtures covering dates, empty actions, duplicates, other assignees, Taglish, and injection. Default CI uses deterministic recorded fixtures and no paid API. Live evaluations are explicitly invoked, tagged separately, use the same accounting code, and compare identical cases against an agreed quality threshold.

Attachments remain step 2.7: review bounded parsing, permitted types, private Storage ownership, 10 MB limit, and selected provider retention/deletion before implementation. Include hidden-instruction fixtures. No file contents enter accounting or logs.

Owner usage reporting shows feature/model/day, success rate, calls, retries, failed/cancelled spend, elapsed time, and incomplete accounting. Use the same workflow cohort for denominators. Report average workflow cost, average successful-workflow cost, and effective cost per success separately; zero denominators are undefined. Incomplete cohorts cannot be presented as complete cost-per-success figures. Calculated charges are not invoice-reconciled spend.

## Implementation sequence and acceptance

Each implementation step gets its own reviewed commit and appropriate checks. Dependencies require owner approval; locked files remain owner-controlled.

1. **2.1 planning:** settle review decisions, schema/policy matrix, accounting privilege ADR if needed, stream transport, and reservation/recovery design. Publish the accepted sequence into `docs/plan.md`.
2. **2.2 fixtures:** establish expected extraction results and scoring before model comparison.
3. **2.3a accounting foundation:** implement schemas, RLS, approved accounting capability, pricing, reservations, and deterministic provider wrapper tests. No live feature yet. This brings core cap enforcement forward from 2.6.
4. **2.3b Extraction:** validated drafts and replay-safe reviewed saves; demonstrate a retry, failure, and manual live cost calculation within approved limits.
5. **2.4 model comparison:** verify official IDs/prices and compare quality, latency, and effective cost on identical cases.
6. **2.5 Ask:** user-scoped read tools and replay-safe confirmation; prove hostile arguments cannot expose another user's work.
7. **2.6 reporting and controls:** complete usage UI, reconciliation visibility, cap configuration, and authorized admin reporting if approved. Caps already protect every live call.
8. **2.7 attachments / 2.8 security:** bounded private file handling and complete injection, confirmation, accounting, and isolation review.

Foundation acceptance requires pgTAP coverage for owner/other-user/anonymous visibility, direct write denial, scope constraints, aggregate invariants, concurrent reservations/settlement, and duplicate finalization. Application tests cover transport/validation retries, billable failures, cancellation, crashes around dispatch/settlement, late usage, unknown usage, pricing versions/categories, midnight attribution, and content exclusion.

Feature acceptance includes malformed/refused/truncated output, partial-stream save denial, confirmation tampering/expiry/replay, cross-user project/tool denial, and deterministic eval CI. Use the documented security-reviewer at the Phase 2 security step. Before implementation commits run lint, typecheck, tests, and dependency-cruiser; database/build/browser checks match the change's scope.

Phase 2 checkpoint evidence records both functional results and accounting completeness in `docs/learnings.md`, with no sensitive content. No production commands or paid live evaluations occur without their existing explicit authorization requirements.

## Review decisions to close

- Accept ADR 0008 and resolve the dedicated accounting capability, including whether a separate architectural exception is required.
- Approve budget-day policy and numeric limits, pricing precision/rounding, retry ceilings, and quality thresholds.
- Choose supported streaming behavior, proposal storage/expiry, and extraction save atomicity.
- Define reconciliation authority and the resolution policy for permanently unknown attempts.
- Approve application-admin scope or defer global reporting; confirm Phase 1 entry gates.

After those decisions, this document can become the detailed Phase 2 section of the working plan. It does not itself authorize implementation.
