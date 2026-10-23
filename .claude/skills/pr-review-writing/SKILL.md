---
name: pr-review-writing
description: Write the Markdown PR body for a Taleform branch — diffs the branch against its parent (`main`, or the branch below it in a stack), then states what the branch introduces, where review judgment is needed, the vault-parity result, the invariants, and any schema / CLI / vault-doc impact. Use when asked to write a PR description, PR body, or PR comment for GitHub.
---

# PR Body Writer

## Overview

Write the **Markdown PR body** for a branch, to be posted on GitHub. The audience is a
reviewer (usually the DM) who is about to read the diff cold: the body's job is to give them
the map before the territory — what the branch introduces and why, what it does to the
generated output and the vault, and where to spend their attention so they can leave
*helpful* review comments instead of re-deriving the branch's intent from scratch.

This is **not** a review. It does not pass judgment, approve, or reject. It surfaces the
changes and orients the reviewer. (`/pr-tidying` audits a branch for slop before the PR;
`pr-comment-addressing` handles the review that follows. This skill writes the body in
between.)

## Workflow

### Phase 1: Reconnaissance — read the diff, then the code

The body must be grounded in the *actual* diff, never in assumptions. Diff against the
branch's **parent**: `main` for a standalone branch, or the branch directly below it in a
stack (`docs/sdlc.md` §3, Stacked PRs). The PR's base is that same parent; name it if it is
not `main`.

1. **Enumerate the branch.** Capture the shape of the change:
   - `git log --oneline <parent>..HEAD` — the commit narrative.
   - `git diff --stat <parent>..HEAD` — every changed file with churn counts.
   - `git merge-base <parent> HEAD` — confirm the fork point, so the diff isn't polluted by
     commits the parent gained after the branch was cut.
2. **Read the diff.** Redirect large output to a scratch file and read it there.
   **On a very large branch**, sample instead: read the `--stat` and commit log to find the
   load-bearing files (the spine from step 5), read those in full, and skim the rest by diff
   header. The body is a *curated* map, not a line-by-line recital.
3. **Read the code the diff touches, not just the diff.** A diff shows *what changed*; the
   surrounding file shows *what it means*. Open the changed core modules, builders and tests.
4. **Identify the affected layers.** Map changed files to `src/core/` (index, story rules,
   engine, regions, canvas), `src/builders/` (and whether `BUILDERS` order changed),
   `src/cli/main.ts`, `src/plugin/main.ts`, and `test/`. Consult `CLAUDE.md` and any
   `.claude/context/` doc for the area so the narrative matches the documented model.
5. **Trace the load-bearing change.** Every branch has a spine — the one domain rule, builder
   or schema property the rest hangs off. Find it; the body leads the reviewer to it first.
6. **Run the checks the body reports.** `npm run check`, then the read-only parity check
   against the live vault: `node dist/cli.cjs check --vault "<vault>"` (`CLAUDE.md` § The
   vault has the path and the one known warning). Never `build` against the vault for a PR.

### Phase 2: Write the body

Use this shape. Omit a section only where the "omit when" note says so.

1. **What this introduces** — 2–4 sentences. What the branch adds and why, as a finished
   thing. In a stack, one line placing it: which slice it is, and what sits below it.
2. **The load-bearing changes** — grouped by behaviour, not by file. What a reviewer needs to
   hold in their head to read the diff. Name the primary files; use a short fenced snippet
   only where a few lines say it better than a sentence.
3. **Generated output & vault parity** — the result of the read-only parity check, verbatim
   in substance: "up to date, one known warning", or the list of files whose generated output
   changes and whether each change is intended. A `refactor:` branch with any parity diff is
   not a refactor — say so. If you did not run it, say that instead.
4. **Invariants** — one line each for the three checked on every PR (`docs/sdlc.md` §2):
   builders never write frontmatter; only generated text is touched; a rebuild is idempotent
   (name the test that asserts the second `build` reports 0 changes for the touched output).
   Add a line for any other `CLAUDE.md` § Invariants item the branch touches (the `RETIRED`
   map, pre-commit never blocking).
5. **Interface changes** — omit when none. Any change to:
   - **frontmatter schema**: new, renamed or retired properties, and the `RETIRED` entry in
     `src/builders/schema.ts` that names each replacement;
   - **CLI flags or the `--json` shape**: the vault's git `pre-commit` hook and
     `taleform-hook.mjs` call `dist/cli.cjs` directly, so state what they will see;
   - **generated-output stability**: anything that changes `nid()` inputs or region ids, which
     churns maps or orphans regions in existing notes.

   Mark a change that must reach the vault before the slice above can be built as a **vault
   gate** (`docs/sdlc.md` §3, Landing the stack).
