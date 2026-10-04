# ActionDesk implementation plan

Updated: 2026-10-04. Status: step 1.5 owner smoke-tested and merged; step 1.6 implemented and tested locally, pending PR checks and owner merge.

## Current state and authority

- The projects branch starts from merged PR #14 (`643d1c5`), including the Google account chooser and user-email header. Accepted ADR 0006 establishes OpenAI and supersedes ADR 0002.
- Scaffold includes tested Google OAuth, profiles/RLS, timezone settings, and owner-scoped project CRUD/archive/restore. Tasks CRUD remains unimplemented.
- Phase 1 is detailed below; Phases 2–3 require expanded plans at their kickoff planning steps.
- Locked architecture and accepted ADRs govern implementation. This plan does not authorize architectural exceptions, dependency installation, production commands, or edits to locked paths.
- Owner authorized steps 1.3–1.7 and approved scaffold and step 1.7 date/recurrence dependencies. Steps 1.5–1.6 add no dependencies. Google smoke test was confirmed by the owner; branch protections and required CI were verified remotely.

## Invariants across all phases

1. Enable RLS in the same migration that creates a public table; test policies with authenticated owner, other-user, and anonymous roles. App checks never replace RLS.
2. Authenticate server requests with `supabase.auth.getUser()`. Never trust submitted owner IDs, workspace IDs, project IDs, or roles as authorization.
3. Use the current user's Supabase client in request paths and LLM tools; never import the admin client into actions, routes, or tools.
4. Business mutations go through Server Actions and Zod schemas in `src/lib/validation/`. Atomic database operations called by actions must still enforce RLS; do not use security-definer CRUD as an admin bypass.
5. OpenAI SDK imports stay in `src/lib/llm/**` and approved Edge Functions. Every application LLM module imports `server-only`; privileged keys never use public environment variables.
6. Notes, files, model output, tool arguments, and streamed partial output are untrusted. Validate before use; extracted tasks and assistant writes require explicit human confirmation and reauthorization.
7. Migrations are append-only once committed. Rebuild/test locally and regenerate database types after schema changes.
8. Store instants as UTC `timestamptz`; preserve recurrence timezone/anchor separately. Apply display timezone at the edges.
9. Introduce one structured logger during scaffolding. Never log content, raw model output, uploaded files, keys, or token text. Numeric usage counts are metadata.
10. Ask before adding dependencies. Measure before performance indexes, caching, or query rewrites. Primary keys and uniqueness constraints needed for correctness are structural schema requirements, not speculative optimization.
11. Implementation uses branches and one step per commit. Owner handles labels, merges, and `main`; lint, typecheck, tests, and dependency-cruiser must pass before implementation commits.

## Owner decisions and setup gates

These are proposed product defaults for review, not completed configuration.

| Decision | Proposed default | Resolve by |
|---|---|---|
| Phase 1–2 ownership | User-owned projects/tasks; workspace transition in Phase 3 as prescribed by kickoff | Before 1.5 |
| Projects | Required name, optional description; archive projects with tasks, hard-delete only empty projects | Before 1.6 |
| Text limits | Project name 1–120, description up to 2,000; task title 1–200, notes up to 10,000 characters; trim required text | Before 1.6–1.7 |
| Task priority | `low/normal/high/urgent`, default `normal` | Before 1.7 |
| Due dates | Optional precise date/time; no all-day mode in Phase 1 | Before 1.7 |
| Week and missing dates | Week begins Sunday; separate No due date and Completed sections | Before 1.7 |
| Recurrence | Daily, weekly, monthly, nth weekday; timezone captured at creation; one successor per completed occurrence | Before 1.7 |
| Missed recurrence | Next occurrence follows previous scheduled time, preserving missed dates rather than silently skipping backlog | Before 1.7 |
| DST | Reject nonexistent manual times; request explicit offset for ambiguous manual input. Recurrence shifts nonexistent time forward by the gap and uses earlier offset for repeated time | Before 1.7 |
| CI authentication | Local test users/auth fixtures; no live Google dependency or service-role application requests | Before 1.5 tests |
| LLM thresholds | Agree eval target, confidence cutoff, input limits, rate limits, and daily cap | At 2.1 |
| New documentation | Kickoff requests learning/deploy/incident docs despite a blanket docs restriction. Record notes here until owner clarifies permission to add those paths | Before adding those files |

Owner setup still to verify:

- CODEOWNERS placeholder replaced by owner and merged in PR #3. Email ownership depends on association with the owner's GitHub account.
- Verified via GitHub API: PR required, zero solo approvals, required `guardrails` from GitHub Actions, up-to-date branch required, admin bypass disabled, force pushes/deletion blocked. Add required `ci` after 1.9. Approval label was used for merged architecture PRs.
- Owner uses only Codex: missing Claude hook is not a setup blocker. Codex does not automatically execute `.claude/` hooks, permissions, or slash commands.
- Confirm Node, Docker, Supabase CLI, local ports, dev Supabase project, Google OAuth redirects, and Vercel access. Never put actual secrets in tracked files.
- Confirm OpenAI project/billing before Phase 2. Development-agent access is separate from application API access.
- Approve dependency additions per step, including scaffold, Supabase/Zod, `server-only`, dependency-cruiser, tests, and later date/recurrence libraries and OpenAI SDK. Resolve versions at implementation time.

### Architecture questions and blocked scope

