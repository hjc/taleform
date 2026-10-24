# SDLC & AI Infrastructure

This document describes how Taleform is built, delivered and developed:

1. Where Taleform runs, and the vault that consumes it.
2. Build and delivery: from `npm run check` to a reloaded plugin.
3. The SDLC process: how code moves from a feature branch to `main`.
4. The AI tooling in this repository, and how LLM-driven development uses it.

**Day-to-day workflow, in brief:** draft a PRD with the orchestrating session and get a human to approve it. Then, per slice, the `tdd-planner` agent writes a TDD plan in HTML; reviewers correct it, and the plan is executed only once approved. Review the built branch, run `/pr-tidying` against its parent, and open the slice's PR on the stack. The stack lands on `main` as a whole. §4 has the detail.

---

## 1. Where Taleform runs

Taleform is one TypeScript core with two runners. Neither runs in the cloud; there are no deployed environments, and nothing is served.

| Runner | Artifact | Entry point | Who calls it |
|---|---|---|---|
| **Obsidian plugin** | `dist/main.js` + `manifest.json` | `src/plugin/main.ts` | The DM, through commands and the 1500 ms auto-build; scripts, through `app.plugins.plugins.taleform.run(...)` |
| **Headless CLI** | `dist/cli.cjs` | `src/cli/main.ts` | The DM at a terminal; the vault's git `pre-commit` hook; the vault's Claude `PostToolUse` hook (`.claude/scripts/taleform-hook.mjs`) |

**The live vault is the only production.** It is `<vault>`, git-tracked, with its own `CLAUDE.md` and commit rules. Its notes are the DM's, and they are never edited from this repo's sessions unless the DM asks (`CLAUDE.md` § The vault).

Two consequences shape everything below:

- **The CLI's flags and its `--json` shape are a public interface.** The vault's hooks call `<repo>/dist/cli.cjs` directly (override with `TALEFORM_CLI`). A rebuilt `dist/` changes their behaviour the moment it is written, with no deploy step.
- **Frontmatter is a public interface too.** A renamed or retired property breaks the DM's notes, and potentially another DM's. The schema names the replacement for every retired property (`RETIRED` in `src/builders/schema.ts`); support is never dropped silently.

**Distribution is a goal, not yet a pipeline.** Another DM may adopt Taleform, so `src/` carries no vault-specific names or paths. There is no community-plugin release yet (no `versions.json`, no GitHub release workflow). When one is set up, it is described here.

---

## 2. Build & delivery

```
npm run check ──▶ dist/ ──▶ npm run deploy -- "<vault>" ──▶ reload the plugin in Obsidian
   │                │
   │                └─ dist/cli.cjs is live for the vault hooks as soon as it is written
   └─ typecheck (tsc) + vitest + esbuild bundle
```

### Check

`npm run check` runs `tsc --noEmit`, then `vitest run`, then the esbuild bundle. **Nothing is done until it passes.** Tests live in `test/*.test.ts`. Builder tests go through `build()` on fixture vaults held in `test/memoryVault.ts`, an in-memory `VaultIO`.

### Parity against the live vault

After any builder change, run the check against the real vault:

```
node dist/cli.cjs check --vault "<vault>"
```

