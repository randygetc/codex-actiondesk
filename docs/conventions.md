# Conventions

Editable by Claude Code. Record project conventions learned while building (naming, folder patterns,
test helpers, UI patterns). Conventions must not contradict docs/architecture.md; if one would,
propose an ADR instead.

<!-- Add entries below, newest last. -->

## Provider changes

Application LLM provider choices are separate from the coding assistant used to develop the repository. OpenAI is the accepted application provider under ADR 0006; Conventions and editable plans do not override the locked architecture or accepted ADRs.

Keep provider-specific request handling, response parsing, usage accounting, and model configuration inside the approved LLM module boundary. Verify API capabilities and model IDs against current official provider documentation before implementation.

## Agent tooling

The starter kit's `.claude/` permissions, hooks, and slash commands are Claude Code configuration. Codex must follow repository instructions and CI guardrails without assuming those hooks execute in its session.

## Scaffold conventions

- Node 24 is selected in `.nvmrc` and package engines; npm lockfile is committed for reproducible installs.
- Next.js 16 uses `src/proxy.ts` and asynchronous `cookies()`. Proxy refreshes sessions with `getUser()`; future actions/pages still authorize independently and rely on RLS.
- `npm run typecheck` runs `next typegen` before TypeScript so a fresh checkout needs no prior build. Generated `next-env.d.ts` and `.next/` files are ignored.
- Use the documented Webpack mode for dev/build in this agent environment; Turbopack's internal PostCSS listener is blocked even after escalation. This changes the bundler, not architectural checks or type checking.
- ActionDesk's local Supabase uses ports 55320–55329 to coexist with another stack. Its Google Auth callback will use port 55321; do not stop or reconfigure unrelated local stacks.
- Public Supabase settings are read explicitly in `src/lib/supabase/config.ts`; never expose a whole environment object to browser code. Server-only admin/LLM clients are constructed lazily and are unused by the public scaffold.
- `components.json`, CSS theme tokens, and `cn()` establish the shadcn/ui setup. Component dependencies require approval when added later.
- Unit tests are colocated as `*.test.ts(x)`; e2e tests live in `tests/e2e/`. Vitest aliases `server-only` only in the test runner; the actual Next.js build retains its enforcement.
- The single logger validates an allowlist of metadata and strips unexpected properties. Application code must not call console directly.

## Authentication and profiles

- `requireUser()` verifies `getUser()` inside each protected page and mutation. The protected layout is navigation gating; it does not replace action authorization or RLS.
- OAuth initiation is a validated Server Action; `/auth/callback` exchanges the PKCE code and verifies the user as identity/session lifecycle. It does not write business tables. OAuth destinations use the configured server-side `APP_URL` origin and the `/tasks`, `/projects`, `/settings` allowlist, never forwarded-host input.
- Profiles are provisioned once by a private, fixed-search-path Auth trigger. Auth metadata supplies a bounded display name, never ownership or timezone. Authenticated users have own-row SELECT and column-limited UPDATE, with no INSERT/DELETE grants.
- Timezones accept IANA names and UTC; Zod validates before actions write, and a database constraint independently checks the timezone catalog. Updating the preference does not rewrite any stored instants.
- Browser tests provision disposable users through the public-key local Auth API, establish SSR cookies, and exercise real actions/RLS. They target only ActionDesk's local port 55321 and leave those test identities in the local database. pgTAP fixtures roll back. No service-role application path or test-login route exists.

### Local Google OAuth setup and manual smoke test

