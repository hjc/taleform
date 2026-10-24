# H. Instruction & Context Doc Sync

**Findings file:** `.tmp/pr-tidying-findings-docs-sync.md`
**ID prefix:** `H1`, `H2`, …
**Read-set:** the FULL branch diff (`src/`, `test/`, config) AND the commit history for how the branch was implemented — you are auditing documentation against reality and need both sides. Then the artifacts: root `CLAUDE.md`, `CLAUDE.local.md` if present, `README.md`, `docs/sdlc.md`, `docs/context/*.md` for the branch's domain, and any `.claude/skills/*/SKILL.md` or `.claude/agents/*.md` the branch's subject touches.

Your question is only: **is what this doc says still true, and is what this branch learned written down anywhere.**

**Sibling audits — do not do their work.** Prose quality (render chrome, `description` bloat, verbosity) is Category J. Anything under `docs/features/`, `docs/issues/` or `docs/roadmap.md`, or `.claude/agent-memory/` is Category K. The vault docs that describe Taleform's model are Category G's list, never an edit. A doc that is accurate but bloated is J's finding; note a factual error you spot in a plan as an H cross-reference rather than editing it.

## Run the surface's own checker before auditing it by reading

Where a surface ships an executable consistency check, that check is authoritative and **its output IS the finding list**. Auditing prose by reading has no fixed point — every fix writes new prose for the next audit to flag. A checker terminates because it asserts against behaviour, not wording.

| Surface | Checker |
|---|---|
| **Wayfinding tooling**: the wayfinding skill, its templates, maps and the commands and decision ids it cites (detail after the table) | `node .claude/skills/wayfinding/check-tooling.js` (the `W*` checks, `cmds`, `paths`) |
| **Cited paths**: every repo-rooted path, split-skill citation and `see … below/above` pointer in the instruction docs (detail after the table) | `node .claude/skills/wayfinding/check-tooling.js` (checks `instrpaths`, `refcite`, `anchors`) |
| **Artifact lifecycle**: the rules `docs/sdlc.md` §4e and `issue-creating` state (detail after the table) | `node .claude/skills/wayfinding/check-tooling.js` (checks `tddplans`, `tddcites`, `issuedocs`, `issuemeta`, `memindex`) |
| The three AI-infrastructure inventories in `docs/sdlc.md`, joined to the tree in BOTH directions — §4b against `.claude/agents/*.md`, §4c against the directories under `.claude/skills/`, §4d against `docs/context/*.md`. A file with no row and a row with no file are both reported | `node .claude/skills/wayfinding/check-tooling.js` (check `sdlcinv`) |
| Any HTML under `docs/features/` or `docs/issues/` | `node .claude/skills/html-planning/planr.js check <file>` |

**Wayfinding tooling** covers:

- `.claude/skills/wayfinding/**`, the five `wayfinding-*` templates, `references/closing.md`;
- the template inventory across `html-planning`, `.claude/planr-templates/` and `docs/sdlc.md`;
- each `map.html` under `docs/features/*/wayfinding/`, joined to the slice specs its `slices` table links;
- every `planr` command quoted in a wayfinding `SKILL.md`;
- every code-wrapped decision id (`D37`, `q08`) cited by a tracked doc that survives an effort close, checked against the vocabulary the live efforts still define.

**Cited paths** covers:

- every repo-rooted path cited by root `CLAUDE.md`, `docs/sdlc.md`, a `docs/context/*.md`, **any `.claude/skills/**/*.md`, any `.claude/agents/*.md`**, or any `.claude/agent-memory/**/*.md`;
- every tracked citation of a `SKILL.md` belonging to a skill that has split its rules into `references/`, joined to the file that now holds the rule;
- every `see … below/above` pointer inside root `CLAUDE.md`, `docs/sdlc.md` and the context docs.
- Citations under `docs/features/` and `docs/issues/` are deliberately out of scope. A plan is branch-local, so enforcing them reports correct citations as defects.

**Artifact lifecycle** covers:

- no TDD plan under `docs/features/` is tracked;
- no tracked doc CITES one, since a never-tracked plan's path dies at branch close;
- no issue doc under `docs/issues/` carries the `implemented` status it has no end state for;
- every issue doc obeys the `issue-triaging` field rules (`scripts/review.py check`);
- every `.claude/agent-memory/*/MEMORY.md` pointer resolves, and no topic file beside one is unindexed.

A green checker settles only the mechanical half — contradictions between copies of a rule, dangling paths, commands that no longer run. The judgement findings below still apply. But **a finding the checker could have made and did not is a checker gap, not an audit finding**: extend the checker rather than hand-fixing the prose and leaving the next branch to rediscover it.

