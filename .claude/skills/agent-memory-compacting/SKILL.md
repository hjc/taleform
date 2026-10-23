---
name: agent-memory-compacting
description: Compact subagent memory under .claude/agent-memory/ by graduating durable facts to a permanent home (generated doc / context doc / agent definition) and dropping point-in-time ones, keeping each agent's memory near-empty. Use at branch close (pr-tidying Category K), when loose topic files or `*.drift.md` copies accumulate, or when invoked directly.
---

# Agent Memory Compacting

Subagents (reviewers, planners, executors) accumulate memory under `.claude/agent-memory/<agent>/` —
an always-loaded `MEMORY.md` index plus small "topic files". This skill drains that accumulation
with judgment. It is NOT the mechanical drift relocator (the `SubagentStop` hook
`.claude/hooks/relocate-agent-memory.sh`, which only MOVES stray files to the right directory).

## Principle: memory is a staging area, not a knowledge base

Agent memory is the one project artifact with **no correctness pressure**: it is always-loaded (so
maximally trusted) yet never verified — no test, no PR review, no generator keeps it true. A durable
fact parked here is therefore the worst case: maximally trusted, minimally maintained. That is exactly
how memory rots into confidently-wrong line numbers and stale counts.

So treat agent memory as a **quarantine for facts that have not yet earned a permanent home**:

- **Steady state ≈ empty.** Each agent's memory should be a thin index plus, at most, a few
  not-yet-codifiable learnings.
- **Every pass is a graduate-or-drop gate.** A fact either moves to a home with correctness pressure
  or is dropped. "Keep" is the rare exception, not the resting state.
- **Longevity in memory is a smell, not a goal.** A topic file that survives multiple compactions is a
  file that should have been promoted after the first.

## Where a fact belongs (correctness-pressure hierarchy)

Put a fact where its correctness will be maintained for as long as the fact needs to live. In
descending order of correctness pressure:

1. **Generated doc** (a doc whose header carries `> Auto-generated`) —
   self-correcting; regenerated from code. If the fact is a model, field, route, or FK, it is ALREADY
   here (or belongs in the generator) and must NOT be restated in memory.
2. **`CLAUDE.md` / `.claude/context/` doc** — human-reviewed in the PR that changes the code it
   describes. The home for durable **reference** facts any agent or human would want.
3. **Agent definition (`.claude/agents/<agent>.md`) or its skill** — the home for durable
   **behavioral** judgment: how THIS agent should act or judge (a review heuristic, a plan-quality
   rule). This is not a fact about the codebase; it is guidance about the agent.
4. **Agent memory** — no pressure. Justified ONLY for a learning not yet stable or proven enough to
   codify into 1–3.

## Hard rules — what memory must NEVER hold

- **No codebase restatement.** If a fact is discoverable by reading the code or a generated doc, it is
  not a memory. Memory is for the non-obvious and hard-won ("we tried X; it broke because Y"), never a
  hand-maintained map of models / serializers / routes / where-things-live.
- **No volatile anchors.** No line numbers (`line 826`, `~L448`), no exact counts ("8 locations",
  "N tools"). They are wrong within weeks and nothing verifies them. Record the invariant, not the
  coordinate.
- **No duplicating a shared doc.** If a `CLAUDE.md` or a generated doc already states it, delete the
  memory copy rather than mirroring it.
- **One fact, one home.** Promoting or folding a fact means REMOVING it from memory — never leaving a
  copy behind.
- **No provenance trail.** After promoting or dropping, do NOT leave a note recording what moved where
  (e.g. "graduated to the be-reviewing skill", "now lives in `data-model.md`"). Memory is always-loaded,
  but a cold-start agent can't act on a changelog of past reorganizations — it's pure context tax, and
  the record of what moved and why belongs in the commit message. A drained index is a bare stub (title
  + an optional `_No active memories._`), never a receipt.

## Memory file conventions (do not violate)

- Each agent dir holds one `MEMORY.md` (the always-loaded index) plus any surviving topic files.
- A topic file is one focused fact/cluster with frontmatter (`name`, `description`, `metadata.type`).
- `MEMORY.md` carries one-line pointers to topic files and the agent's few most load-bearing,
  not-yet-promotable facts — nothing more.