**Background writes: proposed ADR 0007, Phase 3 gate.** R5 and ADR 0004 say all writes go through Server Actions. The weekly digest Edge Function must write run state and usage without a user action. ADR 0003 allows its privileged reads but does not explicitly settle mutation scope. Do not implement these writes until the owner accepts a narrow exception. The proposed ADR is delivered in the review response, not written to locked `docs/adr/`.

**Single-user transition:** the architecture outlines workspace scope while the kickoff explicitly introduces it in Phase 3. This plan follows that transitional sequence with strict user isolation. If the owner intends workspace IDs to be mandatory from the first migration, resolve that interpretation or propose a separate ADR before schema work.

**Guardrail coverage:** existing import rules scan `src`, restrict privileged imports in `src/components`, and require `server-only` for top-level `.ts` LLM/admin modules. R6 covers every client module and ADR 0006 every LLM module. Use flat server modules initially, inspect all `use client` modules, and prove client/server boundaries with a framework build. Do not claim the current scan proves nested/transitive imports or Edge Functions. Any change to locked enforcement belongs to the owner; never reorganize code to dodge checks.

## Layout and routes

| Area | Responsibility |
|---|---|
| `src/app/` | Routes, server reads, colocated validated Server Actions |
| `src/components/` | UI; browser Supabase client only for reads/subscriptions |
| `src/lib/supabase/server.ts`, `client.ts` | Per-request user client and browser client |
| `src/lib/supabase/admin.ts`, `src/lib/admin/` | Server-only restricted administrative services; no user-path imports |
| `src/lib/validation/` | Shared action and model-output schemas |
| `src/lib/llm/` | Server-only Responses API integration, extraction, tools, usage coordination |
| `src/lib/tasks/` | Pure grouping and recurrence logic |
| `src/lib/logger.ts` | Single structured logger |
| `src/lib/database.types.ts` | Generated local database types |
| `supabase/migrations/`, `supabase/tests/` | Schema history and pgTAP tests |
| `supabase/functions/` | Approved scheduled jobs |
| `tests/e2e/`, `evals/extraction/` | Browser journeys and extraction fixtures/recordings |

Phase 1: `/` redirects based on auth; `/login`; `/auth/callback`; protected `(app)` routes `/tasks`, `/tasks/[id]`, `/projects`, `/projects/[id]`, `/settings`. Sign-out is a Server Action. Validate callback destinations against open redirects; callbacks handle identity/session establishment rather than business-table writes.

Phase 2: `/extract`, `/ask`, `/admin/usage` subject to an explicit application-admin decision. Phase 3: `/workspaces`, `/workspaces/[id]/settings`, `/invites/[token]`, `/settings/security`, and a secret-free `/api/health`. Do not introduce alternate business-write APIs.

## Phase 1 — Foundation (detailed)

### Schema and RLS

All public tables enable RLS immediately. UUID keys, `created_at`/`updated_at` as `timestamptz`, immutable ownership, and audited grants accompany policies.

| Table | Fields and constraints | Access |
|---|---|---|
| `profiles` | `id` references Auth user, display name, validated IANA timezone default `America/Los_Angeles`, timestamps | Own SELECT/UPDATE only; no client INSERT/DELETE. Minimal Auth trigger creates profile, with fixed search path and limited privileges |
| `projects` | `id`, `user_id`, name, optional description, nullable `archived_at`, timestamps; unique `(id,user_id)` | Owner-only CRUD; USING and WITH CHECK prevent forged or changed ownership. Delete only without referencing tasks |
| `tasks` | `id`, `user_id`, optional `project_id`, title, notes, status, priority, nullable `due_at`, recurrence data, `completed_at`, timestamps | Owner-only CRUD; composite `(project_id,user_id)` reference enforces project ownership at the database layer |

Constraints mirror schema bounds; statuses are `todo/doing/done`; completion timestamp agrees with done state. Project deletion never silently cascades tasks. New owner identity is derived on the server. Null due dates are supported.

Recurrence stores RRULE plus local schedule anchor and immutable recurrence timezone; an instant alone cannot preserve wall-clock recurrence across DST. Store predecessor ID with a unique constraint and an occurrence ordinal; finite rules track their count/end across successors rather than restarting COUNT. Limit the RRULE clauses to the UI-supported subset and reject unsupported rules. Skip invalid calendar dates; apply reviewed DST policy separately.

Completion calls an atomic user-scoped invoker database operation through a validated Server Action. Lock/recheck task state, apply RLS, update completion, and insert at most one successor in one transaction. Retry/double-click cannot duplicate a successor. Reopening/recompleting reuses the existing successor; no cascading future-occurrence edits in Phase 1. Rule edits affect only successors not yet created. Proposed successor inherits title, notes, priority, owner, and project; review this behavior before 1.7.

Policy matrix: owner allowed; other user and anonymous denied; forged owner and owner change denied. Tasks also test cross-user project references and transactional completion isolation. Tests must use authenticated roles/JWT claims, not a service-role query presented as RLS proof.

### 1.1 Plan and review — draft complete

Scope: this document and the proposed ADR. Acceptance: every kickoff step has scope and observable criteria, Phase 1 includes schema/policies/routes/tests, and exceptions are explicit gates. Owner reviews product defaults and open decisions. No application or database changes.

### 1.2 Architecture setup — owner configuration verified; refusal exercise pending

OpenAI acceptance and documentation cleanup are merged. Owner resolves setup gates and accepts or defers ADR 0007. Run the kickoff refusal exercise in a fresh session: the agent must refuse a request to allow admin LLM tools and propose an ADR without editing locked files.