**A skill shipping an executable checker adds its row above in the same commit as the checker.** The table is the registry; an unregistered checker is never run by this pass, and the omission is invisible because everything still passes.

## What to flag for UPDATE (apply after approval)

- **SDLC inventory drift (`docs/sdlc.md`).** `docs/sdlc.md` is the canonical catalog of the repo's AI infrastructure. **The inventory half is mechanical and is the `sdlcinv` checker's output, not a reading pass** — if it misses one, that is a checker gap (extend it). What the checker cannot read is left to this pass: whether a row's DESCRIPTION still fits the artifact after a rename or a change of purpose, and whether §4's loop description is still accurate (a new step, a new reviewer, a renamed agent/skill it names).
- **Stale documentation:** `CLAUDE.md`, `README.md`, a skill or a context doc describes a builder, run order, command, CLI flag, frontmatter property, file location or convention the branch changed. The ones that drift most:
  - `README.md` § The typed model (property table) and § Builders (run order) against `src/builders/schema.ts` and `BUILDERS` in `src/builders/index.ts`;
  - `CLAUDE.md` § Architecture — the module-by-module notes and the run order line;
  - `CLAUDE.md` § Commands against `USAGE` in `src/cli/main.ts` and the `package.json` scripts;
  - `CLAUDE.md` § The vault — the parity expectation (the known warning) when this branch changes it.
- **Inconsistencies:** the same instruction duplicated with diverging wording, two artifacts contradicting each other, or a section verbatim-duplicated within one artifact. **On a surface with a checker, this bullet is the checker's output, not a re-read.**
- **Known gaps the branch relied on or revealed:** a non-obvious derivation rule, an invariant, an Obsidian behaviour, or a multi-step workflow the branch depended on — or had to rediscover — that no artifact records. Add it to the most relevant existing artifact. An Obsidian behaviour this branch tested goes in `CLAUDE.md` § Obsidian facts we tested; a new rule a build must keep goes in § Invariants.
- **New facts worth persisting:** a reusable pattern, a load-bearing constraint, or a footgun the branch introduced that future work must respect.

## What to RECOMMEND (advisory — never auto-create)

Each recommendation must cite concrete branch evidence — a file, a rediscovered fact, a friction point — not a generic "might be nice".

- A **new context doc** when the branch surfaces reference knowledge too large for `CLAUDE.md`, especially knowledge reconstructed during this branch. `docs/sdlc.md` §4d lists the expected candidates: the story model's derivation rules, the canvas layout and node-ID stability rules behind the Adventure Map, the Bases API facts.
- A **new skill** when the implementation followed a repeatable multi-step workflow that isn't yet codified.
- A **new agent** when the branch revealed a recurring review/analysis role no existing agent covers.
- A **new `CLAUDE.md` section** when a class of mistakes showed up that a short rule would prevent.
- A **reviewer rule** when this branch fixes a bug whose root cause a plan reviewer *could* have caught. Name the reviewer agents for the touched area (`docs/sdlc.md` §4b), the rule to add, and the class of bug it catches next time. The bar is a **generalizable gotcha or a clear reviewer oversight** — not an itemization of every bug fixed. Skip it when the root cause was branch-local, or when an existing rule already covers it.

## What NOT to flag/do

- Cosmetic rewording of artifacts the branch did not affect. Stay anchored to what THIS branch changed or revealed.
- Transient details (this PR's specific bug, one-off debugging steps) — those belong in the PR description.
- Auto-creating a skill/agent/doc without explicit per-item approval.
- Speculative future-proofing ("a skill for X someday") with no evidence in this branch.
- Anything under `docs/features/`, `docs/issues/` or `docs/roadmap.md`, or `.claude/agent-memory/` — Category K.
- Prose that is accurate but overlong, or a bloated frontmatter `description` — Category J.
- Any doc inside the live vault — Category G lists those for the DM.

## Report shape

Two blocks, kept separate.

**Updates** (applied after approval, like any other category):

| # | Artifact | Line | Issue | Action |
|---|----------|------|-------|--------|
| H1 | `README.md` | 34 (builder table) | Branch adds a builder to `BUILDERS` — no row | Add row in run order |
| H2 | `docs/sdlc.md` | 229 (skill table) | Branch adds a skill — `sdlcinv` reports it | Add row |
| H3 | `CLAUDE.md` | § Obsidian facts | Branch relies on canvas keeping a new node key on save, tested here | Add the fact |

**Recommendations** (advisory):

| # | Create | Where | Motivating evidence (this branch) | Sketch |
|---|--------|-------|-----------------------------------|--------|
| R1 | Context doc: story derivation rules | a new doc under `docs/context/` (cited from `CLAUDE.md`) | How `resumeBeat` and running totals interact had to be reconstructed from `src/core/story.ts` | Rule per derived value; what it reads |