6. **Affected vault docs** — omit when the model did not change. Name which of the vault docs
   that describe Taleform's model need updating (the story-maps spec, `run-sheet-format.md`,
   `_tpl/Story Beat.md`, the vault `CLAUDE.md` § Taleform) and what in each. They are listed
   for the DM, never edited from this repo.
7. **Where to focus review** — the 2–3 places judgment is genuinely required, each with a
   `file:line` anchor and framed as a concrete question, not a verdict.
8. **What it does not do / out of scope** — deferred work, and anything the branch
   deliberately leaves alone.
9. **Notes** — test status (`npm run check` result you observed), follow-ups, blocked items
   needing the DM.

End the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Phase 3: Self-verification gates

Before handing the body back, confirm each of these. A failed gate means revise, not ship.

- **Every claim traces to the diff.** Each behaviour, file and line reference is verifiable
  in `git diff <parent>..HEAD` or the current file. No invented properties, builders or flags.
- **Honest about checks.** `npm run check` and parity results reflect what you actually ran
  and observed. Never claim green you didn't see; untested paths are named, not glossed.
- **Interface changes are complete.** If the diff touches `schema.ts`, `src/cli/main.ts`'s
  flag parsing or `--json` output, `nid(...)` call arguments, or a region id, section 5 says
  so.
- **Focus section is specific.** Every item has a `file:line` anchor and a concrete question,
  not a generic "check for bugs."
- **Curated, not dumped.** The reviewer can read the full diff themselves — the body adds
  signal on top of it.
- **No verdict.** The body orients; it does not approve, reject, or grade.

## Writing Guidelines

- **Orient, don't editorialize.** State what changed and where the risk is; let the reviewer
  form the opinion. "`resumeBeat` now skips `skipped` beats when finding the furthest one
  touched" — good. "This is a great improvement" — cut it.
- **Faithful, not flattering.** If the branch leaves a path untested, mixes concerns, or
  changes generated output, say so plainly. The body's value is that a reviewer can trust it.
- **Group by behaviour, not by file.** Reviewers think in features; a file-by-file recital of
  the diff adds nothing they can't get from `git diff` themselves.
- **No deliberation in the output.** Remove exploration, "let me check…", and abandoned
  hypotheses — present resolved facts (mirrors the no-deliberation rule in `prd-writing` and
  `tdd-planning`).
- **Right altitude.** Keep it to what a reviewer needs before reading the diff. Push
  exhaustive per-file detail into a `<details>` block, not the main narrative.

### Describe the destination, not the journey

**A PR body states what the branch introduces as a whole, in its final form.** How it got
there is invisible to the reader and irrelevant to the review.

Do not organize the body around:

- the commit sequence, or a commit-by-commit table framed as iterations
- what was wrong earlier in the branch and later corrected
- rounds of feedback, revisions, or approach changes
- which parts were difficult, surprising, or took several attempts

The commit log already carries all of it, and `git log` is one click away. A reader opening the
PR is asking "what is this and can I trust it", not "how was it made".

**Corrections survive only as conclusions.** If the branch fixed a wrong claim, state the claim
that is now true and cite it; do not narrate that it was previously wrong, unless the prior state
is on `main` (and so has run against the vault) — in which case it is a behaviour change and
belongs in the load-bearing section on its own merits.

The same rule applies to the author's own process. Cut "verification pass", "swept N rows",
"I nearly flagged", "after several iterations", "originally this did X". First-person process
language is the reliable tell that the body is describing the work instead of the result.

## Output

Return the body as Markdown, ready to paste or pass to `gh pr create --body-file` /
`gh pr edit --body-file`. If it must be written to disk first, use the scratchpad, not the
repo — a PR body is never committed.

## References

- `pr-tidying` skill — the sibling branch-vs-parent pass that *cleans* the branch (slop,
  inefficiency, doc drift). Run it before opening the PR; run this to *explain* the PR.
- `docs/sdlc.md` — §2 (parity check, invariants), §3 (stacked PRs, landing points, vault
  gates, vault docs).
- `CLAUDE.md` — § Invariants, § The vault (parity command, known warning, vault-doc paths, the
  hooks that call the CLI).
