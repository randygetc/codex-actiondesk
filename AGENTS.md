# ActionDesk repository instructions

Before making changes, read [CLAUDE.md](CLAUDE.md) and follow its repository
governance and working rules. These rules apply to Codex as well as Claude Code.
Read its referenced documents, `docs/architecture.md` and `docs/conventions.md`,
and read `docs/plan.md` at the start of each session.

For architecture or locked-path changes, follow the owner-controlled ADR process
in those documents. When `/propose-adr` is unavailable, read
`.claude/commands/propose-adr.md` and provide the proposal in your reply only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
