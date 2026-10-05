# Commit guide with command explanations

Date: 2026-10-05

This guide covers the documentation changes on `ci/phase-one-checkpoint`. Run these commands yourself from the repository root. Saving this guide does not execute the checks, create commits, push the branch, or accept the proposed ADR.

Git has three relevant places: the working tree contains your files, the staging area selects the changes for the next commit, and commits store those selected changes in local history. Pushing sends local commits to the remote repository.

## 1. Confirm your branch and pending changes

```sh
git branch --show-current
git status --short
```

- `git branch --show-current` prints the checked-out branch. Expect `ci/phase-one-checkpoint`. Stop if another branch is shown; these instructions assume the named branch.
- `git status --short` lists staged, unstaged, and untracked files. ` M` means a tracked file has unstaged changes, `M ` means changes are staged, `A ` means a new file is staged, and `??` means a file is untracked. The two status columns describe the staging area and working tree respectively.

Check that the list matches the work you intend to commit. If unrelated changes are already staged, remove those paths from the staging area before continuing:

```sh
git restore --staged path/to/unrelated-file
```

This removes that path's changes from the next commit while preserving its working-tree contents. Replace the example path with the actual file. Do not use this command to remove another person's intentional staged work without coordinating with them.

## 2. Run the required checks

Run each command separately and continue only after it succeeds:

```sh
npm run lint
npm run typecheck
npm test
npm run check:architecture
git diff --check
```

| Command | What it does and why |
|---|---|
| `npm run lint` | Runs the repository's ESLint script to catch code-quality and convention violations. |
| `npm run typecheck` | Generates Next.js route types and runs TypeScript without emitting application JavaScript. It catches type errors and incompatible interfaces. |
| `npm test` | Runs the configured Vitest suite once to check application behavior. It does not run Playwright or database tests. |
| `npm run check:architecture` | Runs dependency-cruiser using the repository's guardrail configuration. It checks imports against the approved architectural boundaries. |
| `git diff --check` | Checks unstaged tracked changes for whitespace errors and introduced conflict markers. It does not validate document claims or inspect untracked files. |

The first four checks are required before commits by the repository's working rules, even though this batch changes documentation. If a check fails, investigate it before committing; do not disable a guardrail to proceed. Once all pass, they need not be repeated for every documentation-only commit in this same unchanged batch.

## 3. Commit the Codex instructions

```sh
git add AGENTS.md
git diff --cached
git diff --cached --check
git commit -m "docs: add repository governance to Codex instructions"
```

- `git add AGENTS.md` stages the current contents of that file. Naming the path keeps unrelated files out of this commit.
- `git diff --cached` shows all staged changes: the exact content selected for the next commit. Confirm that only the intended `AGENTS.md` change is present and that the Next.js block remains intact. Press `q` if Git displays the diff in a pager.
- `git diff --cached --check` checks the staged diff for whitespace errors and conflict markers. This also works for newly added files once they are staged.
- `git commit -m "..."` records the staged changes in local history. `-m` supplies the commit message. This message describes the addition of repository governance to Codex's instructions. A commit does not upload anything to GitHub.

Keeping this change separate makes the instruction update easy to review or revert independently of planning documents.

## 4. Commit the checkpoint update

```sh
git add docs/plan.md
git diff --cached
git diff --cached --check
git commit -m "docs: record Phase 1 checkpoint completion"
```

- `git add docs/plan.md` selects only the plan update.
- `git diff --cached` lets you review the checkpoint claims, supporting evidence, and remaining gates. Confirm those claims are accurate; Git cannot establish their truth.
- `git diff --cached --check` validates the staged diff's whitespace.
- `git commit -m "..."` creates a separate local commit for the Phase 1 checkpoint record.

This separates recorded completion evidence from future proposals.

## 5. Commit the workflow-cost review and proposed ADR

```sh
git add orientation/llm-workflow-cost-review.md orientation/proposed-adr-0008-workflow-cost-accounting.md
git diff --cached
git diff --cached --check
git commit -m "docs: propose workflow-level LLM cost accounting"
```

- `git add` with these two explicit paths stages the review and its corresponding ADR draft together. New files become tracked when committed.
- `git diff --cached` displays their full proposed contents. Confirm the ADR remains Proposed, uses OpenAI, and preserves the existing architectural restrictions.
- `git diff --cached --check` checks the new staged files for whitespace issues.
- `git commit -m "..."` records the proposal and rationale together. The word "propose" makes clear that the decision is still under review.

Committing a proposed ADR does not accept it or authorize implementation. The canonical `docs/adr/` directory remains locked under the repository's owner-controlled process.

## 6. Commit the Phase 2 planning drafts

```sh
git add orientation/step-2.1-draft.md orientation/step-2.1-owner-guide.md
git diff --cached
git diff --cached --check
git commit -m "docs: draft Phase 2 planning and owner review guide"
```

- `git add` selects the detailed planning draft and its owner review guide.
- `git diff --cached` lets you check scope, unresolved decisions, and whether the drafts clearly distinguish proposals from implementation authorization.
- `git diff --cached --check` checks their staged whitespace.
- `git commit -m "..."` records those related documents in their own local commit.

This keeps Phase 2 planning distinct from the accounting ADR and Phase 1 completion record.

## 7. Optionally commit this guide

```sh
git add orientation/commit-guide.md
git diff --cached
git diff --cached --check
git commit -m "docs: explain documentation commit workflow"
```

These commands select, review, check, and record this guide itself. Use them if you want the instructions available to future repository readers. Otherwise, leave the guide untracked for now.

## 8. Check the result and review agent configuration separately

```sh
git status --short
git log -4 --oneline
```

- `git status --short` shows what remains uncommitted. Expect `.agents/` and `.codex/` to remain untracked unless you have separately reviewed and committed them. This guide also remains untracked if you skipped step 7.
- `git log -4 --oneline` shows the most recent four commits using abbreviated commit IDs and their subject lines. It confirms that the main documentation commits were created. If you also committed this guide, use `git log -5 --oneline` to see all five.

The `.agents/` and `.codex/` paths contain agent configuration. Review their behavior and contents separately before staging them. They are not automatically local-only or unsuitable for version control, but they are outside this documentation batch.

Avoid `git add .` here: it would stage every nonignored change beneath the current directory, including configuration you have not reviewed.

## 9. Push the branch

```sh
git push -u origin ci/phase-one-checkpoint
```

- `git push` sends local commits to the remote repository.
- `origin` identifies the configured remote.
- `ci/phase-one-checkpoint` names the local branch to publish to the corresponding remote branch.
- `-u` sets the upstream tracking relationship so future Git status output can compare local and remote history, and future pushes can use that relationship.

Pushing publishes all commits reachable from this branch that the remote lacks, not just the most recent documentation commit. Review your branch history before pushing if it contains other work.

If the push is rejected, inspect the reason. Do not force-push to bypass a rejection or overwrite remote work.

## 10. Open a PR and wait for checks

Use GitHub to open a PR targeting `main`. If the previous PR for this branch has already merged, open a new PR for these commits and inspect its Files changed tab to confirm the intended scope. GitHub's comparison is the review surface for what would enter `main`.

Wait for both required checks, `ci` and `guardrails`, to pass. The owner reviews and merges the PR. Publishing these drafts does not accept the proposed ADR or approve Phase 2 implementation.
