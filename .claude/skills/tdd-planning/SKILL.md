---
name: tdd-planning
description: Create a structured TDD (red-green-refactor) implementation plan with codebase-pattern discovery. Use when planning, designing, or implementing a feature, bug fix, or refactor, when entering plan mode, or for changes spanning multiple files.
---

# TDD Implementation Planner

## Overview

This skill enforces a test-driven development workflow for all software implementation plans. Every plan must follow red-green-refactor: write failing tests first, implement the minimum code to pass, then refactor. Plans must also be grounded in the existing codebase's patterns and conventions rather than inventing new ones.

Plans are written to `docs/features/<feature>/tdds/` at a path specified by the calling agent. Output format is determined by the formatting skill loaded alongside this one (e.g., `html-planning`).

**A TDD plan is untracked** — it is the one planning artifact under `docs/` that stays out of git (`.gitignore` excludes `docs/features/**/tdds/*`). Maps, PRDs, slice specs and issue docs are all committed (`docs/sdlc.md` §4e).

**So a deferred step is not an obligation anyone inherits.** A `blocked` step, a callout, or a "later" note lives only in the plan, and the plan is filed away when the slice lands — which is how something gets fully built and then sits dark, wired to nothing, with no artifact saying so. When a plan builds something it deliberately does not activate:

- The follow-up goes in a **committed issue doc** under `docs/issues/`, with its precondition stated.
- The plan ships an **in-suite guard asserting the un-landed state** — a test that goes red on exactly the commit meant to delete it. That is the forcing function; a comment is not.
- **Delete the step rather than marking it deferred.** A Red Phase whose Green Phase lands in another branch is a missing hunk however honestly it is annotated, and it leaves the suite red on the artifact the deferral exists to keep green.

### Working from a slice spec

When the plan implements a slice of a larger effort, the correspondence is **one slice ↔ one branch ↔ one TDD plan ↔ one PR**, and the slice's position in the stack fixes the plan's position in the build order.

- **Read the effort's PRD as well as the slice spec.** The PRD carries the cross-cutting contract, which the slice spec deliberately does not restate; the slice spec alone will miss binding constraints.
- **Do not re-decide what the map settled.** If the plan cannot honour a resolved ticket, say so and stop — that is a map amendment (see `wayfinding`), not a planning call.
- **Take the slice's success criteria as the plan's test spine.** A criterion that cannot be expressed as a test means the spec is wrong; fix it there.

### Plan Types

Most plans ADD behavior (feature plans) — the default this skill describes. Some RIP OUT or carve off behavior (removal plans); their failure modes are different — atomic-ordering broken-intermediate states, test-surgery on already-passing tests, dead-code cleanup, and generated output left behind in the DM's vault. When the task is a removal, a feature carve-off/park, or reversing a just-shipped behavior, also read `removal-plans.md` in this skill directory before authoring. Others MOVE a name other code — or the DM's notes, or the vault's hooks — binds to (rename / signature-change plans); there the change is mechanically forced to fan out, intermediate states do not typecheck, and tests go red — or stay green — for reasons unrelated to the behavior under test. When the task renames a frontmatter property, a builder id, a region id, a canvas `generated` marker, a CLI flag or `--json` field, or changes a function signature other modules call, also read `rename-and-signature-plans.md`.

## Core Principle: Tests First, Always

**Red-green-refactor is non-negotiable.** Every implementation plan must structure work as:

1. **Red** - Write tests that describe the desired behavior. Run them and confirm they fail.
2. **Green** - Write the minimum implementation to make the tests pass.
3. **Refactor** - Clean up the implementation while keeping tests green.

This applies to every layer: `src/core/`, `src/builders/`, the CLI and the plugin. If a plan does not lead with tests, it is incomplete.

### What "Tests First" Means in Practice

