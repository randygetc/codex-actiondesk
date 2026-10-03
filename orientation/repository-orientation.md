# ActionDesk repository orientation

ActionDesk is currently a starter kit with a defined architecture, rather than an implemented application. This report is based on the requested repository documents and existing guardrail configuration. The orientation itself used only read-only commands; this report was subsequently saved at the user's request.

## 1. What ActionDesk does

Users paste meeting notes or emails, or upload documents. Claude extracts proposed action items; users review, edit, and approve them before saving tasks. An “Ask ActionDesk” assistant answers questions about their work.

The kickoff expands this into recurring tasks, timezone-aware due dates, shared workspaces, roles, realtime updates, and weekly AI digest emails.

## 2. Architecture and trust boundaries

`docs/architecture.md` defines three tiers:

| Tier | Responsibility | Trust boundary |
|---|---|---|
| Browser | Rendering, local state, reads, realtime subscriptions | Cannot hold privileged keys or decide authorization |
| Next.js server | Validated Server Actions, sessions, LLM service | Must validate browser input and LLM output |
| Supabase | PostgreSQL, Auth, RLS, Storage, background jobs | RLS decides which rows a user can access |

Pasted text and uploaded files are hostile input. Model output is untrusted. Human approval is required before extracted tasks are saved or assistant write tools execute.

## 3. Which files may be modified

The original orientation request prohibited all changes. The subsequent request authorized creating this report in a new folder.

For future authorized implementation, editable areas include application code, new migrations, additional tests, and a separate application CI workflow. The documents explicitly allow editing `docs/plan.md`, `docs/conventions.md`, and `docs/KICKOFF.md`.

Other documentation is treated as locked by the kickoff guide. Its later requests for learning notes and deployment documents create an ambiguity to resolve before writing those files.

## 4. Locked files

- `CLAUDE.md`
- `docs/architecture.md`
- `docs/adr/**`
- `.claude/**`
- `guardrails/**`
- `.github/workflows/guardrails.yml`
- `.github/CODEOWNERS`
- `supabase/tests/000_rls_enabled.test.sql`
- Every committed file under `supabase/migrations/**`

Architecture changes require an ADR proposal in the assistant's reply, followed by the owner's acceptance and the owner's changes to locked files. Implementation must stop if it requires violating these boundaries.

## 5. Most important architectural rules

- Every public table has RLS enabled and tested policies.
- User request paths use user-scoped Supabase clients.
- All application mutations go through Server Actions with Zod validation.
- LLM output receives the same validation as user input.
- Browser code cannot import privileged server modules.
- Committed migrations are append-only.
- Server authorization uses `auth.getUser()`, never `getSession()`.
- Store timestamps as UTC `timestamptz`; apply profile timezone at the edges.
- Use one structured logger, without logging content, tokens, or secrets.
- Measure before adding indexes, caching, or query optimizations.

Before committing, lint, typecheck, tests, and dependency checks must pass. Adding dependencies requires asking the owner. The owner retains responsibility for merges, pushes to `main`, and PR labels.

## 6. Database migrations

ADR 0005 requires every schema change to use a new migration. Committed migrations cannot be edited, renamed, or deleted; mistakes are fixed forward.

The migration workflow requires enabling RLS in the same migration that creates a table, adding policy tests for owner access, other-user denial, anonymous denial, and eventually workspace roles. Then rebuild and test the local database and regenerate TypeScript database types.

Production-affecting commands require owner approval. No database commands were run during this orientation.

## 7. LLM and Supabase access

Anthropic SDK imports are limited to `src/lib/llm/**` and Supabase Edge Functions. Every application LLM module must import `server-only`; the Anthropic key must never reach the browser.

LLM tools receive the current request's user-scoped Supabase client so RLS applies. Write tools propose an action and wait for UI confirmation.

The service-role client is centralized in `src/lib/supabase/admin.ts`, with imports restricted to `src/lib/admin/**` and Edge Functions. The weekly digest is the documented exception to user-scoped tools: it runs as a background job with explicit workspace scoping.

## 8. Tests and guardrails

| Protection | What it checks |
|---|---|
| dependency-cruiser | SDK/admin import restrictions, component boundaries, required `server-only` imports, circular dependencies |
| pgTAP coverage test | Public tables have RLS; public views use `security_invoker` |
| Guardrail shell script | Existing migrations unchanged; locked-path changes have the owner's approval label |
| GitHub Actions | Runs these checks when scaffold prerequisites exist |
| Claude settings | Edit restrictions and command restrictions for Claude Code |

Planned verification includes Vitest, Playwright, per-policy pgTAP tests, deterministic LLM evals, cross-user isolation tests, and k6 performance testing.

Enforcement is not fully operational yet: there is no package manifest, application source, Supabase configuration, or application test suite. CI currently skips import and database checks without those prerequisites. The configured Claude guard hook is missing, CODEOWNERS still has a placeholder, and no ESLint configuration exists despite the architecture mentioning ESLint enforcement. Claude-specific settings also do not automatically provide Codex runtime enforcement.

GitHub branch protection cannot be established from the local files alone.

## 9. Current kickoff progress

The repository appears to be before completion of Phase 1, step 1.1: planning.

`docs/plan.md` contains only a placeholder. Architecture decisions and guardrail seed files exist, but scaffolding has not begun. The conventions document is also empty.

At orientation time, Git status showed an existing untracked `AGENTS.md`; it was left untouched. External account and setup completion remains unknown.

## 10. Recommended next work

First write a reviewable plan covering all three phases, with Phase 1 detailed into data model, RLS policies, routes, acceptance criteria, and tests.

Before scaffolding, the owner should complete the owner-controlled setup: resolve the missing hook, replace CODEOWNERS placeholders, and establish GitHub protections. Then scaffold the application on a branch and prove the guardrails with the kickoff's four deliberate violations before implementing authentication and task tracking.

No implementation or existing document changes were made for this report.