- A fact lives in EXACTLY ONE place. Topic files cross-link with `[[name]]`.

## Workflow

### 1. Survey
For each agent directory under `.claude/agent-memory/`, list its files, count loose topic files
(everything except `MEMORY.md`), and note any `*.drift.md`. Report the inventory before changing
anything.

### 2. Read
For each agent being compacted, read `MEMORY.md` and every loose topic file (and any `*.drift.md`) in
full. Do not skim — graduate/drop decisions require the actual content.

### 3. Classify — default is GRADUATE or DROP
Apply to every loose topic file AND every `MEMORY.md` section (the index is not exempt from these
rules). Never fabricate or extrapolate — only move or drop facts already written.

- **Drop (point-in-time):** research notes or implementation artifacts for work that has shipped, facts
  scoped to a branch already merged, or anything now false. Delete it. Most memory becomes this the
  moment its branch lands.
- **Reconcile drift** (`*.drift.md`): diff against the canonical same-named file; merge any unique
  facts into the canonical file, then delete the `*.drift.md`. If identical, just delete it.
- **Promote — reference** (a durable fact about the codebase any agent/human would want): move to the
  right generated doc (fix the generator, not the output) or to a `.claude/context/` doc / `CLAUDE.md`,
  then remove it from memory.
- **Promote — behavior** (durable judgment about how this agent should act/judge): move to the agent's
  definition (`.claude/agents/<agent>.md`) or its skill, then remove it from memory.
- **Split hybrids:** a file that fuses a reference fact with a behavioral rule (e.g. a pdf-lib
  byte-type fact welded to a reviewer "flag this on any font-embedding plan" rule) is TWO things —
  promote the reference half to a context doc and the behavioral half to the agent definition. Do not
  "keep as-is" a hybrid because half of it looks good.
- **Fold into the index:** a thin, genuinely agent-behavioral one-liner worth keeping but not worth its
  own file → move it into `MEMORY.md` and delete the topic file.
- **Keep (the rare exception):** ONLY genuinely agent-behavioral judgment that is not a codebase fact,
  not branch-scoped, and not yet stable enough to state as a rule in the agent definition. If it IS
  stable enough, promote it instead. "Substantive and well-scoped" does NOT justify keeping — that is
  precisely how an agent accumulates a drifting codebase-map one dutiful file at a time.

### 4. Keep the index thin
After dispositions, `MEMORY.md` should be a thin index: a one-line pointer for every surviving topic
file (and none for deleted ones), plus only the agent's few most load-bearing, not-yet-promotable
facts. A `MEMORY.md` section that restates the codebase or carries volatile anchors is subject to the
same drop/promote rules — hold the index to the same near-empty standard as the topic files.

### 5. Plan, then apply
Present a consolidation PLAN before editing: a table of `agent | file/section | disposition
(drop / promote-reference / promote-behavior / split / fold / reconcile / keep) | destination`. List
promotions separately as advisory items needing per-item approval (they create or edit shared
artifacts). Wait for approval, then apply: drop/merge topic files, promote approved facts (removing the
source), reconcile drift, and retighten each `MEMORY.md`.

## Cadence

- **Default: every branch close.** `pr-tidying` (Category K) runs this pass at each PR, so memory
  drains before it accumulates across features — this is the primary mechanism keeping memory
  near-empty.
- **Also:** invoked directly (`/agent-memory-compacting`), on a `/loop` schedule, or opportunistically
  when `*.drift.md` appears or an agent has visibly sprawled.

## Guardrails

- **Never invent content.** Only relocate or drop facts that already exist. If a file's meaning is
  unclear, keep it and flag it — do not guess.
- **Graduate-or-drop is the default; "keep" is the exception.** Do not let a good-but-misplaced fact
  persist in memory just because it is well-written.
- **No duplication.** A fact ends in exactly one place; promoting or folding removes the source.
- **Preserve triggers and load-bearing facts** verbatim when promoting (descriptions, "when to use",
  exact commands, invariants).
- **Separate commits.** Doc/skill/memory changes are a separate commit from code, and nothing under
  `.claude/plans/` is ever staged.
- **Don't reconcile against stale docs.** If a promotion target contradicts the code, trust the code.
