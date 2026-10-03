# ActionDesk starter kit

## Local scaffold

Requires Node 24, npm, Docker, and the Supabase CLI. The scaffold is a Next.js App Router application; Google sign-in and task features are subsequent kickoff steps.

```bash
npm ci
supabase start
```

Copy `.env.example` to `.env.local` and obtain the public URL/key from `supabase status`. ActionDesk uses API port **55321**, database **55322**, Studio **55323**, and local email UI **55324** to coexist with another local Supabase stack. Google OAuth setup in step 1.5 must allow `http://127.0.0.1:55321/auth/v1/callback` rather than the kickoff's default-port example. No remote project is linked by local setup.

`SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are unnecessary for the scaffold. Leave them empty; no paid API calls occur. The public homepage renders without credentials. Session refresh for future authenticated routes needs the public Supabase configuration and local Auth server.

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run check:architecture
supabase test db
npm run build
npx playwright install chromium
npm run test:e2e
```

The dev server defaults to port 3000; Playwright starts a production server on 3100 after a successful build. Dev/build use Next.js's supported Webpack mode because Turbopack's internal PostCSS port binding is blocked in the agent environment, including after escalation. Database types are generated with `supabase gen types typescript --local > src/lib/database.types.ts` after schema changes. The empty baseline migration and seed deliberately create no business data. Recorded/live eval scripts arrive with Phase 2, and the application CI workflow arrives in step 1.9; the existing guardrails workflow becomes active with this scaffold.

Dependency audit: the development lint chain currently reports GHSA-vfj7-8cjw-p6xm in `braces`, with no published patch. Do not apply npm's suggested forced downgrade to the Next.js 14 lint configuration. Production-only audit is checked separately; track the lint-chain fix upstream.

The repository's architecture and locked paths still apply. Codex does not execute the starter kit's Claude Code hooks or slash commands.

## Starter kit reference

Seed files for the ActionDesk repo, with the architecture locked so Claude Code can propose changes but not make them.

1. Unzip into an empty folder, `chmod +x .claude/hooks/guard.sh guardrails/check.sh`.
2. Follow **docs/KICKOFF.md** from section 0.

| Path | What it is | Claude Code can edit? |
|---|---|---|
| CLAUDE.md | Project instructions; imports architecture + conventions | No |
| docs/architecture.md | Tiers, trust boundaries, rules R1–R7, enforcement map | No |
| docs/adr/ | Decision records 0001–0005 + template | No |
| docs/conventions.md | Conventions learned while building | Yes |
| docs/plan.md | Working plan (written in step 1.1) | Yes |
| docs/KICKOFF.md | The phase-by-phase guide | Yes (it's your guide; Claude doesn't need to) |
| .claude/settings.json | Permissions, deny rules, hooks | No |
| .claude/hooks/guard.sh | **Not included.** `settings.json` calls it; add your own or remove the `PreToolUse` hook (see KICKOFF section 0) | — |
| .claude/commands/ | /migrate, /phase-done, /propose-adr | No |
| .claude/agents/security-reviewer.md | Review subagent | No |
| guardrails/ | dependency-cruiser rules + CI check script | No |
| .github/workflows/guardrails.yml | Required CI check | No |
| .github/CODEOWNERS | Ownership of locked paths | No |
| supabase/tests/000_rls_enabled.test.sql | Fails if any public table lacks RLS | No |
