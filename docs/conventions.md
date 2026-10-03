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
