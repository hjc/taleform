---
name: pr-tidying
description: Tidy a branch before opening its PR: audit the diff against its parent for cleanup issues, keep the instruction/context docs in sync, and drive `npm run check` green. Use when preparing a branch for review or landing.
---

# PR Tidying

Audit and clean up a branch before PR submission. Compare against its **parent**: `main` for a standalone branch, the branch below it in a stack (`docs/sdlc.md` §3). Identify every cleanup issue across the changed files, present findings for approval, and apply fixes. Then drive `npm run check` (typecheck + vitest + bundle) to green and re-run the read-only parity check against the live vault. Resolve every failure, warning and error the branch introduced.

Below, `<parent>` is that parent branch and `<vault>` is the live vault path from `CLAUDE.md` § The vault.

A PR is also where the project's living documentation drifts, so the pass treats the instruction and context artifacts as in-scope too — `CLAUDE.md`, `README.md`, `.claude/skills/`, `.claude/agents/` and agent-memory files, the context docs, and `docs/sdlc.md`. Pay EXTRA attention to `docs/sdlc.md`: it is the canonical catalog of the repo's AI infrastructure, so any skill, agent, or context doc this branch introduces, renames, or removes MUST be reflected there.

**This skill is an orchestrator.** It owns reconnaissance, the dispatch, the findings report, the fix pass and the check runs. The audit rules live in the reference files, one per audit. Point each agent at its file; never summarise one into a dispatch prompt.

## The audits

Eleven audits, one reference file each, one subagent each. The ID prefix is the finding ID in the report.

| ID | Audit | Reference | Findings file |
|---|---|---|---|
| A | Imports & runner boundaries | `references/imports.md` | `.tmp/pr-tidying-findings-imports.md` |
| B | LLM-development tests | `references/test-scaffolding.md` | `.tmp/pr-tidying-findings-test-scaffolding.md` |
| C+D | Test overlap, consolidation & speed | `references/test-structure.md` | `.tmp/pr-tidying-findings-test-structure.md` |
| E | Algorithm inefficiency | `references/efficiency.md` | `.tmp/pr-tidying-findings-efficiency.md` |
| F | Planning & rambling comments | `references/comments.md` | `.tmp/pr-tidying-findings-comments.md` |
| G | Public interface & generated-output stability | `references/public-interface.md` | `.tmp/pr-tidying-findings-public-interface.md` |
| H | Instruction & context doc sync | `references/docs-sync.md` | `.tmp/pr-tidying-findings-docs-sync.md` |
| I | Vault coupling & implicit wiring | `references/vault-coupling.md` | `.tmp/pr-tidying-findings-vault-coupling.md` |
| J | Instruction & context doc hygiene | `references/docs-hygiene.md` | `.tmp/pr-tidying-findings-docs-hygiene.md` |
| K | Plan & artifact lifecycle | `references/plan-lifecycle.md` | `.tmp/pr-tidying-findings-plan-lifecycle.md` |
| L | Type completeness | `references/typing.md` | `.tmp/pr-tidying-findings-typing.md` |

**One audit per agent, and no agent reads a second reference.** Each agent holds one rule set and one read-set.

**Skip an audit only when its read-set is empty**, and say so in the report. No `src/` changes → skip E, I and L, and skip G unless the branch is a landing point whose segment changed `src/`. No `test/` changes → skip C+D. No changed `.md` under an instruction path and no new skill/agent → skip J. Never skip A, B, F, H or K because the branch "probably has none" — establishing that is the audit's job.

**Extending the pass:** a new audit is a new reference file plus a new row above. Never grow an existing reference to cover a second question. Categories H, K and M are cited by letter from `docs/sdlc.md`; never re-letter them.

## Workflow

### Phase 1: Reconnaissance

Orchestrator only, before any dispatch.

1. **Establish `<parent>`.** The base the PR targets is the tell; ask the DM if it is not obvious.
2. Run `git log --oneline <parent>..HEAD` to list all branch commits.
3. Run `git diff --stat <parent>..HEAD` to list all changed files.
4. **Establish the branch's position in its stack.** Determine whether it is the **final** branch — a standalone branch is its own final branch. Category K depends on this.
   - **Establish whether it is a landing point** (`docs/sdlc.md` §3 → Landing the stack): the close slice, or a slice the PRD's slice list marks vault-gating. At a landing point, also establish the **segment base** — the top branch of the next segment down if that segment has not landed, otherwise `main`. Category G depends on both.