Acceptance: real CODEOWNERS identity, evidence of required checks/settings, and refusal exercise outcome recorded here. Do not repeat the historical first direct push to `main`; use the established PR process.

### 1.3 Scaffold — complete, owner merged PR #4

After dependency approval, create Next.js App Router/strict TypeScript, Tailwind/shadcn UI, local Supabase, user/browser clients, flat server-only admin/LLM entry modules, session refresh integration, logger, Vitest, and Playwright. Inspect installed Next.js local docs before framework coding as AGENTS.md requires; use supported APIs rather than assuming historical middleware conventions.

Add environment template with names only, ignore real secrets, npm dev/build/lint/typecheck/unit/e2e scripts, and lockfile/tsconfig/Supabase config so existing CI checks activate. Add eval script only with its actual harness. Prepare a harmless committed baseline migration, for example a setup-comment-only migration, to let 1.4 test edits to an existing migration before business tables exist.

Acceptance: app and local Supabase start, lint/typecheck/build and meaningful initial smoke tests pass, dependency-cruiser resolves and passes, CI import/database steps run rather than skip, and browser build has no privileged keys. Open scaffold PR; owner merges. No production linking or paid calls.

Implementation evidence:

- Next.js 16.3.8/React 19 App Router, strict TypeScript, Tailwind 4, shadcn configuration, scoped Supabase clients, lazy OpenAI/admin constructors, session-refresh Proxy, allowlisted logger, and test configs are present.
- Local Supabase starts on isolated ports 55320–55329; no unrelated stack was stopped. Generated types reflect an empty business schema; comment-only baseline migration is ready for the step 1.4 append-only proof after merge.
- Lint and typecheck pass; 11 unit tests validate public configuration, cookie/cache-header propagation including repeated cookie writes, `getUser()` usage, and log redaction.
- Locked dependency-cruiser passes; existing pgTAP RLS test passes both assertions. With no business tables yet, this proves the test harness, not future ownership policies.
- Webpack production build passes and Chromium production smoke test passes. Development server starts and homepage returns HTTP 200. No OpenAI credentials or paid calls needed.
- Turbopack's PostCSS listener fails with EPERM even after escalation; select Next.js's supported Webpack dev/build mode without disabling build/type checks.
- Production dependency audit reports zero vulnerabilities. Development lint chain reports five related high-severity entries from unpatched `braces` advisory GHSA-vfj7-8cjw-p6xm. Track upstream rather than force-downgrading Next.js lint tooling.
- Eval script/harness deferred to 2.2 and application CI workflow to 1.9. [Scaffold CI](https://github.com/randygetc/codex-actiondesk/actions/runs/37160278271) passed, including import and database checks. Owner merged [PR #4](https://github.com/randygetc/codex-actiondesk/pull/4) into main at `b038d45`.

### 1.4 Prove guardrails — complete

After scaffold merge, use a throwaway branch and separate commits for SDK-in-component, admin-in-action, public-table-without-RLS, and modifying the committed baseline migration. Check each revision independently so an earlier failure does not hide the next violation. Keep violations off the implementation branch; do not apply labels to mask failures.

Acceptance: record each commit and expected check failure: R2 import rule, R3 import rule, pgTAP RLS coverage, migration diff. A tool crash or unrelated red job is not proof. Also prove a client importing the server-only LLM entry fails the framework build. Owner closes draft PR without merge. If a violation passes, owner fixes locked guardrails and repeats before feature work.

Observed on 2026-10-03 against merged scaffold `b038d45`. Four independent throwaway branches, each based on main, avoid an earlier failed workflow step hiding a later violation. Draft PRs contain only their deliberate violation; none is suitable for merging.

| Probe | Commit / draft PR | Observed CI result | Evidence |
| --- | --- | --- | --- |
| Component imports OpenAI SDK | `b6247c9`, [#5](https://github.com/randygetc/codex-actiondesk/pull/5) | **Unexpected success**: R2 did not catch the import; every CI step ran and passed | [Run](https://github.com/randygetc/codex-actiondesk/actions/runs/37160925174) |
| Server Action imports admin client | `2e99525`, [#6](https://github.com/randygetc/codex-actiondesk/pull/6) | Expected failure in Import boundaries: `R3-admin-client-restricted`, action → admin module | [Run](https://github.com/randygetc/codex-actiondesk/actions/runs/37160941274) |
| New public table without RLS | `9135fcf`, [#7](https://github.com/randygetc/codex-actiondesk/pull/7) | Expected pgTAP failure: public tables must have RLS; unexpected record `guardrail_missing_rls_probe` | [Run](https://github.com/randygetc/codex-actiondesk/actions/runs/37160973068) |
| Edit baseline migration already on main | `5bdfd3f`, [#8](https://github.com/randygetc/codex-actiondesk/pull/8) | Expected failure in Locked paths and append-only migrations: committed migration modified | [Run](https://github.com/randygetc/codex-actiondesk/actions/runs/37160986737) |

Additional local proof: commit `f8487e3` on unpushed branch `test/guardrails-server-only-build` adds a client page importing `src/lib/llm`. `npm run build` exits 1 with the compiler's `server-only` error and an import trace from the page to the LLM module. The initial sandbox invocation failed before compilation; the escalated run reached the intended boundary error. No constructors were invoked, API calls made, or normal local database migrations applied. The normal documentation branch contains none of these fixtures. Stale ignored `.next` artifacts from the failed build were moved to `/tmp/actiondesk-next-guardrail-proof-20261003` before clean-branch checks.

R2 diagnosis: dependency-cruiser's JSON graph reports module `openai` resolved to `node_modules/openai/index.d.ts`. Its `to.path` rule currently matches `^openai($|/)`, which misses the resolved dependency path. Owner repair proposal for locked `guardrails/dependency-cruiser.cjs`: match the actual resolved npm package path, e.g. `^node_modules/openai($|/)`, and verify root and subpath imports are rejected outside the approved boundary while the existing LLM import remains allowed. This restores the accepted R2 rule; no architectural exception or workflow bypass is proposed. The agent has not edited the locked configuration.

Owner merged repair [PR #10](https://github.com/randygetc/codex-actiondesk/pull/10) at `8e1747a`. The existing legitimate LLM SDK import passes dependency-cruiser on repaired main. Replaying the original component fixture in commit `7dc196e` on a fresh branch produces the named `R2-openai-sdk-only-in-llm` failure locally and in [CI run 37162637975](https://github.com/randygetc/codex-actiondesk/actions/runs/37162637975), specifically in Import boundaries. [Draft PR #11](https://github.com/randygetc/codex-actiondesk/pull/11) contains this repeat probe and must never be merged. The owner repair closes the observed R2 gap; all four intended violations now have independent expected CI failure evidence.

Owner closed draft PRs #5–#8 and #11 without merging and merged report PR #9 at `bfd8db4`; verified through GitHub API before starting 1.5. All four guardrail proofs and cleanup are complete.

### 1.5 Google sign-in and profiles — complete

Migration: profiles, Auth-user creation trigger, grants, RLS, pgTAP. Routes: login/callback, protected layout, settings; actions: sign-out and validated timezone update. Validate IANA zones server-side; changing display timezone never rewrites due instants or existing recurrence schedules. Auth session establishment is identity lifecycle, not an alternate business-write path. If the owner interprets R5 as applying to provider Auth lifecycle writes too, settle that scope before adding a conflicting implementation.

Tests: timezone and callback-destination unit cases; profile trigger/isolation pgTAP; Playwright anonymous redirect, settings save/rejection, sign-out denial. Local auth fixtures make CI independent of Google; manually smoke-test real OAuth in dev.

Acceptance: Google login works, profile created once with Pacific default, valid timezone persists, anonymous users redirect, other-user updates fail, and authorization uses `getUser()` without admin-client request paths.

Implementation and evidence:

- New migration `20261004010000_profiles.sql` creates profiles with same-migration RLS, own SELECT/UPDATE policies, column-limited grants, no client INSERT/DELETE, database timezone/name constraints, server-controlled timestamps, and a private fixed-search-path provisioning trigger. Existing identities are provisioned without overwriting profiles. Auth metadata timezone/owner values are never trusted.
- Root routes by verified authentication; login initiates Google PKCE OAuth through a Server Action, and callback exchanges the code then verifies the user. Redirects use server `APP_URL` plus fixed application destination allowlist; neither incoming hosts nor arbitrary `next` values determine the destination. Callback does no business writes.
- `(app)` layout and pages require `getUser()`; timezone and sign-out actions authorize independently. Tasks/projects are protected placeholders pending 1.6–1.7. Timezone updates validate Zod, use the user client, derive ownership from the verified user, and never rewrite dates.
- Applied the new migration only to local ActionDesk; generated database types. pgTAP passes 27 assertions across existing RLS coverage and profile trigger/grant/ownership/anonymous/invalid-input tests.
- Lint, typecheck, 50 unit tests, dependency-cruiser and production Webpack build pass. Four Chromium production tests pass: anonymous home/protected redirects, safe callback failure, profile defaults, real settings save/reload/rejection, and sign-out followed by denied protected access. Browser fixtures use public-key local Auth and leave disposable local identities; SQL fixtures roll back.
- Browser alert assertions are scoped to main content because Next.js also renders a route announcer with role alert. Browser config privately discovers local public settings and rejects fixture targets outside ActionDesk port 55321.
- Google provider remains disabled in committed local config so CI needs no credentials; env references and redirect URLs are ready. Owner credential setup and live Google consent/code exchange remain **unverified**, and are the remaining acceptance gate. Setup and manual checklist are saved in `docs/conventions.md` with the official Supabase reference. No provider secrets, remote changes, privileged application requests, or paid calls were made.

Subsequent evidence: owner requested a separate fresh local stack, created as `codex-actiondesk-fresh` on API 56321/database 56322 with app settings in ignored `.env.local`. Existing stacks/data were preserved. Owner configured Google and confirmed the full smoke test. PR #12 (auth/branding), #13 (verified user email in header), and #14 (Google `prompt=select_account`) were merged with passing required checks. Incognito removed the reported hydration warning; no warning reproduced in clean Chromium, so no hydration suppression was added. Google/account-switching acceptance is complete. The earlier unverified status above describes the initial implementation checks only.

### 1.6 Projects CRUD — implemented; PR checks and owner merge pending

Review proposed fields/delete semantics; add migration, owner policies, schemas, create/edit/archive/delete actions, and list/detail UI with empty/loading/error states. Archived projects are excluded from new task choices but existing tasks remain accessible. Require delete confirmation and reject deletion of referenced projects.

Tests/acceptance: name bounds; create/edit/list/archive round trip; empty-only delete; owner immutability and cross-user read/write rejection under direct authenticated database requests as well as actions. Validation errors remain usable without exposing other-user data. Record vague-prompt corrections here until learning-doc permissions are clarified.

Implementation and evidence:

- New append-only migration `20261004030000_projects.sql` creates owner-scoped projects, same-migration RLS, all four CRUD policies, column-limited insert/update grants, immutable IDs/ownership/creation time, name/description constraints, server update timestamps, and a structural `(id,user_id)` key for the future task ownership FK. No speculative indexes or dependencies added.
- List/detail routes include empty, loading, unavailable/not-found states. Controlled forms retain invalid drafts. Descriptions render as escaped plain text. Actions validate Zod, independently verify `getUser()`, derive insert ownership, and filter updates/deletes by verified owner plus ID. Archive/restore preserves rows; deletion requires UI and server confirmation and reports reference conflicts safely.
- Lint/typecheck, 69 unit tests, dependency-cruiser, production Webpack build, and six Chromium tests pass. Browser tests prove the full create/edit/archive/restore/confirmed-delete journey, whitespace validation with draft retention, plain-text rendering, foreign detail denial, and direct Data API cross-user SELECT/UPDATE/DELETE/forged-owner INSERT denial. Test-created projects are deleted through their owner's UI; disposable Auth fixtures stay on the original local test stack.
- pgTAP passes 57 assertions on both original and fresh stacks. Tests cover owner/other/anonymous CRUD, ownership/ID immutability, constraints, archive/restore, and unreferenced deletion. A rollback-only private reference fixture tests the structural composite-key/FK deletion contract. This fixture is not a production tasks table: actual task FK integration and archived-task-choice exclusion must be implemented and tested in 1.7. The delete action already handles FK error `23503` without cascading or bypassing it.
- Applied only the new migration to the fresh Google-enabled stack; preserved its existing users/profiles/settings. Copied the new rollback-only tests into its ignored workdir and regenerated source database types from the test stack.
- Browser webServer now builds with its own public local test settings before starting, so production compilation cannot bake in the fresh stack's `.env.local` URL/key while tests create users against the original stack. Test fixtures remain restricted to port 55321; manual Google app stays on 56321.
- Vague-prompt decisions used the existing plan defaults: names 1–120 trimmed characters, optional description up to 2,000, separate active/archived lists, reversible archive, and explicit permanent-delete confirmation. No owner corrections required so far; referenced-task deletion remains a mandatory 1.7 integration check.

### 1.7 Tasks CRUD and recurrence — implemented; PR preparation

Owner approved the cases/defaults and both proposed dependencies before implementation. Add migration/policies, pure date logic, schemas/actions, list/detail/editor UI, and transactional completion. Project and due date optional. Render notes as text, never raw HTML; validate status transitions; confirm delete and retain drafts on error.

For active tasks at a single captured `now`: Overdue is due before now; Today is remaining due before next local midnight; This week is remaining due before next local Sunday; Later is the rest. Separate No due date and Completed sections. Each task appears once, sorted by due instant then stable ID. Display timezone changes grouping, not stored instants.

Tests/acceptance:

- CRUD with/without project and due date; invalid text/status/priority/RRULE/foreign project fails.
- Two-user policies and action tests deny foreign reads/writes, including project reassignment.
- One-off completion sets timestamp without successor; recurring completion creates one valid successor.
- Concurrent completion, double-click, response-loss retries, and reopening/recompletion cannot duplicate successors.
- Successor failure rolls back original completion; finite/count-ended recurrence produces no extra occurrence.
- Edits/status changes update groups; local date/time inputs round-trip to UTC correctly.

#### Concrete defaults proposed for approval

- Title is trimmed, 1–200 characters; notes are optional plain text up to 10,000 characters. Status is todo/doing/done; priority is low/normal/high/urgent, default normal. New tasks start todo. Project and due date are optional; recurrence requires a due date.
- Project choices contain the owner's active projects. An existing task retains its archived project reference and can clear/change it. New assignments to archived or foreign projects fail server validation. Actual task references prevent permanent project deletion through the composite ownership FK; archiving remains available.
- Recurrence editor supports daily, weekly on selected weekdays, monthly on a day number, and monthly on an ordinal weekday (including second Tuesday). Optional interval and finite COUNT or UTC UNTIL are supported; unsupported/duplicate clauses and incompatible combinations fail validation. Calendar-invalid dates are skipped. The first due date must match the rule and counts as occurrence one.
- Recurrence captures the profile timezone and original local schedule anchor. Weekly 09:00 stays 09:00 across DST. Missing local recurrence times shift forward by the gap; repeated times use the earlier offset. Manual missing times fail; ambiguous manual input requires an explicit valid offset. Changing profile timezone changes display/grouping, not existing schedules or instants.
- Completing creates only the next scheduled occurrence, even if overdue, with todo status and inherited title, notes, priority and project. COUNT is measured from the series anchor and never restarted for a successor; UNTIL is inclusive. A one-off or exhausted series has no successor.
- Completion and successor insertion are atomic. Concurrent clicks/retries produce one successor. Reopening clears completed_at and recompleting reuses the successor. A completed predecessor with a successor cannot be deleted or have its schedule changed; deleting other occurrences does not delete other tasks. Content edits affect only subsequently created occurrences. Schedule changes on an active occurrence begin a new series and must be explicit in the editor.
- Grouping captures one current instant and uses Sunday week boundaries: Overdue, Today, This week, Later, No due date, Completed. Earlier-today tasks are Overdue; completed tasks are excluded from active groups.

#### Acceptance cases to implement first

| Case | Expected result and protection |
| --- | --- |
| Own CRUD, optional dates/project, invalid drafts | Create/read/edit/confirmed-delete works; invalid drafts survive; plain notes render escaped; malformed values do not write |
| Two users and anonymous client | RLS denies foreign reads/writes, forged owner and foreign project assignment; actions independently authenticate with getUser |
| Archived/referenced projects | Archived projects cannot receive new assignments; existing references remain visible; referenced project deletion fails without losing tasks |
| One-off and recurring completion | completed_at matches done state; one-off has no child; recurring child inherits reviewed fields and is todo |
| Race/retry/reopen | Concurrent database calls, response-loss retry and reopening/recompletion leave exactly one successor |
| Failed successor or stale schedule | Entire completion rolls back on insertion failure; changed schedule is detected under the row lock and recalculated rather than using stale input |
| Finite and calendar rules | COUNT=2 creates exactly two total occurrences; UNTIL boundary is inclusive; second Tuesday crosses months; day 31 skips invalid months |
| Local/UTC conversion | Manual DST gap rejects and overlap requires offset; recurrence follows gap/overlap policy; weekly Pacific 09:00 remains 09:00 across November |
| Group boundaries | Pacific 23:30 is Today when now is earlier that day; earlier-today is Overdue; midnight/Sunday boundaries and null dates classify once |
| Timezone change | Pacific to Asia/Manila changes displayed dates/groups without changing due_at or recurrence timezone |

#### Implementation and verification sequence

1. Obtain approval of these cases/defaults and dependency additions. Proposed dependencies: [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill) for explicit timezone/DST conversion and [`rrule`](https://github.com/jkbrzt/rrule) for calendar recurrence enumeration. Verify installed versions, parsing, floating-date semantics and bounds before relying on them; resolve IANA offsets explicitly rather than assuming enumeration preserves DST.
2. Add fixed-clock unit cases and pure task grouping/recurrence modules with bounded rule parsing and enumeration. No dependence on the host timezone.
3. Add a new tasks migration with constraints, same-migration owner RLS, column-limited grants, composite project ownership FK with deletion restriction, recurrence anchor/timezone/ordinal and unique predecessor identity. Add an invoker completion operation that locks the owned row and atomically completes/inserts. Validate caller inputs, ownership and schedule revision; derive successor metadata from the locked record. No privileged client or security-definer business mutation.
4. Add pgTAP ownership/constraint/atomicity/replay cases and a separate concurrent completion check. Generate database types; apply only the new migration to both local stacks without resets or deleting existing data.
5. Add Zod schemas, authenticated Server Actions, task list/detail/editor, recurrence controls, explicit ambiguous-time handling, loading/error states and confirmed deletion. Keep business writes in actions using the user's client.
6. Add browser CRUD/project/recurrence and two-user denial cases. Run lint, typecheck, unit, dependency-cruiser, pgTAP, concurrent completion, production build and Chromium checks. Record actual outcomes; commit/push the implementation branch and open a PR for owner review. Do not merge.

#### Implementation outcome

- Owner approved this acceptance plan and `@js-temporal/polyfill`/`rrule`. Installed versions are 0.5.1 and 2.8.1; production dependency audit reports zero vulnerabilities. The previously recorded development lint dependency advisory remains unchanged.
- New append-only migration `20261004050000_tasks.sql` creates owner-scoped tasks, same-migration RLS, all four CRUD policies, column-limited grants, immutable identity/ownership/predecessor, composite restrictive project/predecessor FKs, validated recurrence clauses, schedule context, status/completion consistency, finite timestamps, revision tracking and unique successor identity. No committed migration or locked path was edited.
- `complete_task` is a fixed-search-path invoker RPC through an authenticated, Zod-validated Server Action. It locks/rechecks the owned task, detects stale revisions, derives successor metadata from that row, applies RLS and atomically completes/inserts. Retries/reopening reuse an existing successor. Database checks reject nonadvancing dates and COUNT/UNTIL overflow; the pure server calendar module calculates the exact next supported occurrence.
- Task list/detail/editor supports optional project/date, escaped notes, priorities, status changes, retained invalid drafts, confirmed deletion and six timezone-aware groups. Guided recurrence controls support daily/weekly/monthly dates/ordinal weekdays, intervals 1–365, COUNT 1–1,000 or inclusive UTC UNTIL. Infinite schedules are not capped at 1,000 occurrences; production successor lookup advances from the persisted due date while retaining the original anchor.
- Archived projects are excluded from new-task choices, existing references remain editable and can be inherited by recurrence, and actual task FKs block project deletion. Schedule edits require explicit confirmation and cannot rewrite a predecessor that already has a successor.
- Lint, typecheck, 103 unit tests, dependency-cruiser and production build pass. Nine Chromium tests pass, including task CRUD/draft retention/plain-text rendering, finite weekly recurrence across November DST, reopen/recomplete without duplicates, actual project deletion restriction/archive choices, foreign UI/Data API/RPC denial, eight concurrent completions yielding one child, and one-off editing/status/deletion after a Pacific-to-Manila display change without moving due_at.
- pgTAP passes 97 assertions on both original and fresh local stacks. Failure injection proves a failed successor insertion rolls back completion and its revision. Both stacks received only the new migration without resets; the fresh stack retained its three users/profiles/projects and had zero tasks after rollback-only tests. Browser fixtures run only on the original stack and retain disposable identities; successful flows delete their synthetic task/project rows.
- Tests caught and corrected nullable recurrence timezone validation, ambiguous implicit textarea labels, save feedback lost through component remounts, malformed UNTIL dates and precise successor advancement for timestamps containing seconds. No owner corrections were needed after acceptance approval.
- Step 1.8 remains the dedicated timezone edge-case checkpoint; baseline cases introduced here do not mark that separate step complete. Required CI and owner review/merge remain pending.


### 1.8 Timezone edge cases — not started

Fixed clocks and explicit IANA zones must avoid dependence on host timezone. Required tests: 11:30pm Pacific remains Today when now is earlier that local day; weekly 9am Pacific stays 9am over November DST; Asia/Manila display change recomputes groups without moving instants; second Tuesday works across a month boundary.

Add spring gap/fall overlap according to approved policy, leap day/month-end skips, exact midnight/week boundaries, overdue earlier today, null due dates, and finite-rule exhaustion. Acceptance: unit cases pass with documented local/UTC results; pgTAP and e2e prove persisted completion behavior. Ask before adding date/recurrence libraries and verify their behavior rather than assuming DST support.

### 1.9 CI and checkpoint — not started

Add editable `.github/workflows/ci.yml`, separate from locked guardrails. Clean checkout runs lint, typecheck, unit, build, local migrations/pgTAP, and Playwright with isolated fixtures. No live OAuth/LLM dependency or production secrets. Failure artifacts must redact sensitive content. Owner makes `ci` required after it is reliable.

Acceptance: database rebuilds from migration history, generated types are reproducible, all tests/checks pass, Google sign-in/settings/projects/tasks/recurrence work, and four guardrail proofs are recorded. Perform documented phase-done checks and update this plan/conventions; owner reviews PR. No Phase 2 implementation before Phase 1 checkpoint.

## Phase 2 — LLM features (outline)

Data: private `attachments` metadata/Storage objects; `llm_usage` with user, feature, model, input/output/cached counts, cost, timestamp, outcome metadata; atomic usage-budget/reservation design to review at 2.1. RLS permits own usage reads but prevents user-forged counters/cost. Trusted accounting must use a narrowly audited privilege design from validated actions without admin-client user paths; propose an ADR if that cannot fit current rules. Define global application-admin identity before `/admin/usage`; workspace ownership is not global admin authority.

| Step | Scope and acceptance |
|---|---|
| 2.1 Detailed plan | Define schemas, stream contract, cancellation/retry accounting, tool limits, confirmation replay defense, thresholds, and every trust boundary; resolve accounting privileges |
| 2.2 Eval set | Owner supplies 15–20 approved/synthetic inputs and expected output: dates, no actions, duplicates, other assignees, Taglish, injection. Recorded default is deterministic/free; explicit live mode reports quality/latency/cost/model |
| 2.3 Extraction | Validated action sends notes, frozen reference date, timezone, RLS-visible projects via server-only Responses API. Strict structured output and Zod; one invalid-output retry then graceful error. Partial streams remain drafts. Only reviewed/confirmed valid tasks save; unknown project IDs fail |
| 2.4 Compare models | Verify current official IDs/capabilities then compare cost/capability tiers on identical fixtures; record exact model, quality, latency, cost, and recommendation |
| 2.5 Ask | User-client search/overdue/summary tools; create returns proposal, UI confirmation invokes action with revalidation/reauthorization and replay protection. Show tools, bound iterations. User B cannot see A's work under hostile prompt/arguments |
| 2.6 Cost controls | Accounting integrated before live release; atomic reservations prevent concurrent cap escape; settle/reconcile success/failure/cancellation. Do not double-count cached input. Review cap timezone and pricing; admin UI explicitly authorized |
| 2.7 Attachments | Server action enforces 10 MB/type checks; private bucket with object ownership policies, safe parsing, bounded extracted text. Verify selected model file-input support and remote retention/deletion before use. Three evals include hidden PDF instructions |
| 2.8 Security | Test pasted/file injections, malformed/refused/truncated outputs, raw-HTML protection, confirmation tampering, duplicates, and cross-user tools. Run documented security-reviewer only when invoked for that step; record fixes |

Routes: `/extract`, `/ask`, `/admin/usage`. Policies: owner-only attachment metadata and Storage reads/writes, no substituted object paths, unforgeable accounting. Tests include budget concurrency, timeouts, cancellation, duplicate acceptance, and oversize/wrong-type files. Default CI calls no paid API.

Checkpoint: reviewed tasks save with correct dates; eval score/model comparison recorded; deterministic eval CI; Ask isolation proven; usage/cap concurrency protected; attachment/injection cases pass. No admin client is added to fix bookkeeping.

## Phase 3 — Workspaces and operations (outline)

Data: `workspaces`, `workspace_members` (owner/member/viewer), `invites`, `digest_runs`; workspace scope added to projects/tasks/attachments/usage/budget state. Profiles remain private. Define creator versus workspace ownership and usage attribution before migration.

| Step | Scope and acceptance |
|---|---|
| 3.1 Refactor plan | Inventory queries/actions/tools/Storage/Realtime. Expand/backfill/validate/cutover sequence makes Personal workspace per user. Rehearse recovery backup and code compatibility; never edit old migrations |
| 3.2 Migrate | Seed two users with projects/tasks/recurrence/attachments/usage; snapshot IDs/counts. Add scope, backfill, validate constraints, deploy compatible code/policies, later remove transitional ownership in new migration. Prove no loss or relaxed-access interval |
| 3.3 Invites | Owner-created hashed expiring single-use token; acceptance verifies recipient identity and atomically consumes token/adds membership. Expired/replayed/concurrent/wrong-email attempts fail; two-user e2e |
| 3.4 Realtime | Two members see task changes within two seconds in controlled tests; outsider sees none. Reconnect resync, optimistic deduplication, and membership-loss cleanup |
| 3.5 MFA | Security settings and step-up UI. Database enforces aal2 for workspace delete/member removal even with direct requests; prevent removing last owner |
| 3.6 Digest | Blocked pending ADR 0007. Cron selects owner-local Monday 8am windows. Explicit per-workspace admin scope, unique workspace/week run key, resumable state, empty-week skips, usage tracking. Owner approves email provider; use delivery idempotency where supported and expose ambiguous outcomes |
| 3.7 Performance | Seed 20 workspaces, 500 projects, 100k tasks, five overlapping users. Authenticated EXPLAIN ANALYZE and k6 on task/Ask paths; baseline then justified changes with before/after evidence |
| 3.8 Observability | Sentry client/server/jobs, readable stacks/source maps/releases, correlated redacted logger, health endpoint/alerts. Controlled test error visible; no prompt/file/credential capture |
| 3.9 Planted bug | Owner introduces isolated RLS fault; diagnose actual policy, add cross-workspace regression, do not merely filter symptoms |
| 3.10 Deploy | Owner approves every production command; review backup/recovery, ordered migrations, secrets, redirects, functions/Cron/Vercel, smoke tests. Runbook only after docs permissions clarified |
| 3.11 Incident | Owner injects scoped failure; inspect logs/Sentry, restore with approved commands, record impact/cause/prevention |
| 3.12 Final review | Explicit security-reviewer invocation, tests, performance report, remaining launch gaps/fragile code; owner launch decision |

Routes: workspace selection/settings, token invite acceptance, security settings, health. Role matrix: viewers read; members read/create/edit work; owners additionally manage workspace/invites/membership. Decide member delete permissions at 3.1. Anonymous/nonmembers denied; users cannot self-promote. Recipient invite acceptance has narrowly audited authority, not arbitrary membership INSERT. Workspace/member deletion needs aal2. Sharing a workspace does not expose all profile fields.

Use one narrow security-definer membership helper to avoid policy recursion, with fixed search path, minimal grants, no dynamic SQL, and row-specific workspace predicates. Owner checks distinguish roles explicitly. Test unrelated-workspace membership cannot satisfy a policy and task/project workspace constraints cannot be forged. Migrate Storage ownership with metadata and preserve recurrence timezone.

Digest service-role access is confined to the approved background exception. User test-send starts from a validated authorized Server Action without importing admin into its request path. Durable/authenticated handoff is a 3.6 design gate. Unique run keys/resume logic prevent avoidable repeats; do not claim exactly-once email without provider support and reconciliation.

Checkpoint: shared roles/MFA hold under direct queries, old data remains, realtime isolated, digest received/resumable, measured performance, observability and incident recovery, owner-approved deployment.

## Migration workflow and evidence

For every schema step: review ADRs and policy matrix; create a new migration with constraints/grants/RLS/policies; add pgTAP and business-invariant tests; apply/reset only an explicitly local disposable database; run `supabase test db`; regenerate types; run required app/import checks; record outcomes; owner merges PR. Phase 3 tests both clean rebuild and upgrade with preserved data. Production reset is never part of this procedure.

| Risk | Evidence/mitigation |
|---|---|
| CI skips or wrong failure | Activated prerequisite files and four independent violation/check results |
| Cross-user leaks | Direct-role pgTAP negatives, composite references, request-level tests |
| DST/duplicate recurrence | Fixed clock/local and UTC fixtures; schedule context; transaction and replay tests |
| Overstated guardrails | Build-based boundary proof and review; owner changes locked checks when necessary |
| Budget races | Atomic reservations, trusted counters, cancellation reconciliation |
| Workspace migration loss | Snapshots, staged backfill/cutover, role matrix at each stage |
| Injection | Schemas, escaped rendering, user-client tools, confirmation and loop/input bounds |
| Digest delivery uncertainty | Unique run keys, retries/idempotency, observable ambiguous delivery state |
| API/dependency drift | Approved additions; installed Next.js guides/current provider docs before coding |

## Session handoff

- Completed: orientation, accepted OpenAI ADR/guardrails, owner-merged documentation/plan/CODEOWNERS, branch protection verification, approved dependencies, owner-merged scaffold with passing local and CI checks, four independent guardrail probes and local server-only build proof.
- Owner deferred ADR 0007 until before Phase 3. Product defaults remain revisitable before their feature steps; no background-write exception has been accepted.
- Next: review/merge the step 1.7 tasks PR after required CI, then proceed to the step 1.8 timezone edge-case checkpoint. Owner confirmed PR #15 merged; 1.7 is implemented with passing local checks and 1.8–1.9 remain unstarted. Fresh-session refusal exercise still needs evidence.
- Checks/outcomes recorded under 1.3–1.6. Google smoke test confirmed by owner; projects owner-merged and tasks implemented/tested on a feature branch. No remote deployment or paid LLM calls added. Locked paths remain unchanged on the feature branch.
- Scaffold PR #4 is merged. Probe PRs #5–#8 are deliberately unmergeable exercises, including unexpectedly green #5. Later sessions record actual checks/outcomes and changed assumptions; never mark an unrun check passed.