- For a new or changed builder: write a test that runs `build()` over a `MemoryVault` fixture and asserts on the emitted text or parsed canvas, plus the idempotency assertion (a second `build(v, BUILDERS, {}, false)` reports `changes` equal to `[]`), before writing the builder.
- For a new domain rule in `src/core/story.ts`: write a unit test calling the function over a fixture (`StoryIndex.load(vault)` then the rule) before writing it.
- For a schema change: write a test asserting the exact `problems` a malformed note produces, and that a clean note produces none.
- For a bug fix: write a test that reproduces the bug (fails), then fix the code so it passes.
- For a refactor: ensure existing tests pass before starting, then refactor while keeping them green. Add tests for any behavior not yet covered. A refactor must also leave the read-only parity check against the live vault unchanged (`docs/sdlc.md` §2).

### Test Granularity

Plan tests at the right granularity for the change:
- **Unit tests** for pure core logic: `story.ts` rules, `regions.ts`, `canvas.ts` (`sameCanvas`), `sha1.ts` (`nid`), `frontmatter.ts`, `links.ts`.
- **Builder tests** through `build()` on fixture vaults — the integration layer, and the default for anything a builder emits.
- **The plugin and CLI** are kept thin over `build()`. Test what they compute through the core; what only Obsidian can show (auto-build feel, canvas rendering) goes to `qa-checklist-writing`, not a test.
- **Do not plan end-to-end tests against a running Obsidian** unless the DM explicitly requests them.

## Phase 1: Codebase Reconnaissance

Before writing any plan, invest in understanding the existing codebase. This phase prevents plans that fight the architecture.

### 1.1 Discover Testing Infrastructure

Identify the project's test conventions and utilities before planning any tests:

- **Runner**: Vitest (`npm test` = `vitest run`; one file with `npx vitest run test/<file>.test.ts`). `npm run check` = `tsc --noEmit` + Vitest + esbuild bundle, and is the gate.
- **Test utilities**: `test/memoryVault.ts` — `MemoryVault` (an in-memory `VaultIO` over a `path → content` map) and `note(fm, body)`. Each test file builds its own fixture vault helper (`vault()` / `seq()` in `builders.test.ts`, `mission()` in `model.test.ts`); extend the nearest one rather than starting a new one.
- **Find existing test examples**: Read the `describe` blocks in `test/builders.test.ts`, `test/model.test.ts` or `test/core.test.ts` most similar to the planned change. These are the pattern to follow.
- **Mocking**: there is little. Builders are tested through real `build()` on an in-memory vault, not with mocks. A plan that needs `vi.mock` should say why the fixture route does not work.

Reuse existing test infrastructure. Do not introduce new test libraries, fixture styles, or mock patterns unless the existing ones are demonstrably inadequate.

### 1.2 Discover Implementation Patterns

Before designing the implementation, study how similar features are built in the codebase:

- **Find analogous features**: If adding a mission-note region, read `resume.ts` and `ledger.ts`. If adding a canvas element, read `adventureMap.ts`. If adding a property, read how `schema.ts` and `story.ts` handle `awards`.
- **Identify the pattern**: Note how builders read (`ctx.index`, `ctx.read`), emit (`ctx.emit`, `setRegion`), and report (`ctx.problem` — errors and warnings, never a throw).
- **Check for shared abstractions**: `story.ts` (`sequence`, `resumeBeat`, `awardsOf`, `combatOf`, `partySize`, `linkTo`), `regions.ts`, `canvas.ts`, `nid()`. Plan to reuse them.
- **Note naming conventions**: builder ids (kebab-case, e.g. `adventure-map`), region ids (`%% taleform:<id> %%`), frontmatter keys (kebab-case), file names (camelCase in `src/builders/`).

### 1.3 Understand the Data Flow

For any feature that touches story data:

- Trace the full path: note frontmatter → `frontmatter.ts` parse → `StoryIndex` (`Note.fm`, `members`, `link`) → `story.ts` rule → builder → `ctx.emit` → engine overlay (later builders `ctx.read` it) → diff against disk (`same`) → `VaultIO.write`.
- Identify which layers already exist and which need to be created, and where in `BUILDERS` order a new builder sits (a builder may read what an earlier one emitted).
- Check for existing validation in `schema.ts` and problem reporting at each layer.

### 1.4 Check for Existing Constraints