5. **Establish which slice this branch ships**, if the effort is sliced. Category K cannot run without it and must not guess.
6. Capture the diffs into separate `.tmp/` files so each agent reads only what it needs rather than re-deriving the whole diff:

   | File | Contents |
   |---|---|
   | `.tmp/pr-tidying-diff-src.txt` | `src/` |
   | `.tmp/pr-tidying-diff-tests.txt` | `test/` |
   | `.tmp/pr-tidying-diff-docs.txt` | `*.md`, `.claude/**` |
   | `.tmp/pr-tidying-diff-full.txt` | everything, including `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `scripts/`, `manifest.json` |

   A starting point, not a boundary — a reference's stated read-set wins, and an agent needing a file's current contents reads the file.
7. **Capture the parity baseline** when the branch touches `src/`: `npm run build`, then `node dist/cli.cjs check --vault "<vault>" > .tmp/pr-tidying-parity.txt 2>&1`, recording the exit code. It is read-only. Category G reads it. Rebuilding `dist/` makes this branch's CLI the one the vault's hooks call (`docs/sdlc.md` §1) — say so in the final report if the branch changes CLI behaviour.

`.tmp/` is scratch: never stage it.

### Phase 2: Dispatch

Dispatch **one `general-purpose` subagent per in-scope audit, all in a single message** so they run concurrently.

**Every agent MUST write its report to its canonical findings file as its LAST action, before returning.** The file is the deliverable; the return message is only a pointer to it.

Use this brief verbatim, substituting the bracketed values:

```
Run ONE audit from the /pr-tidying pass: [Category <ID> — <Audit name>].

1. Read `.claude/skills/pr-tidying/references/<reference>.md` in full FIRST. It is the complete
   and only rule set for this audit — its "What to flag" and "What NOT to flag" lists are
   exhaustive, and its stated read-set is what you read. Do not audit for anything it does
   not name; another agent owns every other category.
2. Branch context: parent `<parent>`; shipping slice `<slice or "n/a">`; final branch of stack:
   `<yes|no>`; landing point: `<yes|no>`; segment base: `<branch or "n/a">`.
   Diffs are captured under `.tmp/pr-tidying-diff-*.txt`; the parity output under
   `.tmp/pr-tidying-parity.txt` (absent when the branch does not touch `src/`).
3. Verify every finding against the CURRENT file before reporting it — confirm the line number
   and quote the exact text. A finding that does not reproduce is worse than a missed one.
4. Only flag issues in code this branch ADDED or CHANGED (check `<parent>..HEAD`, not just the
   current file), except where your reference explicitly widens the scope.
5. Do not flag borderline cases. Only clear-cut issues where the fix is unambiguous.
6. Do not apply any fix. This is an audit; the orchestrator applies fixes after approval.

Scope guardrail: scope every search and read to the project root (`taleform`). Never the parent
directory, never a sibling checkout. Never write to, build against, or run `build` on the live
vault; the only vault read is the parity output the orchestrator already captured.

Write your complete findings to `<findings file>` using the Write tool as your FINAL action,
then reply with only that path and a one-line count of findings. If you find nothing, write
that explicitly in the file — never leave the file absent or empty, since an absent file is
indistinguishable from a crash.
```

**Read the findings files, not the agents' return messages.** They are the source of truth and they survive an agent that never reported. Before reading, check each expected file exists and is non-empty.

**If a file is missing or empty, that agent's audit did NOT happen** — whatever it said on the way out. Re-dispatch it or run that audit yourself, then name in the Phase 3 report which audits were re-run. **Never present a category as clean when no one examined it.**

Spot-check every finding whose fix is destructive — deleting a test file, removing a `RETIRED` entry, changing a `nid(...)` input, deleting a plan — against the current file before it reaches the report.

### Phase 2b: Category M — Issue Triaging

Read `references/issue-triage.md` and follow it. In the same message as Phase 2, dispatch one `issue-triager` per issue it selects; skip M when it selects none, and say so in the coverage line.

**Completeness is the report's terminal line, not the findings file.** Each `issue-triager` writes `.claude/reviews/<issue-slug>.issue-triager.md` ending in `## Review complete — <verdict>`. A report without that line did not finish: re-dispatch that issue before Phase 3. Then collect the verdicts into `.tmp/pr-tidying-findings-issue-triage.md`.