Provider setup follows [Supabase's Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google); use ActionDesk's ports rather than the guide's default ports.

1. In Google Auth Platform, configure branding/audience, add your Google account as a test user if the app is in Testing, and create a Web application OAuth client with the `openid`, email, and profile scopes.
2. Add application origins `http://127.0.0.1:3000` (and `http://localhost:3000` if you use it). The Google authorized redirect URI is **`http://127.0.0.1:55321/auth/v1/callback`**, the Supabase Auth endpoint, not the Next.js callback.
3. Copy `.env.example` to ignored `.env.local`. Set the local public Supabase URL/key obtained from `supabase status` and `APP_URL=http://127.0.0.1:3000`. Only public Supabase settings go in `NEXT_PUBLIC_` variables.
4. Create ignored project-root `.env` with `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`, as specified by [Supabase's local configuration guide](https://supabase.com/docs/guides/local-development/managing-config). In your local `supabase/config.toml`, change only `[auth.external.google] enabled` to `true`; keep credentials as `env(...)` references and `skip_nonce_check=false`. Keep this local enablement out of commits so credential-free CI continues to start.
5. Restart only this project's local Supabase (`supabase stop`, without `--no-backup`, then `supabase start` from this repository); this preserves its local data. Do not stop unrelated stacks. Start `npm run dev`, then visit `http://127.0.0.1:3000/login` using the same hostname throughout.
6. Continue with Google, complete consent, and confirm arrival at `/tasks`. In Settings, confirm the profile and initial `America/Los_Angeles` timezone, save `Asia/Manila`, reload to verify persistence, try an invalid zone, and sign out. Visiting `/settings` afterward must lead to login. Sign in again and confirm the saved zone was preserved rather than a profile recreated.

The committed config allowlists the Next.js callback on ports 3000/3100; if using `localhost` instead of `127.0.0.1`, update `APP_URL` and the local Supabase redirect allowlist consistently. Hosted/dev-project setup uses that project's Google provider settings and Supabase Auth callback URL plus the deployed application's exact callback URL. No remote project is configured by this step.

## Projects

- Names are required and trimmed (1–120 characters); descriptions are optional plain text up to 2,000 characters. React escapes descriptions rather than rendering markup.
- Project owner comes from verified Auth identity; column grants prevent identity/ownership/creation-time changes, and RLS protects direct Data API requests as well as actions.
- Archive/restore changes availability for future new-task choices without deleting project history. Hard deletion requires explicit confirmation. Step 1.7 must introduce the task ownership FK with restrictive project deletion and test referenced-project rejection; no task cascade is allowed.
- Browser tests build the production app with the same test-stack settings used at runtime. This avoids Next.js embedding the manual fresh stack's public environment settings during compilation. The manual fresh instance lives in locally ignored `.local-supabase/fresh` on ports 56320–56329; the original stack on 55320–55329 is used for disposable browser fixtures.

## Tasks and recurrence

- Tasks use UTC `due_at`/`completed_at`; recurring tasks retain a local anchor, captured IANA timezone and occurrence ordinal. Profile timezone changes never rewrite these fields.
- Calendar enumeration uses `rrule` floating UTC-shaped dates only as local calendar coordinates; Temporal resolves those coordinates into actual IANA instants with explicit DST policy. Manual gaps reject and overlaps require a valid offset; recurrence gaps shift forward and overlaps use the earlier offset.
- Guided controls serialize only the supported RRULE subset. Server parsing and a database constraint reject unsupported/duplicate clauses, invalid calendar endings and excessive interval/count inputs. COUNT includes the original task; inclusive UNTIL is UTC. Invalid month dates skip and missed dates remain scheduled.
- Completing a task calls the user-scoped invoker `complete_task` RPC through a Server Action. The RPC locks/rechecks the row and atomically completes/inserts; a unique predecessor reference prevents duplicate children. Stale revision errors trigger bounded recalculation retries. Child metadata is derived from the locked row, never submitted by the browser.
- Project and predecessor ownership FKs restrict hard deletion. Archived projects cannot receive new assignments; existing references can be retained and inherited. Schedule edits require explicit confirmation, and predecessor schedules remain immutable once a successor exists.
- Explicit form labels keep accessible names stable when controlled textarea contents change. Keep form identity stable across server refreshes so save messages and invalid drafts persist.
- Supabase's generated RPC argument types omit SQL nullability. `complete_task` accepts null for no successor; the narrow argument assertion preserves that runtime null rather than omitting the required argument.

- Owner clarified that task calendar weeks start Sunday. This week ends at the next Sunday midnight in the profile timezone; dates from that boundary belong to Later. Today and Overdue retain precedence. This replaces the earlier Monday task-grouping default; the separately planned Monday digest schedule is unchanged.