- **Read `CLAUDE.md` and project docs** for rules, conventions, and architecture notes — especially § Invariants and § Obsidian facts we tested.
- **Check `.llm-resources/`** at the project root for ad-hoc reference files (samples, screenshots, docs) that the DM has placed for LLM consumption. Not every file will be relevant — use your judgment based on the current planning task.
- **Check `.claude/context/`** for known gotchas, prior failures, and derivation rules specific to this project.
- **Never assert library or Obsidian behavior you have not verified.** A plan that claims what `yaml` parses, what a regex matches, or what Obsidian does on save is a claim the executor will build on — and a wrong one ships as a bug with no failing test. Verify with a throwaway probe instead: a scratch `test/probe-*.test.ts` or a node script in the scratchpad that runs the real call, deleted afterwards; record the OBSERVED output in the plan's recon section. For Obsidian behavior, cite `CLAUDE.md` § Obsidian facts we tested, or probe against a QA vault — never the live vault.
- **Check the breaking changes rule**: Only plan migration strategies for changes already on `main`. New features not yet merged do not need backward compatibility. On `main`, frontmatter properties, the CLI's flags and `--json` shape, and generated-output identity (`nid()` inputs, region ids, the `generated` marker) are public interfaces (`docs/sdlc.md` §1).

### 1.5 Callsite & Integration Audit (CRITICAL)

**This is the most important reconnaissance step.** If the plan builds new code that replaces existing code (a new rule replacing an inline computation, a new builder replacing part of another, a new helper replacing copies), you MUST:

1. **Grep for every existing callsite** of the code being replaced. Search across all files — `src/core/`, `src/builders/`, `src/cli/`, `src/plugin/`, and `test/`.
2. **Enumerate each callsite** in the plan with the specific file path and current usage.
3. **Record every site in `callsites`, and every *changing* site in `migration`** — then give each migration row its own step with its own test. A swap without a step is the failure this audit exists to prevent.
4. **Check builder run order**: a builder that reads another's output through `ctx.read` depends on running after it. Moving, splitting or replacing a builder means checking every reader of its paths and its position in `BUILDERS`.
5. **Check test fixtures**: Every fixture helper and literal note that encodes the old shape must be updated to the new one.
6. **Chained plans (targeting an unexecuted prerequisite's end-state)**: when this plan depends on another plan that has not executed yet and its diffs target that plan's END-STATE rather than current on-disk code, (a) write the diffs against the prerequisite's end-state and add a pre-apply check that the prerequisite's exact expressions still match before swapping them (they may shift during the prerequisite's execution); and (b) audit the docs/skill text the prerequisite *introduces* for any statement THIS plan invalidates and include correcting it as a callsite — a doc-sync step that exists only because of the prerequisite.
7. **Changing emitted text or a shared object shape: audit by the literal, not by the symbol.** When a step changes what a builder emits or what a function returns, a grep for the changed symbol misses every pre-existing test that asserts the retired text with `toContain` or an exact `toEqual` — including tests written in an earlier step of this same plan. Grep the test files for the old literal (a callout heading, an edge label like `skip — optional`, a region id) and add each hit as a `migration` row.
8. **Deleting or renaming a module: `tsc` finds importers, not strings.** `npm run check` catches every static import of a removed symbol, but not a path or id held in a string: a region id, a builder id compared by name, a canvas `generated` value, a file-name pattern like `— Adventure Map.canvas`. Grep for those literally and re-home every hit in the plan.

**A plan that builds new infrastructure without wiring it into existing entrypoints is INCOMPLETE.** New code that works perfectly but is never called — a builder missing from `BUILDERS`, a rule `schema.ts` never applies. The `migration` table is the check: a changing callsite with no step is that failure, made visible.

## Phase 2: Plan Content Structure

Every TDD plan must contain these sections. How they are formatted (HTML components, markdown, etc.) is determined by the formatting skill loaded alongside this one — this skill only defines the **content**.

### Plan Status Lifecycle

| Status | When | Who sets it |
|--------|------|-------------|
| `draft` | Plan is newly created, not yet reviewed | TDD Planner (default) |
| `approved` | Plan has been reviewed and approved for execution | The DM |
| `implemented` | All steps have been executed and verified | TDD Executor (after final verification) |

**Steps carry their own status**, separate from the plan's: `todo` / `in-progress` / `done` / `blocked`. The planner writes every step as `todo`; the executor flips each one as it works. Under `html-planning` that is a `status` attribute on the step's section, set with `planr set <file> steps.<n>.status=done` and surveyed with `planr tasks <file>` — a cheap edit that never loads the plan into context.

### Required Sections

Use these section **ids** verbatim — they are what make a plan addressable and comparable. `planr.js new --template tdd` scaffolds them; fill the scaffold in rather than renaming or reordering it.

| # | id | Title | Content |
|---|----|-------|---------|
| 1 | `overview` | Overview | What is being built, why, which patterns are analogous. 1-2 paragraphs. |
| 2 | `scope` | Scope & Prerequisites | What IS included and what is NOT (explicit exclusions), plus prerequisites. |
| 3 | `recon` | Reconnaissance Summary | Key files examined, patterns discovered, relevant existing code. Callouts for constraints about library or Obsidian behavior, or non-obvious gotchas. |
| 4 | `decisions` | Design Decisions | Table of non-obvious choices with rationale (# / Decision / Rationale). |
| — | `dataflow` | Data Flow *(optional)* | Before→after of a rewiring. See "Optional: Data Flow Diagrams" below. |
| 5 | `steps` | Implementation Steps | One subsection per step (see below). |
| 6 | `callsites` | Callsite Audit | **Every** reference to the changed symbol/behavior and its disposition, as a table (**# / Callsite / Change**) — including the `no change — why` rows. The complete inventory. **MANDATORY when the plan introduces replacement code.** |
| 7 | `migration` | Callsite Migration List | The subset of the audit that actually changes, in execution order, as a table (**# / Callsite / Step / Notes**). Every row names the step under `steps` that performs the swap. Omit the section only when the audit is entirely `no change`. |
| 8 | `verification` | Verification | `npm run check`; for any builder change, the read-only parity check `node dist/cli.cjs check --vault "<vault>"` and its expected result (`CLAUDE.md` § The vault); manual QA if applicable; expected test counts. |
| 9 | `anti-patterns` | Anti-Patterns | Table of things NOT to do, specific to this plan (# / Don't / Why). |
| — | `open-questions` | Open Questions *(optional)* | Unresolved items that need a decision before or during execution. |

**Each step under `steps`** is its own subsection carrying `status="todo"`, and contains:
- File references at the top (which files are touched)
- **Red Phase**: Failing tests with code — see "Test Specification Format" below
- **Green Phase**: Minimal implementation to make the tests pass
- **Refactor Phase** (optional): Only if there's genuine cleanup needed. Omit entirely if none.

**The audit is the inventory; the migration list is the work.** They are two sections because they answer different questions and drift apart if merged:

- **`callsites`** answers *did we find everything?* It carries every reference, including the ones that do not change, because a `no change — why` row is the only evidence a site was considered rather than missed.
- **`migration`** answers *is everything wired?* Every row names the step that performs the swap, so a callsite that changes but has no step is visible as a blank cell rather than as an absence.

**Every row in `migration` MUST name a step under `steps`, and every one of those steps carries its own Red and Green phases.** A callsite in the migration list with no step is an unwired change — the single most common cause of "the code works but is never called". The executor reconciles against both tables when finishing: every audit row dispositioned, every migration row's step `done`.

### Test Specification Format

**Do not pin exact line numbers for tests** — they shift constantly as test files grow. Instead:

- **New tests**: present them with the `add` affordance and name the existing `describe` block they belong inside. If none fits, say they go in a new `describe` at the end of the file.
- **Changing/refactoring a test**: instruct the executor to delete the entire old `it(...)` and rewrite it fresh (show the full replacement), rather than patching it in place.

### Wholesale New/Replaced Files: Ship the Artifact, Don't Transcribe

When a step creates or fully replaces an **entire file** (not a partial edit), do not embed the file's contents in the plan for the executor to retype. Instead, materialize the finished file in the plan directory and have the Green Phase copy it into place:

- Write the real file alongside the plan at `docs/features/<feature>/tdds/<name>.<ext>`.
- Green Phase instruction is a single `cp docs/features/<feature>/tdds/<name>.<ext> <target path>` — a byte-exact copy with no model round-trip and no transcription drift. Use `cp`, not `mv`, so the artifact survives as a provenance record when the plan is archived.
- Still lead with the Red Phase tests (they fail against the pre-copy file) and verify green after the copy.

Use this only for whole-file creation/replacement; partial edits still use diffs.

**A whole-file block must be the COMPLETE file — never a partial.** Do not put only the new/changed top-of-file defs in a `plan-file ... new` block for an EXISTING file and hand-wave the rest as "body unchanged" in prose. A literal executor reads `new` as "overwrite the whole file" and silently drops the omitted helpers, tables and long function bodies. If most of the file is unchanged, use an in-place `plan-diff`; reserve the whole-file affordance for genuine whole-file creation/replacement (and prefer the `cp`-a-materialized-file pattern above).

### Optional: Data Flow Diagrams

Put these in a `dataflow` section, placed between `decisions` and `steps`. Under `html-planning`, write them as `<plan-diagram>` (Mermaid) — never hand-rolled SVG.

When to include:
- The change adds a builder that reads another builder's output, or a multi-stage derivation
- There are 3+ modules interacting in a non-obvious way
- The plan rewires existing data flow

When NOT to include:
- Simple add-a-property or add-a-test-for-existing-behavior plans
- Changes to a single function with no inter-module interaction

## Building a Robust Red Phase

A reviewed plan still fails when a Red-phase test is vacuous, unreachable, or self-contradicting. Run each red test through this checklist before finalizing.

### Red-phase self-check (per test)

- [ ] **It actually goes red.** If a test passes against current code (or code a prior step landed), it's a regression guard, not a red — move it to the step whose Green makes it pass, or to Verification labeled with what it pins. A step whose Green is "no production change" is a mis-split step: for each test, name the diff that flips it; two tests that name the SAME diff are one step regardless of fixture shape.
- [ ] **It asserts behavior, not vacuous structure.** Assert on emitted text, parsed canvas nodes/edges, or `problems` — not on `fn.length` or the presence of an export.
- [ ] **Its matcher can't pass by accident.** `toContain` on generated text is a SUBSTRING match: a renamed label whose new text contains the old one, or a callout that appears in a different region of the same note, passes today. Assert the surrounding line or region (`[[Job]]\n← … →\n\n# ◆ Side`), or an exact `toEqual` on the parsed structure.
- [ ] **Red and Green don't conflict.** The test and this step's own Green diff must both be able to hold. If the Green correctly guards the "nothing changed" case, a red test that never actually changes anything can't reach its own precondition and will contradict the guard. Make the test reach its precondition (e.g. edit the fixture and build again) rather than loosening the guard.
- [ ] **An option-gated assertion runs with the option the test actually passes.** `build(v, BUILDERS)` uses default `BuildOptions` — no `relayout`, no `threads`, every mission. A test about `related` threads that forgets `{ threads: true }` passes on the option's absence — "not drawn", "unchanged" and "still there" all pass vacuously.
- [ ] **A removal's red is the new invariant failing NOW**, never a behavioral test that passes either way (see `removal-plans.md`).
- [ ] **Nothing upstream short-circuits before the seam under test.** If a cheaper check runs first — `schema` reporting an error, a builder skipping a note with no `kind`, a missing `^card`, an absent opt-in region that turns the output into a warning — the code under test never runs, and the test is green for a reason unrelated to what it claims. Trace the path from `build()` down and pick fixtures that keep every upstream guard OPEN. Assert `problems` has no errors alongside the behavior.
- [ ] **Every output test carries the idempotency assertion.** A second `build(v, BUILDERS, {}, false)` reports `changes` equal to `[]`. A builder that emits text its own next run re-reads differently (spacing, CRLF, key order) passes every content assertion and breaks invariant 3.

### Trace where every value travels

The #1 plan-failure family after "built but never wired" is a value that is produced but silently dropped in transit. Whitelists drop unnamed fields by DEFAULT — `awardsOf` reports any key outside its known set, and `schema.ts` rejects unknown kinds.

- **Enumerate the hops.** For any new property or value, list every boundary it crosses (YAML parse → `Note.fm` → schema → story rule → builder → emitted text) and what each does with a field it wasn't told about. Write the hop table into the plan and assert at each hop that matters, not just at the end.
- **Assert the full shape.** A partial assertion on a returned object passes against code that drops the new field.
- **Grep the consumer in the same step.** After adding a value, if its consumer isn't in a diff, the change is half-done. Ask: what breaks if I delete the consumer? "Nothing" means there is no consumer.

### Grep symmetries (one edit is usually a fan-out)

- **Compose → decompose.** When changing how generated text is COMPOSED, grep where it is DECOMPOSED — the code that finds an existing header, footer or region in a note to replace it. Each is a second implementation of the same rule and must resolve identically. When a fix changes what gets WRITTEN, notes written by the pre-fix code are live data in the DM's vault the new reader must still handle.
- **Derive → every writer.** Before deriving output from a property, grep every place the property can come from (frontmatter, a default in `story.ts`, a fixture) and check the premise against each. One conforming source is not the invariant.
- **Suppress a derived flag → every reader.** Making an existing derived value conditionally false is a fan-out edit to every reader, and at least one usually needs the ORIGINAL value. Split it rather than suppressing one shared name.
- **Production predicate → its test copies.** When changing a filter/branch/shape, grep the TEST files for a hand-copied version of it (a fixture helper that re-implements ordering or naming); add it as a callsite row.

### Destructive branches and new states

- **Gate a destructive branch on the condition its precondition SETS, not a broader condition that merely implies it.** Ask of every default branch: what is the state when I arrive here WITHOUT the setup step? If that path removes a region or drops a canvas item, the gate is wrong. Removing hand-made content is never acceptable (invariant 2).
- **A bug fix creates new states — walk them.** After writing a Green phase, walk the states the fix creates (no beats, every beat played, an empty region, a mission with no `party-size`) and check each produces sensible output or a clear problem.

### Don't loosen a load-bearing assertion

An exact assertion may pin an invariant, not tidiness. Before loosening or rewriting one, ask what it pins: `every((n) => n.generated === "adventure-map")` pins invariant 2, `changes` equal to `[]` pins invariant 3, a stable `nid()` vector pins existing maps' layout. Loosening one to make a step pass is a regression the suite will no longer report.

## Plan Self-Consistency

The executor is less capable and takes the plan literally; internal contradictions ship as bugs.

- **Prose must agree with its diffs.** A step's narrative ("this stays X until step N+1") must not contradict that same step's `<plan-diff>`/`<plan-file>` blocks (which may rename the very parameter the prose calls unchanged). The diff is what must typecheck and pass, and every later artifact assumes it landed — so write the prose to match the diff. If a signature change in a step's diff forces callsite updates, place them in THAT step; don't let prose defer them to a later one.
- **Order symbol introduction so each step stands alone.** A Red-phase test must not import a constant/function the plan only DEFINES in a later step. Vitest transpiles without typechecking, so the missing import is silently `undefined` and every test touching it fails with an unrelated `TypeError`, not the predicted assertion failure — and `tsc` fails the step's `npm run check` besides. Pull a behavior-neutral extract-constant or rename forward into the first step that needs the symbol.
- **Before applying a review item, read the plan's current state.** An item phrased as "add X" is frequently **already applied**, if earlier items from the same report landed in a previous pass. The residual defect is then the *prose beside* X — a callout still calling X optional, a count that predates it — and the fix is to rewrite that prose, never to re-add X. Review reports are written against a snapshot, so applying one across several passes desynchronizes the report from the file, and the most damaging leftover is a plan that instructs one thing in a diff and the opposite in a callout: a plan that contradicts itself teaches the executor to trust neither statement. Grep the plan for the thing the item says is missing *before* writing; if it is present, reframe the item as "what prose still asserts the old state?" and say so in the report-back rather than silently doing something different from what was asked.

## Phase 3: Execution Guidance

When executing the plan (after the DM's approval):

### 3.1 Work in Test-Implementation Pairs

Do not write all tests at once and then all implementation. Instead, work in small cycles:

1. Write one test (or a small related group).
2. Run it — confirm it fails (red).
3. Write the implementation to make it pass.
4. Run it — confirm it passes (green).
5. Refactor if needed.
6. Move to the next test.

This keeps feedback loops tight and prevents drift between tests and implementation.

### 3.2 Run Tests Frequently

After every meaningful change, run the relevant file (`npx vitest run test/<file>.test.ts`). Run `npm run check` at the end of every step — Vitest alone does not typecheck, so a step can be green in Vitest and red in `tsc`. Redirect large output to `.tmp/`; only inspect full output when failures occur.

### 3.3 Do Not Over-Engineer

- Write the minimum code to pass the test. Resist adding "while I'm here" improvements.
- Do not add error handling for scenarios that are not tested.
- Do not introduce abstractions until duplication is observed across at least 3 cases.
- Do not add comments, docstrings, or type annotations to code that was not changed.

### 3.4 Respect Existing Conventions

- Match the style of surrounding code (compact helpers, `ctx.problem` rather than throwing, `str`/`list`/`truthy` from `frontmatter.ts` for reading properties).
- If the project uses a specific pattern (e.g., deriving a value in `story.ts` rather than declaring a property), follow it even if a "better" alternative exists.
- Only introduce new patterns or dependencies when the DM explicitly approves.

## No Deliberation in Output Documents

**Plans are finished artifacts, not scratchpads.** Exploration, hypothesis-testing, and course-correction are expected during reconnaissance. But the final written plan must read as a clean, resolved specification — as if the right answer was known from the start.

Before finalizing any plan, do a cleanup pass and remove ALL of the following:
- Hypotheses, revised hypotheses, "let me reconsider" narrative
- "Actually," / "Wait —" / "Hmm," / "On second thought" / "Revised approach:"
- Self-answered questions and inline debates about alternatives
- Narrative about what was tried and why it didn't work
- "Note:" paragraphs explaining reasoning process rather than instructing the executor
- Stream-of-consciousness analysis that led to the final design

If a design decision needs justification, state it as a fact with a brief rationale — not as a narrative exploration. The executor is a less-capable agent that cannot distinguish between resolved decisions and abandoned hypotheses.

## Taleform Plan-Quality Checks

Before finalizing, verify the plan specifies these where they apply:

- **The invariants (`CLAUDE.md` § Invariants), each with a test where the plan touches it.** No builder writes frontmatter. Output lands only in a region, the sequence header / `## Next` footer, or a canvas item carrying `"generated"` — and a fixture with hand-made content beside it proves it survives. A second build reports 0 changes. A renamed or retired property gets its `RETIRED` entry in `src/builders/schema.ts` and a test that the old name's error names the replacement. Pre-commit staging never blocks.
- **`src/core/` stays free of Obsidian imports, and `src/` names nothing from the DM's vault.** Anything vault-specific comes from frontmatter.
- **Generated-output identity is stable.** A change to the arguments of a `nid(...)` call, a region id, a builder id, or the canvas file name churns every existing map or orphans every existing region. If the plan changes one, it is a rename plan (`rename-and-signature-plans.md`); if it must not, the `nid` vectors in `test/core.test.ts` and an existing-canvas fixture pin it.
- **The parity check is a verification step.** Any change to a builder lists `node dist/cli.cjs check --vault "<vault>"` with the expected result: "up to date" plus the one known warning, or the exact set of files whose output is meant to change. Never `build` against the live vault in a plan.
- **Report, don't throw.** Bad frontmatter becomes `ctx.problem("error" | "warning", …, path)`; a builder never throws on story data. Choose the severity deliberately: an error fails `check` and the vault's hooks, a warning does not.
- **Opt-in output warns when it is absent.** A new mission-note region follows `resume`/`ledger`: fill it where the DM placed markers, warn otherwise; never insert it uninvited.
- **CRLF and formatting.** Notes keep their line endings (there is a test); canvases compare through `sameCanvas`, because Obsidian re-saves them in its own format. A new emitted format says which comparison it uses.
- **Making a hardcoded value configurable → the default is a baseline-green guard, not a red test** — when a plan extracts a literal into a property or option whose default reproduces today's behavior, grep the target test file first: a test pinning the current literal usually already exists, and it passes before AND after. Do not duplicate it or stage it as a Red Phase. Only the OVERRIDE case is genuinely red. Label the default-value assertion a baseline-green regression guard and say so in the plan, or an executor stalls waiting for a red run that never comes. The default assertion still earns its place — it is the backward-compatibility contract for every vault that never sets the property.
- **A CLI change states its `--json` impact.** The vault's hooks parse it; a new field is additive, a renamed or removed one is a rename plan and a vault gate.

## Plan-Quality Heuristics

**"Consistent" is not "correct" when a rule reads one item out of many.** When a rule takes the first match from a set — the first note whose stat block `name` matches, the first member of a mission, the first heading — do not reason about whether the pick is *stable*; measure whether the rule is *right*. A stable pick of an arbitrary item still compares the rule against an arbitrary member of a set. Whenever a plan's rule reads one item out of a one-to-many, ask **"what if the rule considered all of them?"** — two stat blocks with one name is a problem to report, not a tie to break silently. If that is expressible it is almost always both the correct rule and the testable one.

**A control fixture must make TODAY's behaviour the exact failure the change fixes.** Before writing a red phase's "why it fails now", trace the current code path with the fixture *as specified*, not with the feature imagined away. A fixture that trips an unrelated guard still goes red, so it looks fine and proves nothing — and the executor cannot tell a correct implementation from a broken one.

For each red test, name the concrete output and `problems` today's code produces, not just "it fails". If the answer is a schema error rather than the wrong *output*, either fix the fixture so the wrong output is reachable, or move that case to its own test where the error IS the behaviour under test.

**Measure the red with a throwaway probe; do not reason it out.** Before writing a Red Phase, run the fixture through `build()` in a scratch `test/probe-*.test.ts` that prints the emitted text and `problems`, record what it showed in the plan's Overview, then delete the file. The executor needs the concrete before-value, not "it fails". A test that looks red is often **already green because a different path covers the case**, or **red for the wrong reason** because `schema` errored first; the probe shows which.

**A caveat that exists only because of a current defect must carry its removal condition.** When a review finding makes the plan want to hedge — "may not be accurate", "is approximate", "not guaranteed" — check whether the caveat outlives the artifact carrying it. A hedge whose underlying defect already has a filed fix does not belong in permanent output: once the fix ships, nobody goes looking for the now-false sentence. In generated text the DM reads at the table it is worse still, because output that explains its own data-quality problems undermines the signal it exists to deliver.

**Split every caveat by lifetime, and place each half by that lifetime:**

- A **permanent** property of the data goes in the generated output or a warning, stated plainly.
- A **temporary** one goes in a code comment and the plan's decision record — both cheap to correct — and the plan must state the condition under which it is removed and cite the issue doc that would trigger it. A caveat with a lifetime and nothing recording when it expires is an unowned obligation, and a TDD plan is filed away when the slice lands, so the plan is not a place it can survive.

The tell that this is happening: an internal caveat — from a review finding or a retracted PRD claim — propagating outward into generated text.

## Anti-Patterns to Avoid

- **Implementation-first planning**: Writing the solution first and adding tests as an afterthought. Tests must be planned and written first.
- **Inventing new patterns**: Introducing a new fixture style, test utility, or architectural pattern when the codebase already has an established way of doing things.
- **Mocking too much**: If a test requires mocking at all, check whether a `MemoryVault` fixture through `build()` would do. Surface any mock in the plan.
- **Testing implementation details**: Test behavior and outputs, not internal calls or intermediate state. Tests should survive refactoring.
- **Monolithic test-then-implement**: Writing all tests in one phase and all code in another. Work in tight red-green-refactor cycles.
- **Skipping reconnaissance**: Jumping to writing a plan without reading analogous code first. This leads to plans that conflict with established patterns.
- **Leaving reasoning in documents**: Plans, PRDs, and reviews must contain only resolved conclusions and actionable instructions — never the thought process that led there.
- **Building without wiring**: Creating new functions or builders without updating the callsites that should invoke them — a builder absent from `BUILDERS` is the canonical case. This is the #1 cause of "code works but is never called" failures.