### Phase 3: Findings Report

Present ALL findings in one report, grouped by category, in the column shape each reference specifies. See Output Format below.

Four kinds sit outside the fixes table:
- **New-artifact recommendations** (from `docs-sync.md`) — a proposed context doc, skill, agent, `CLAUDE.md` section or reviewer rule. Advisory: create one only on explicit approval of that specific recommendation.
- **Affected vault docs** (from `public-interface.md`) — the vault docs that describe Taleform's model and that this branch's model change makes stale. Listed for the DM and carried into the PR body; **never edited from this repo** (`docs/sdlc.md` §3 → Vault docs).
- **Open questions** — anything an agent flagged as the DM's call rather than a fix: whether a parity diff is intended, the hoisting-vs-duplication question in `docs-hygiene.md`.
- **Triage verdicts** (Category M) — approved per issue: approve, amend a field, or reject. Never applied without approval.

Wait for the DM's approval before Phase 4.

### Phase 4: Apply Fixes

Apply approved fixes in this order: A, B, C+D, E, F, G, I, L, then the doc categories H, J, K, then M. The load-bearing constraints:
- **B before C+D** — deleting a scaffolding test can empty a file or `describe` the consolidation audit wanted to merge into or from.
- **G against every code fix.** A fix from I or L that adds or renames a frontmatter property, changes an emitted string or a `nid(...)` input, or touches a CLI flag is itself a Category G change: check it against `public-interface.md` before applying, and add its `RETIRED` entry or idempotency test in the same edit.
- **H before J** — do not tighten prose that is about to be rewritten for accuracy.
- **M last** — apply approved triage verdicts after every other category, as their own commit.

After all edits:
1. Run the affected test files: `npx vitest run <file>`.
2. Fix any failure the cleanup caused — a moved export a test imports, a fixture a deleted helper built.
3. Re-run until green.

This inner loop catches breakage close to the change, before the full check in Phase 5.

**Doc and plan categories (H, J, K):** instruction/doc/skill changes are a SEPARATE commit from the code, prefixed for what they carry (`docs/sdlc.md` §3 → Branch and commit types): `ai:` for skills, agents and instruction docs, `docs:` for `README.md` and `docs/`, `mapping:` for plan artifacts. Never stage a TDD plan — those stay untracked; every other planning artifact under `docs/` is committed. These need no test run, but if a doc states a command, verify the command still works before committing.

### Phase 5: Full Check

Run the COMPLETE check — not just the affected tests — and drive it to green. The branch must leave the repo at least as clean as `<parent>`: no new failures, warnings or errors. Redirect output to `.tmp/` and inspect only on failure.

1. **Check.**
   ```bash
   npm run check > .tmp/pr-tidying-check.txt 2>&1
   ```
   It stops at the first failing stage, so a red typecheck hides the test and bundle results: re-run after fixing.
   - **Typecheck (`tsc --noEmit`).** Fix the type. Never add `any`, `as unknown as`, a `@ts-ignore`/`@ts-expect-error`, or a non-null `!` to silence it, and never loosen `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`).
   - **Tests (`vitest run`).** A failure is fixed in the code or the test, whichever is wrong — never by weakening an assertion on generated output to make it pass.
   - **Bundle (esbuild).** Any warning esbuild prints for the branch's code is in scope.

2. **Parity** (any branch touching `src/`). `npm run check` has rebuilt `dist/`, so re-run:
   ```bash
   node dist/cli.cjs check --vault "<vault>" > .tmp/pr-tidying-parity.txt 2>&1
   ```
   Expect "up to date" with the one known warning `CLAUDE.md` § The vault names. Any other diff or problem is output this branch changed: confirm it is intended (it was reported under G in Phase 3) or fix it. **Never run `build` against the vault from this pass.**

