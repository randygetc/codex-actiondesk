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
