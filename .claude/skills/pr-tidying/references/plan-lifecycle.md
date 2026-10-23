# K. Plan & Artifact Lifecycle

**Findings file:** `.tmp/pr-tidying-findings-plan-lifecycle.md`
**ID prefix:** `K1`, `K2`, …
**Read-set:** `docs/features/**`, `docs/issues/**`, `docs/roadmap.md`, `.claude/agent-memory/**`, `docs/sdlc.md` §3 and §4e, and — for Pass 2 only — `.claude/skills/wayfinding/references/closing.md`. **You do not need the code diff.** You need two facts from the branch: which slice it ships, and whether it is the final branch of its stack. The orchestrator supplies both; ask if they are missing.

**Every HTML artifact is edited with `planr`, never by hand**, followed by `node .claude/skills/html-planning/planr.js check <file>` — the authoritative structure validation.

**Run `node .claude/skills/wayfinding/check-tooling.js` before auditing by reading.** Its `tddplans`, `issuedocs` and `memindex` checks assert this category's mechanical half — no TDD plan tracked, no issue doc carrying a status its lifecycle has no end state for, every `.claude/agent-memory/*/MEMORY.md` pointer resolving with no topic file beside one unindexed — and `W70` asserts every map slice badge agrees with the status of the spec it links. Its output IS those findings; the judgement passes below still apply. The checker registry itself lives in `.claude/skills/pr-tidying/references/docs-sync.md`.

**Pass 1 runs on every tidy. Pass 2 runs only on the final branch of a stack** — the close slice (`docs/sdlc.md` §3) — never early, or the cleanup scatters and gets redone.

## Pass 1 — every tidy

**Flip the slice statuses.** A sliced effort's spec headers drift, because the branch that builds a slice is not the branch that files it. Reconcile the specs against reality every pass: **any slice whose work has shipped gets `planr set <spec> header.status=implemented`**, and **its row in the map's `slices` table gets `planr badge <map> --match "<slice name>" --set decided --text "shipped"` in the same pass.**

- **Always pass `--text "shipped"`, never `--text ""`.** `shipped` is a label the `decided` type cannot express alone: `planr` refuses a bare `--set` on a badge already carrying it, and an empty `--text` clears it. `--text ""` is for clearing a label that has outlived its state (a ticket flipped out of `Claimed`).
- The shipped set is the branch's own slice — which ships when this PR merges — plus whatever earlier passes recorded.
- **This pass is the only thing that writes those badges**; no step in `wayfinding` does. A pass that reads them without writing them finds every slice `open`, always.
- Also flip any QA checklist the branch consumed to `implemented` — a doc whose body says `CONSUMED` and whose header says `draft` contradicts itself (`docs/sdlc.md` §4e).

**Drain the agent memory.** Agent memory is a staging area kept near-empty, and this pass is its primary drain — run at every PR, not only when an agent has visibly sprawled. Invoke `agent-memory-compacting` whenever any agent under `.claude/agent-memory/<agent>/` holds more than a thin index: loose topic files, relocation-hook `*.drift.md` copies, or a `MEMORY.md` grown past pointers plus a few load-bearing facts. Its **graduate-or-drop** gate drops point-in-time facts, promotes durable reference facts to `.claude/context/` or `CLAUDE.md` and durable behavioral judgment to the agent's own definition or skill, and keeps only judgment not yet stable enough to codify. Present its plan and apply after approval; promotions to shared artifacts need per-item approval. No `.claude/agent-memory/` directory → nothing to drain; say so.

## Pass 2 — stack-close, final branch only

This branch owns the effort's planning wind-down. **The bullets are in dependency order — every check precedes the deletion it gates. Do them as written.**

- **Confirm the effort's key details survive in `.claude/context/` or `CLAUDE.md` — before anything is deleted.** If a wayfinding effort is closing, `.claude/skills/wayfinding/references/closing.md` owns this check: run it there and **stop if anything is ungraduated**. Otherwise walk the PRD's cross-cutting contract and the slice specs by hand — every load-bearing invariant, derivation rule, schema decision and gotcha must be findable without opening the planning artifacts.
- **Reconcile what shipped against what was decided.** Any decision the implementation overturned, deferred, or found wrong is reflected in the context docs the effort wrote. **The map is disposable; the context doc is not.**
- **Confirm the affected vault docs are listed for the whole stack**, not just this slice — the close slice carries that list into the landing PR (`docs/sdlc.md` §3). Category G produces it at a landing point; if this branch is the close slice and G's list is missing or slice-only, report it.
- **Retire the mapping and planning material.** Flip the status headers of the PRD, its slice specs and any QA checklists, then `git rm` them per `docs/sdlc.md` §4e. **Every fate is deletion** — nothing is moved anywhere. **Delete with `git rm`, never a plain `rm`**, and confirm with `git status` that the deletion is staged rather than showing as an untracked file disappearing.
- **Wayfinding artifacts are deleted, not filed** — and only once the graduation check above has passed. Follow `closing.md` for the delete order; skip if no wayfinding effort is closing.
- **Close out the issue docs the effort filed.** Any issue the branches actually fixed is **deleted, not filed** (`issue-creating`'s rule) — an issue doc has no `implemented` end state. The rest stay open and stay committed.
- **Update the roadmap** in `docs/roadmap.md`: the effort's register row and any scoped follow-ups it recorded.

## What NOT to flag/do

- Editing a TDD plan. **Only TDD plans stay untracked** — wayfinding maps, PRDs, slice specs, QA checklists and issue docs are committed artifacts and are in scope above.
- A slice whose work has NOT shipped. `approved` is correct for planned-but-unbuilt; flipping it is worse than leaving it.
- Cosmetic edits to a plan's body. This audit changes statuses, badges and file presence — not content.
- Pass 2 on a non-final branch. If you cannot establish the branch's position in its stack, report that and stop rather than guessing.

## Report shape

| # | Artifact | Current | Issue | Action |
|---|----------|---------|-------|--------|
| K1 | `docs/features/<effort>/spec-slice-3.html` | `header.status=approved` | Slice 3 ships with this branch | `planr set … header.status=implemented` |
| K2 | `docs/features/<effort>/wayfinding/map.html` | slices row 3 badge `open` | Same slice, other half of the record | `planr badge … --set decided --text "shipped"` |
| K3 | `.claude/agent-memory/tdd-planner/` | 6 loose topic files | Past a thin index | Invoke `agent-memory-compacting`; promotions need per-item approval |

**K1 and K2 are always a pair.** Shipped-ness is recorded in two artifacts; `W70` joins them, but only after both are written. Report both rows or neither.