3. **Triage every failure, warning, and error.** For each one, classify it:
   - **Introduced by this branch** (either the feature work or the Phase 4 cleanup) → fix it. This includes test failures, new type errors, Vitest console noise or unhandled-rejection warnings from code this branch added, deprecation notices from APIs this branch started using, and new parity diffs.
   - **Pre-existing on `<parent>`** → do NOT fix. Out of scope. Note it in the final report so the DM knows it was observed and deliberately left alone.

   To decide, compare against the diff (`<parent>..HEAD`): if the failing code path or the test exercising it was added or modified by this branch, it is in scope. When genuinely ambiguous, ask the DM rather than guessing.

4. **Re-run the check and the parity check until green**, with no branch-introduced warnings or errors remaining. Re-run after each batch of fixes, not after every single edit.

5. **Report the final state:** tests passing, every warning/error fixed (with cause), the parity result (with every intended diff named), any pre-existing failures left untouched (with the reason they are out of scope), and the affected-vault-docs list for the PR body.

## Output Format

One markdown table per category, in the column shape that category's reference specifies. Lead with a coverage line so a skipped or re-run audit is visible rather than inferred:

```
**Audits run:** A B C+D E F G H I J K L — C+D skipped (no test changes), B re-dispatched (empty findings file)

### A. Imports & Runner Boundaries

| # | File | Line | Import | Action |
|---|------|------|--------|--------|
| A1 | `src/core/story.ts` | 3 | `import { Notice } from "obsidian"` | Move the notice to `src/plugin/main.ts`; core reports through `ctx.problem` |

### G. Public Interface & Generated-Output Stability

| # | Surface | Location | Change | Action |
|---|---------|----------|--------|--------|
| G1 | Frontmatter | `src/builders/schema.ts:18` | `xp` renamed to `awards.xp`; no `RETIRED` entry | Add `xp: "awards (a list of {xp, for, …})"` |

### H. Instruction & Context Doc Sync

| # | Artifact | Line | Issue | Action |
|---|----------|------|-------|--------|
| H1 | `README.md` | 34 (builder table) | Branch adds an `arc-map` builder — no row | Add row in `BUILDERS` order |

...
```

After the tables, state the total count and ask: "Ready to apply all N fixes?"

Then, separately, present any new-artifact recommendations (advisory — not part of the N fixes):

```
### Artifact Recommendations (advisory — approve individually)

| # | Create | Where | Motivating evidence (this branch) | Sketch |
|---|--------|-------|-----------------------------------|--------|
| R1 | Context doc: Adventure Map layout & node-ID rules | a new doc under `docs/context/` (cited from `CLAUDE.md`) | Which `nid(...)` inputs are stable across builds had to be reconstructed from `src/builders/adventureMap.ts` during this branch | Inputs per node kind; what churns a map |
```

Ask which recommendations, if any, to create now. Then list the affected vault docs, and any open questions the agents raised.

## Constraints

The shared floor for the orchestrator and every dispatched agent; each reference restates the ones it needs.

- Only flag issues in files changed by this branch (in the `git diff --stat` output).
- Only flag issues in NEW code added by this branch, not pre-existing code (check the diff, not just the current file).
- Exception: pre-existing tests in a target file that break after merging (Category D) should be fixed as part of the merge.
- **Exception (G at a landing point):** the public-interface audit reads the whole segment, `<segment base>..HEAD`.
- **Exception (H, J, K):** the doc and plan audits look beyond the branch's changed files — the artifact being updated usually is NOT in the diff. Each reference states its own widened read-set; stay inside it. New artifacts are recommend-only, on per-item approval.
- Never edit the live vault, its notes, its hooks or its docs. Vault docs are listed for the DM, never edited.
- Do not flag borderline cases. Only clear-cut issues where the fix is unambiguous (Category-H new-artifact *recommendations* may be more exploratory, but must cite concrete branch evidence).
- Do not expand scope beyond the eleven audits above and Category M. A finding outside all of them is filed with `issue-creating`, not fixed here.