Expect "up to date" with one known warning (3.03's Encounter line; see `CLAUDE.md`). **Any other diff means the change altered generated output.** Decide whether that is intended before running `build`, and say so in the PR. This is the closest thing Taleform has to a staging environment: real content, read-only.

### Deploy

`npm run deploy -- "<vault>"` copies `dist/main.js` and `manifest.json` into `<vault>/.obsidian/plugins/taleform`. Then reload the plugin in the running Obsidian through the vault's CLI client (`CLAUDE.md` § The vault has the command). An async eval returns empty output on success, so verify by reading state back.

**Deploy is a merge-time act, not a branch-time one.** A feature branch is validated by `npm run check` and the read-only parity check. It is deployed to the vault only once it lands on `main`, or when the DM asks to try a branch in Obsidian.

### Invariants every build must keep

`CLAUDE.md` § Invariants holds the full list. Three of them are checked on every PR, because they are the ones a regression breaks silently:

- **Builders never write frontmatter.**
- **Only generated text is touched**: region markers, the sequence header and `## Next` footer, and canvas items carrying `"generated": "adventure-map"`.
- **A rebuild is idempotent.** A second `build` reports 0 changes, and `check` on a freshly built vault exits 0.

---

## 3. Branch & promotion flow

```
feature branch ──PR──▶ main ──▶ npm run deploy -- "<vault>"
```

1. **Feature branch.** All work happens on a branch off `main`, or off the branch below it in a stack.
2. **Pull request → `main`.** `/pr-tidying` compares a branch against its parent: `main` for a standalone branch, or the branch below it in a stack.
3. **Deploy.** Once merged, `main` is built and deployed to the vault (§2).

### Branch and commit types

A branch is `<github-handle>/<type>--<slug>` (for example, `hjc/feat--arc-map`). The prefix is the author's GitHub handle, not their initials.

**The branch type names the branch's *primary* work. Each commit takes the prefix matching what that commit actually does.** They usually agree, but they don't have to:

- A branch may carry a mixed set when its work spans types. An `ai--` branch that migrates an in-flight effort's planning artifacts carries `mapping:` commits for exactly that.
- Any branch may carry an `issue:` commit.
- What is not allowed is a commit whose prefix misdescribes its own contents.

| Branch | Commit | Carries |
|---|---|---|
| `feat--` | `feat:` | A capability the DM can use: a builder, a schema property, a command, a CLI flag |
| `fix--` | `fix:` | A bug fix |
| `refactor--` | `refactor:` | Restructuring with no change to generated output |
| `tests--` | `tests:` | Test-only work |
| `docs--` | `docs:` | Documentation |
| `chore--` | `chore:` | Dependencies, config, housekeeping |
| `ai--` | `ai:` | Local AI infrastructure: skills, agents, commands, instruction docs |
| `map--` | `mapping:` | Mapping and planning that comes before code: wayfinding maps, their tickets and registers, PRDs, slice specs, issue filings, roadmap entries |
| *(none)* | `issue:` | One issue doc filed under `docs/issues/`, committed on whatever branch is in hand |

`map--` pairs with `mapping:`. The two names differ on purpose; do not "correct" either to match the other.

`issue:` is commit-only. Issue docs are filed where they are found, so they have no branch type of their own.

A `refactor:` that changes what a build writes to the vault is not a refactor. The read-only parity check (§2) is how you tell.

### Stacked PRs

**For an effort too large for one branch, prefer a stack of branches over one long-lived branch.** Each PR targets the branch below it rather than `main`, so each stays small enough to review on its own merits.

**Order the stack like this:**

1. **Local AI improvements** related to the effort: skills, agents or instruction changes the rest of the work will lean on (`ai--`).
2. **Planning and mapping**: the wayfinding map, PRD or slice specs that decide what gets built (`map--`).
3. **Code**, sliced in **dependency order**, so the branch that must exist first sits lowest. Core (`src/core/`) and schema changes come before the builders that consume them, and builders before the plugin or CLI surface that exposes them.

Planning branches come first because everything above them derives from their output.

**The last slice of a sliced effort is the close slice, and it is the final branch of the stack.** It wraps up loose ends and carries the deferred nice-to-haves, the mapping and planning tidy-up, the check that the effort's key details reached `docs/context/`, and the list of vault docs the change affects (§3, "Vault docs"). Run `/pr-tidying` there; Category K covers it. Never scatter that cleanup across the stack.

### Landing the stack

**A stack exists for review, not for incremental landing.** Each branch is reviewed on its own PR, but no branch lands on `main` when it finishes. The stack lands as a whole, at the end.

**A vault gate is the one exception.** A vault-gating slice is one whose output must reach the live vault before the slices above it can be built or validated. Examples:

- a schema rename the DM migrates their notes off before the next slice reads the new property;
- a change to the CLI's flags or `--json` shape that the vault's hooks must be updated to read;
- a builder whose generated output the next slice is designed against, and which therefore has to be seen in Obsidian first.

A gate splits the stack into **segments**. Everything from the previous gate (or the bottom of the stack) up to and including the gating slice lands together. The next segment then builds on the deployed `main`. A stack with no gate is one segment, landed from the close slice; a stack with two gates is three segments.

What follows from it:

- **The top branch of a segment is a landing point**: the close slice, or a vault-gating slice. Mark a gating slice as such in the PRD's slice list, so its tidy knows to run the segment-wide passes.
- **To land a segment, retarget the landing point's PR to `main` and merge it with a merge commit**, never a squash, so each slice's history survives. Then close the lower PRs in the segment with a comment linking the landing PR.
- **A lower branch's own PR is never merged on its own.** If it reached `main` mid-segment, the DM's vault would run a half-built feature through its hooks.
- **Before merging a landing point:** `npm run check` passes on the top branch, the read-only parity check is clean or every diff is explained in the PR, and the vault docs the segment affects are listed for the DM.
- **After merging:** deploy (§2), and run `build` against the vault only if the PR said the output changes and the DM agreed.

### Vault docs

Some vault docs describe Taleform's model: the story-maps spec, `run-sheet-format.md`, `_tpl/Story Beat.md` and the vault `CLAUDE.md` § Taleform (`CLAUDE.md` § The vault has the paths). **When the model changes, the PR names which of them are affected.** They are not edited from this repo; the DM updates them.

### Commit as you go

Some artifacts are expensive to reconstruct and easy to lose:

- **While wayfinding, commit after resolving a ticket and after any material change to the map.** Never let a session end with map progress uncommitted.
- **Commit issue docs and roadmap entries as you file them**, on whatever branch is in hand. Matching a finding to its "correct" branch is worth nothing next to not losing it. Issue docs live in `docs/issues/`. Roadmap entries (the PRD register, its dependency graph and an effort's scoped follow-ups) live in `docs/roadmap.md`.

---

## 4. AI Infrastructure

There are four kinds of AI artifact in the repository:

- **Harness instructions** describe the codebase.
- **Agents** describe *what* to do.
- **Skills** describe *how* to do it.
- **Context docs** capture hard-won facts about tricky areas of the code.

The development loop below ties them together. The subsections after it describe each kind in turn.

### The core development loop

This is the baseline workflow for building a feature, fix or refactor. A human (the DM) drives it through an orchestrating session. The orchestrator does reconnaissance and gathers requirements, then routes the actual work to specialized agents.

0. **Wayfind.** *Large efforts only, and **user-invoked**: the skill is `disable-model-invocation: true`, so an orchestrating session asks for `/wayfinding` rather than running it.*
   - It charts the open decisions under `docs/features/<feature>/wayfinding/`. That means a map holding pointers and status; three registers holding what grows (`decisions.html`, `vocabulary.html`, `evidence.html`); and one ticket per question whose answer is a decision, not a slice of the build.
   - Anything not yet worth a ticket sits in the map's `horizon` section, and becomes a ticket when it is ready to decide.
   - Tickets resolve one per session. Each graduates its decision into `docs/context/` as it lands, not at map close.
   - Its last act is a **slicing**: how the effort splits into shippable branches in dependency order. It is coverage-checked, so every ticket lands in exactly one slice or is marked *no build work*. The last slice is the **close slice** (§3).

   Reach for it when "Discuss" would sprawl across sessions or the shape is still unclear. Skip it for anything one session can settle. It composes `grilling` and `domain-modeling` (§4c). What happens to its artifacts at the end is covered in §4e.
1. **Discuss.** Talk through the change with the orchestrating session until you agree on an approach; no code is written yet. Two skills help:
   - `grilling` stress-tests the approach, one question at a time.
   - `domain-modeling` fixes the vocabulary before it gets spent in a plan. It binds each term to an existing type, builder, frontmatter property or context doc, or marks it new. Story terms (mission, beat, Adventure, Arc, Campaign) are especially prone to drift.
2. **Draft the PRD.** The `prd-writing` skill produces the product specification.
   - For an effort that came off a map, it has two tiers. The **PRD** carries the cross-cutting contract (the rules, invariants and vocabulary every slice must obey) plus the **slice list** in dependency order, with vault gates marked. Each slice then gets a **thin spec** that cites those shared rules rather than restating them. A slice spec can be written months after the PRD without reopening it. Duplicating a shared rule across slices is the drift this structure exists to prevent.
   - Small efforts write one standalone PRD.
   - A single-branch fix may skip straight to Plan.
3. **Human approval of the PRD.** The DM reads the PRD (and slice specs) and approves it. **This gate is unconditional**; unlike the TDD-plan gate in step 6, nothing may suspend it. A PRD decides what gets built and what the frontmatter looks like, so a schema mistake is cheapest to catch here (`CLAUDE.md` § Working style).
4. **Plan each slice.** The orchestrator dispatches the `tdd-planner` agent once per slice. It researches the codebase and writes a TDD implementation plan as HTML under `docs/features/<feature>/tdds/`, using the `tdd-planning` and `html-planning` skills.
   - The correspondence is **one slice ↔ one branch ↔ one TDD plan ↔ one PR**.
   - The planner reads the PRD alongside the slice spec, because the spec deliberately leaves out the shared contract.
5. **Review the plans.** Every plan goes to two reviewers in parallel, which correct it before a human sees it. **PRDs and slice specs get the same pass**, since an architectural mistake is far cheaper to catch there.
   - `taleform-reviewer` asks whether the plan conforms: `CLAUDE.md` § Invariants, `src/core/` free of Obsidian imports, nothing in `src/` naming the DM's vault, the builder and test conventions.
   - `taleform-abstraction-spotter` (`plan` mode) asks whether conforming is the right answer here: the plan that follows every pattern and is still architecturally wrong.
   - Findings route by **blast radius**. A change confined to the slice's own new code is an amendment to the plan. A change to a shared signature, to the frontmatter schema, or to the CLI's public interface becomes a proposed amendment to the PRD's cross-cutting contract, and goes back to the step-3 gate.
6. **Human review of the plans, and iterate.** The DM opens the HTML plan in the browser and reviews it, with full context and design decisions laid out, before any code exists. Anything that doesn't feel right goes back to the writer, and the revision is reviewed again. **A plan is never executed until it is approved.**
7. **Build.** The orchestrator dispatches `tdd-executor` to build the approved plan in red-green-refactor style, through `npm run check`. **If the build contradicts a decision the PRD or map settled, amend that document** with what replaced it and why; never diverge silently.
   - **Review pass on the build.** Once the build is committed, the orchestrator dispatches `taleform-reviewer` (conformance) and `taleform-abstraction-spotter` (`diff` mode) in parallel against the slice's parent branch. `tdd-executor` applies their in-slice findings as one `refactor:` commit each; a contract-level finding goes to the step-3 gate.
8. **Review the branch.** Once the slice's build is committed, review the diff against the slice's parent branch:
   - `npm run check` passes;
   - the read-only parity check against the live vault (§2) is clean, or every diff is intended;
   - a second `build` against a fixture reports 0 changes;
   - the invariants hold.

   Fixes land as their own commits. Then run `/pr-tidying` against the parent branch. It removes AI slop, fixes obviously bad algorithms, keeps the test suite fast and keeps the context docs fresh. Its Category M triages the issues the branch filed.
9. **Ship the stacked PR.** Push the branch and open its PR against the branch below it.
   - `pr-review-writing` writes the Markdown PR body.
   - `pr-comment-addressing` pulls review comments back off GitHub, applies them as one themed work list across the stack, and replies to each thread with the fixing commit. Resolving a thread is the reviewer's call, not the skill's.
   - At a landing point, the stack is merged into `main` and deployed (§3, Landing the stack).

`qa-checklist-writing` distills a manual QA checklist from a PRD or TDD plan, for what `npm run check` cannot see: how a generated Adventure Map or region actually reads in Obsidian, and how the auto-build behaves while the DM edits.

### 4a. Harness Instructions (`CLAUDE.md`)

`CLAUDE.md` files are loaded automatically by the coding harness, recursively from the directory an agent is dispatched in. Taleform has one, at the root. It covers the architecture, the invariants, the Obsidian facts the schema rests on, the live vault and the roadmap.

`CLAUDE.local.md` (gitignored) adds developer-specific instructions alongside the committed file. It is the place for personal workflow rules. One example is the rule that may suspend the TDD-plan gate (never the PRD gate) on an approved branch.

### 4b. Agents (`.claude/agents/`)

Agents are dispatched by the orchestrating session, which handles reconnaissance and requirements gathering and then routes the actual work to a specialized agent.

Seven agents are committed:

| Agent | Role |
|---|---|
| `tdd-planner` | Researches the codebase and writes a TDD implementation plan in HTML, one per slice (step 4). |
| `tdd-executor` | Builds an approved plan in strict red-green-refactor style (step 7). Follows the plan; makes no architectural decisions. |
| `taleform-reviewer` | Reviews a plan, slice spec, PRD or diff against Taleform's invariants and conventions (step 5). Loads `taleform-reviewing`. |
| `taleform-abstraction-spotter` | Asks whether the convention a plan (`plan` mode) or a slice's build (`diff` mode) follows is the right one, and routes each finding by blast radius. Loads `abstraction-spotting`. |
| `issue-triager` | Triages one issue doc per dispatch and returns a verdict; `apply` mode also writes it. Loads `issue-triaging`. |
| `librarian` | Researches one documentation subject per dispatch and writes it (an issue doc, a context doc, a roadmap entry), or verifies that a filed issue still holds. |
| `git-ops` | Git and source-control operations: surgical staging, branches, stacked PRs; refuses destructive operations without approval. |

An agent whose frontmatter carries `memory: project` keeps a working memory directory under `.claude/agent-memory/<agent>/`, which persists notes across sessions. **It is opt-in.**

- Planners and executors should not opt in. In practice they write session diaries rather than durable facts.
- Memory writes are automatic and unbounded. The only backstop is the manual `agent-memory-compacting` drain at branch close.
- Before adding `memory: project` to an agent, be satisfied that what it learns is durable, and would not be better placed in a `docs/context/` doc or in `CLAUDE.md`.

### 4c. Skills (`.claude/skills/`)

Where an agent defines *what* to do, a skill defines *how* to do it. The same agent can produce different output by loading a different skill.

| Skill | Purpose |
|---|---|
| `wayfinding` | Step 0 of the loop. Charts an effort too big for one session and works its open decisions to a close. Carries `check-tooling.js`, the repo's checker for consistency across artifacts and instruction docs. |
| `grilling` | Interviews the DM about a plan, decision or idea, one question at a time, each with a recommended answer. |
| `domain-modeling` | Fixes an effort's vocabulary before it is spent in a PRD, a schema or a builder. Binds each term to a concrete referent, or marks it NEW. |
| `html-planning` | The `planr` CLI, Web Component DSL and runtime that every plan document is written with, including document metadata (`planr meta`, `query`, `next`). |
| `prd-writing` | Writing a PRD, or a PRD with a slice list and thin slice specs. |
| `tdd-planning` | How to write a red-green-refactor TDD plan. Owns the `tdd` template. |
| `taleform-reviewing` | Conformance review against the invariants and Taleform's core, builder, schema and test conventions. |
| `abstraction-spotting` | Checks whether the convention a plan or build follows fits, and routes each finding by blast radius. |
| `issue-creating` | Filing a defect as an HTML issue doc under `docs/issues/`, and retiring it when the fix ships. Owns the `issue` template. |
| `issue-triaging` | Setting an issue doc's triage metadata in one pass. Owns the priority matrix and `scripts/review.py`. |
| `qa-checklist-writing` | Distills a manual QA checklist from a PRD or TDD plan. |
| `pr-tidying` | Audits the branch against its parent before a PR, applies the approved fixes and drives `npm run check` green. Category H (`references/docs-sync.md`) holds the checker registry. |
| `pr-review-writing` | Writes the Markdown PR body for GitHub. |
| `pr-comment-addressing` | Applies reviewer comments and replies to each thread with the fixing commit; the human resolves. |
| `agent-memory-compacting` | Drains an agent's working memory under `.claude/agent-memory/`, graduating durable facts and dropping the rest. |
| `context-compacting` | Prunes a context or instruction doc to what is hard to derive and needed often. It then rewrites the lines `planr wordy` flags, without dropping a rule, literal, path or number. |

#### Plan templates (`.claude/skills/html-planning/templates/` and `.claude/planr-templates/`)

`html-planning` scaffolds every plan document from a named template: `planr new <file> --title <title> --template <name>`.

- A template is the markup that goes inside `<main>`, not a whole document. `_shell.html` supplies the rest, and a **leading underscore marks a file as not selectable**.
- A template's section ids are fixed vocabulary, owned by the skill for that *document type*, not by `html-planning`. That skill decides what a document contains; `html-planning` decides how it is formatted.

Templates live in two directories:

- `basic`, `tdd` and `issue` ship with the skill in `.claude/skills/html-planning/templates/`.
- The `wayfinding-*` templates are this repo's own and live in `.claude/planr-templates/`. `planr` reads that directory alongside the skill's, so syncing `html-planning` from its source is a plain overwrite of its folder.

Eight templates are selectable:

| Template | Scaffolds | Owned by |
|---|---|---|
| `basic` | One section to start from. | `html-planning` |
| `tdd` | A TDD implementation plan, written so an executor can follow it without re-deriving the design. | `tdd-planning` |
| `issue` | A defect found while doing something else, written for whoever picks it up cold. | `issue-creating` |
| `wayfinding-map` | The meta document for one effort: where it is going, what documents it has produced, and which questions are still open. Pointers and status only, never content. | `wayfinding` |
| `wayfinding-ticket` | One open question, what was measured to answer it, and what was decided. | `wayfinding` |
| `wayfinding-decisions` | Decision register: every decision an effort has made, what it rests on, and where it graduated to. | `wayfinding` |
| `wayfinding-vocabulary` | Vocabulary register: the effort's glossary, with every term bound to a concrete referent in this codebase or marked NEW. | `wayfinding` / `domain-modeling` |
| `wayfinding-evidence` | Evidence manifest: every measured artifact an effort rests on, what fact each one fixes, and how far it can be trusted. | `wayfinding` |

`node .claude/skills/html-planning/planr.js templates` lists them with their guidance lines, and is the authoritative inventory. `planr templates <name>` prints one template's full guidance, scaffolded sections and variables. The authoring guide is `.claude/skills/html-planning/references/template-authoring.md`.

### 4d. Context Docs (`docs/context/`)

Context docs do not tell the AI what or how to do something. They capture the sticky parts of the codebase that are hard to learn and expensive for an LLM to rediscover. `CLAUDE.md` points here, so an agent knows to search this directory for prior art.

There are none yet. Candidates as the code grows:

- the story model's derivation rules (sequence order, resume, combat XP);
- the canvas layout and node-ID stability rules behind the Adventure Map;
- the Bases API facts, once builders read through it.

When `/pr-tidying` runs after significant changes, it prompts to create or update these docs, so they do not drift from the code.

### 4e. Plan lifecycle (`docs/`)

Planning artifacts live under `docs/`, laid out as `docs/README.md` describes:

- `docs/features/<feature>/`: one folder per feature, holding its PRD, slice specs, wayfinding map with tickets and registers, QA checklists and TDD plans (in `tdds/`).
- `docs/issues/`: issue docs.
- `docs/roadmap.md`: the roadmap.

All are committed except TDD plans, which stay untracked: `.gitignore` excludes `docs/features/**/tdds/*`. Every TDD plan lives in a feature folder, including a one-branch fix.

Each has exactly one terminal fate:

| Artifact | On completion |
|---|---|
| TDD plan | Nothing to file; never tracked |
| PRD, slice spec | **Deleted** at effort close, behind the graduation check |
| QA checklist | Status → `implemented` once consumed, then **deleted** with its slice spec at effort close. (A body reading `CONSUMED` under a `draft` header contradicts itself.) |
| Issue doc | Deleted when the fix ships (`issue-creating`) |
| Wayfinding map, tickets, registers, `assets/` | **Deleted** at effort close, behind the graduation check (`.claude/skills/wayfinding/references/closing.md`) |

**Every fate is deletion.** A completed artifact's truths live in the codebase, in `docs/context/` and in `CLAUDE.md`. A filed copy is a second, staler source that every future search pays for. Completed artifacts are **not moved** anywhere; `git rm` them instead.

**Every plan document is queryable while it lives.**

- `planr meta` writes a document's fields, and `planr query` filters and ranks a directory by them.
- `.claude/planr-schema.json` declares the fields and the two rankings: `default` (the issue work queue) and `triage` (issues with no `priority`).
- **`planr next docs/issues --format json` is how the next issue gets picked**, not a directory listing.

A decision **graduates** when it lands in `docs/context/` or `CLAUDE.md`. That is the only copy that outlives the effort, so **nothing is deleted until the graduation check passes**. That check is the sole guard, and it is what makes deletion safe. Retire, do not delete blind: read each artifact for a fact that has not graduated before removing it.

**`/pr-tidying` owns the cadence.** Which status flips happen on every tidy, and which deletions wait for the close slice, is stated once, in its Category K (`references/plan-lifecycle.md`), and is not repeated here. **Delete with `git rm`, never a plain `rm`**, on a tracked artifact. Confirm with `git status` that the deletion is staged, rather than showing up as an untracked file disappearing.

### 4f. Supporting directories

- **`.llm-resources/`** (gitignored): a scratch space for handing the AI reference material for a task, such as exported notes, screenshots of a canvas, or spec snippets. Drop the files here and point the agent at them.
- **`.claude/reviews/`** (gitignored): where reviewing agents write their findings, as `<subject>.<agent-name>.md`. A returned summary is a one-liner; the full review lives in the file, so findings survive even when the agent's reply does not.
  - Each file ends with a terminal marker line (`## Review complete — <verdict>`), which tells a finished review apart from a truncated write. Treat a file without one as incomplete.
- **`.claude/hooks/`**: hooks the harness runs on lifecycle events, wired in the checked-in `.claude/settings.json`. One is wired: `relocate-agent-memory.sh`.
  - It is a `SubagentStop` hook. It moves stray `<subdir>/.claude/agent-memory/` drift (written when a subagent runs with a subdirectory as its cwd) back to the repo-root agent-memory directory.
  - It only moves files. Merging the *content* of accumulated topic files is the `agent-memory-compacting` skill's job.

---

## 5. Extending & Contributing

There are two ways to shape this tooling:

- **Extending** is local and personal: tuning the harness to your own workflow without affecting anyone else.
- **Contributing** is shared: improving the agents, skills and context docs that every session relies on.

### 5a. Extending (local, personal)

These files are personal and are **not** checked in.

| File | Purpose |
|---|---|
| `CLAUDE.local.md` | Personal, gitignored instructions added alongside the committed `CLAUDE.md`. |
| `.claude/settings.local.json` | Personal harness configuration: permission allow/deny lists, environment variables and hooks. Shared configuration goes in the checked-in `.claude/settings.json`. |

### 5b. Contributing (shared)

| Artifact | Location | Shape |
|---|---|---|
| Agent | `.claude/agents/<name>.md` | YAML frontmatter (`name`, `description`, and optionally `tools`, `model`, `color`, `memory: project`), followed by the agent's system prompt. |
| Skill | `.claude/skills/<name>/SKILL.md` | YAML frontmatter (`name`, `description`), followed by the instructions. Heavy detail goes in a sibling `references/` folder, so it loads only when needed. |
| Context doc | `docs/context/<name>.md` | Plain Markdown capturing a sticky part of the codebase. |

**When you rename an artifact,** search the repo for every reference and update it. References are not updated automatically; `node .claude/skills/wayfinding/check-tooling.js` catches the dead ones.

**Agent or skill?** The distinction is the whole design:

- An **agent** defines *what* to do and *when*: a reusable role with a job, dispatched by the orchestrator. Name it as an actor: `-planner`, `-reviewer`, `-executor`.
- A **skill** defines *how* to do something: a reusable procedure that an agent, or the main session, loads on demand. Name it declaratively: `-planning`, `-reviewing`, `-writing`.

**What makes a good agent or skill:**

- **A precise trigger.** The `description` carries the trigger ("use when…") and a one-line scope, and nothing more.
- **Single responsibility.** One job per artifact.
- **Grounded in the codebase.** Point at real files, real conventions and real pitfalls.
- **Written for retrieval, not rendering.** Put literals in backticks, use tables for dense relational data, and drop anything that is only there to look good.
- **Self-verifying.** Include gates, such as "before you finish, confirm X".
- **Tested.** Invoke it on a real task before opening the PR.
