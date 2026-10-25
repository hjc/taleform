---
name: taleform-reviewing
description: Conformance review of a Taleform TDD plan, slice spec, PRD or branch diff against the invariants and the core, builder, schema, interface and test conventions. Corrects the subject before the developer sees it, routing each finding by blast radius. Loaded by the `taleform-reviewer` agent; use directly when a plan is ready for review or when moving from planning to execution.
---

# Taleform Conformance Review

## Overview

This skill reviews a subject against Taleform's established rules and corrects it to match them. It sits between `tdd-planning` (or `prd-writing`) and the developer's approval gate (`docs/sdlc.md` §4 step 5): every plan, slice spec and PRD gets this pass, alongside `taleform-abstraction-spotter`, before a human reads it.

It reviews four kinds of subject. The checklist is the same; § Subject modes says what changes.

| Subject | Where | Gate it feeds |
|---|---|---|
| TDD plan | `docs/features/**/tdds/*.html` | The developer's plan review (step 6) |
| Slice spec | `docs/features/<feature>/slices/*.html` | The PRD gate (step 3) |
| PRD | `docs/features/<feature>/prd-<feature>.html` | The PRD gate (step 3) |
| Branch diff | `git diff <parent>..HEAD` | Before `/pr-tidying` (step 8) |

**Scope.** Conformance only: does the subject follow the rules? Whether a rule *fits* this case is `taleform-abstraction-spotter`'s question; note such a concern in one line and leave it there.

**Reference, don't restate.** Several rules are already stated authoritatively in `tdd-planning` and in the `pr-tidying` audit references. Where this checklist cites one, apply it as written there; do not paraphrase it into the review. They are:

| Rule set | Authority |
|---|---|
| Runner layering, the import table | `.claude/skills/pr-tidying/references/imports.md` (Category A) |
| Vault coupling, magic names, folder matching, declared-vs-derived | `.claude/skills/pr-tidying/references/vault-coupling.md` (Category I) |
| Public surfaces, nondeterminism, generated identity, affected vault docs | `.claude/skills/pr-tidying/references/public-interface.md` (Category G) |
| Type weakening: `any`, `!`, unchecked `as` | `.claude/skills/pr-tidying/references/typing.md` (Category L) |
| Scaffolding tests to refuse | `.claude/skills/pr-tidying/references/test-scaffolding.md` (Category B) |
| Test overlap, placement, speed | `.claude/skills/pr-tidying/references/test-structure.md` (Categories C + D) |
| Red-phase self-check, callsite audit, plan self-consistency | `.claude/skills/tdd-planning/SKILL.md` § Building a Robust Red Phase, § 1.5, § Plan Self-Consistency, § Taleform Plan-Quality Checks |
| PRD quality checks | `.claude/skills/prd-writing/SKILL.md` § Phase 3 |

`pr-tidying` runs those audits on the finished diff. This review applies the same rules to the plan, where a fix costs an edit rather than a rework.

For the code shape behind every check below, see `references/conventions.md`.

## Review Checklist

Walk every section. For each, either record a finding or confirm it was checked.

### 1. The five invariants (`CLAUDE.md` § Invariants)

The most critical section. Each invariant names what to look for and the test that must pin it.

**1. Builders never write frontmatter.**
- Every emitted note keeps lines `0..note.fmEnd` byte-identical. A builder composes from the lines after `fmEnd` and re-joins `lines.slice(0, end + 1)` unchanged (navigation's pattern).
- No state is pushed back into a property: not a computed total, not a "last built" stamp, not a resume pointer. If a builder seems to need memory between runs, it must derive it from frontmatter and disk instead. That is how `resume` replaced the retired `resume` property.
- Writes happen only through `ctx.emit`. A builder holding a `VaultIO`, or calling `io.write`, is blocking.

**2. Only generated text is touched.**
- Note output lives in one of three places: between `%% taleform:<id> %%` markers, written with `setRegion` (`src/core/regions.ts`); a sequence note's two-line header; or its `## Next` footer. Hand-rolled marker strings, or a regex that finds them, duplicate `findRegion` and drift from it. Require `setRegion`.
- Canvas output carries a `generated` marker on every node and edge. Hand-made items survive: nodes without the marker, and edges without it whose endpoints still exist. Dragged positions survive unless `options.relayout`. A new canvas builder follows the merge in `buildMap` (`src/builders/adventureMap.ts`, the tail of the function), not a fresh write.
- **The marker value is per-builder.** `adventureMap` treats anything whose `generated` is not `"adventure-map"` as hand-made. A second builder writing into the same `.canvas` would have its items preserved forever by the first, and the reverse. A new canvas builder writes its own file under its own marker value. Two builders sharing one canvas is a design question for the developer (and the spotter), not a convention call.
- **Required test:** a fixture with hand-made content beside the output (text outside the region, a hand card, a dragged position) that survives a build. The precedent is `"keeps hand-made nodes and dragged positions"` in `test/builders.test.ts`.

**3. A rebuild is idempotent.**
- **Required test** for every new or changed output: `build(v, BUILDERS)`, then `build(v, BUILDERS, {}, false)` reporting `changes` equal to `[]`.
- **Compose from `ctx.read(path)`, never `note.text`.** `note.text` is the pre-build snapshot; `ctx.read` returns what earlier builders emitted this run. A builder that rewrites a note from `note.text` silently discards an earlier builder's edit to it in the same run. The next build then sees the earlier builder's output missing, re-emits it, and the two alternate. Reading `note.text` to *extract* source data is fine (`ledger` reads the Encounter line from it).
- **Line endings:** `toLF` on read, `fromLF(text, crlf)` on emit. A note writer that skips either converts the DM's CRLF notes, and every build reports them changed.
- **Canvases emit with `{ same: sameCanvas }`.** Obsidian re-saves a canvas in its own key order and drops the default `toEnd: "arrow"`. Without the semantic compare, every `check` after an Obsidian save reports the map stale.
- **Nondeterminism**: apply the public-interface reference's list (`Date.now()`, unsorted iteration, unpinned locale). Numbers in output go through `fmt` (`en-US`).
- **Why it is blocking in the plugin:** the plugin rebuilds 1500 ms after any `.md` metadata change (`src/plugin/main.ts`). Its own writes trigger that event; a build that settles stops there. A builder that is not idempotent makes the plugin rewrite the DM's notes every 1.5 seconds while Obsidian is open.

**4. The schema names the replacement for every retired property.**
- A renamed or removed property gets a `RETIRED` entry in `src/builders/schema.ts` naming what replaced it, plus a schema test asserting the old key's error names the replacement (`"rejects malformed awards and retired properties"` is the precedent). Deleting a `RETIRED` entry is a break.
- `RETIRED` covers **keys only**. A renamed *value* (a `kind`, an award `type`, a `beat-status`) falls through to the generic "is not one of" errors, which name no replacement. A plan that renames a value must add an explicit error naming the new value, with a test.
- A new property is validated in `schema.ts` in the same plan that reads it. A builder never trusts an unvalidated property.

**5. Pre-commit never blocks.**
- `preCommit` (`src/cli/main.ts`) returns 0 on every path and prints errors rather than failing. A plan that adds a non-zero return, a throw, or a prompt there is blocking.
- It stages only a rebuilt `.canvas`, or a note that was already staged and has no other unstaged edits. A new kind of output says which rule it falls under. Anything that is neither is rebuilt and left unstaged, because the DM's tree is full of deliberate WIP.

### 2. Runner layering

Apply the import table in `pr-tidying/references/imports.md`. In a plan:
- `src/core/` and `src/builders/` import no `obsidian` and no `node:*`, not even `import type`. Builders run in both runners.
- Vault access goes through `VaultIO` and `BuildContext`, never a runner's file API.
- Logic the CLI also needs does not live in `src/plugin/main.ts`. The plugin and the CLI are thin runners over `build()`. A rule that exists in only one of them gives the DM different output from Obsidian than from the hooks.

### 3. No vault coupling; derive over declare

Apply `pr-tidying/references/vault-coupling.md` in full. Plan-specific checks:
- **Membership** is `index.members(mission)`: the `mission` link, never the folder. **Mission selection** is `selectMissions(ctx.index, ctx.options.missions)`, so that `--mission` is honoured. A builder iterating `index.missions()` directly ignores the flag.
- Placing an output beside its mission note (`mission.folder`) is placement, not membership. It is not a finding.
- A new property the DM must keep in step with something Taleform can compute is a declared-vs-derived finding. Route it as a proposed PRD amendment: schema shape is the developer's call (`CLAUDE.md` § Working style).

### 4. Builder shape and registration

- A builder is an exported `const x: Builder = { id, description, run(ctx) }` (`src/core/builder.ts`), one per file in `src/builders/`.
- **It is registered in `BUILDERS`** (`src/builders/index.ts`) at the position its reads require. The array is a dependency list: a builder that reads another's output through `ctx.read`, or reuses its exports (`ledger` imports `runningTotals` from `awards`), runs after it. A builder missing from `BUILDERS` never runs. This is the canonical "built but never wired" failure, and it is blocking.
- The `id` is kebab-case and unique. It is not cosmetic: it is `Problem.builder` and `Change.builder` in the `--json` output the vault hooks read.
- **Report, never throw, on story data.** `build()` has no try/catch around `builder.run`. One throw aborts every builder in the run: the CLI exits 2 and the plugin's run rejects. Bad input becomes `ctx.problem("error" | "warning", message, path)`.
- **Choose severity deliberately and say why in the plan.** An `error` makes `check` exit 1 and fails a DM's vault Claude hook; a `warning` does neither. A missing opt-in region or a prose/data disagreement is a warning (`resume`, `ledger`). Data a builder cannot use is an error.
- **Report a validation once.** `schema` reports malformed data; consuming builders call the shared reader with a no-op (`awardsOf(n, () => undefined)`). A plan whose new builder reports the same malformed property again gives the DM duplicate problems.
- **Placement of a new region**: opt-in (fill only where the DM placed markers, warn otherwise, as `resume` and `xp` do), or inserted at a fixed anchor (`awards`, under the H1). The plan states which and why. Inserting into a note the DM did not mark is a product decision.

### 5. Reading frontmatter and links

- Frontmatter comes from `Note.fm`, parsed once by `splitFrontmatter` in `StoryIndex`. A builder that re-parses a note's YAML forks the parser and loses the `[[X]]` folding. `yaml`'s `parse` is for body blocks only (`combatOf`'s `encounter` block).
- Values are `unknown` until narrowed with `str`, `list`, `truthy` (`src/core/frontmatter.ts`) or a story reader (`awardsOf`). Typing rules: `typing.md`.
- **Links are whole values.** A new link-valued property is read with `parseLink` / `index.link` and validated as whole in `schema.ts`. Do not design a property that embeds a link in a longer string: Obsidian neither tracks nor rewrites it on rename (`CLAUDE.md` § Obsidian facts we tested). `findLink` exists for legacy values; new properties do not lean on it.
- Targets resolve through `index.resolve` / `index.link` (basename, else shortest path, like Obsidian). Concatenating a path from a link's text is a finding.
- **Lists of objects stay top-level.** A list of objects nested under another key renders as "[object Object]" in make.md, and editing it there loses data. A new list property is a top-level key, as `entry`, `branches`, `outcomes` and `awards` are.
- Domain rules shared by more than one builder live in `src/core/story.ts` (`sequence`, `resumeBeat`, `awardsOf`, `combatOf`, `partySize`). A rule used by one builder may stay in it.

### 6. Canvas identity

- Ids come from `nid(...)` (exported from `src/builders/adventureMap.ts`, built on `sha1`). **The inputs are semantic identity**: a prefix naming the id family (`"n"`, `"e"`, `"g"`, `"if"`, `"xp"`, …) plus basenames, act numbers or link targets. Never array positions, coordinates, or anything layout decides. An input that changes when nothing in the story changed churns the DM's map and discards their dragged positions.
- A new family takes a new prefix. Changing an existing `nid` call's inputs is a rename of every id in that family: a rename plan (`tdd-planning/rename-and-signature-plans.md`) and regenerated test-vault output the plan must name. The `nid("legend")` vector in `test/core.test.ts` pins legacy ids; it is never loosened to make a step pass.
- Parse, format and compare with `parseCanvas`, `formatCanvas` and `sameCanvas` (`src/core/canvas.ts`). Do not hand-roll `JSON.stringify` or compare text.
- Keep the duplicate-id check (`buildMap` reports it as an error) in any new canvas builder.

### 7. Public interfaces

Apply the surfaces table in `pr-tidying/references/public-interface.md`. At plan level, also check:
- **A new `BuildOptions` field** is threaded end to end: `src/core/builder.ts`, the CLI argv loop, `USAGE`, and the plugin if it should be reachable there. A flag parsed but never read, or read but never parseable, is a wiring finding.
- **`--json` is `BuildResult` serialized whole.** A field added to `BuildResult`, `Change` or `Problem` is additive. A renamed or removed field breaks a DM's vault hooks; it is a vault gate (`docs/sdlc.md` §3), marked in the PRD's slice list.
- **Exit codes**: 0 ok, 1 errors (or anything stale, on `check`), 2 usage or crash. A plan that changes their meaning is a public-interface break.
- **Affected vault docs.** When the model changes, the plan or PRD lists which vault docs now describe it wrongly. Never a step that edits them.

### 8. Plugin conventions

- Settings live on `prefs`, never `settings`, which clashes with the `Plugin` base class. A new key goes into both the `Settings` interface and `DEFAULTS`. `onload` merges saved data over `DEFAULTS`, so an old `data.json` without the key still gets a value. Renaming a key loses the DM's saved setting.
- Auto-build fires on `metadataCache` `"changed"` for `.md` files only, debounced 1500 ms, gated on `prefs.autoBuild`, and serialized through `this.running`. A plan that adds a trigger (a canvas event, a file-create hook) must show it cannot loop on the plugin's own writes. A plan that bypasses `run()` loses the serialization and the status bar.
- Writes in the plugin go through `ObsidianVault` (`app.vault.modify` / `create`), so Obsidian indexes and repaints them.
- `run(options, write, loud)` and the command ids (`build`, `check`, `toggle-auto-build`) are scripting and hotkey surfaces. Do not change their shape.

### 9. Tests

The rules are in `tdd-planning` § Building a Robust Red Phase and the `pr-tidying` test references. Enforce in the plan:
- **Builder tests go through `build()` on a `MemoryVault` fixture** (`test/memoryVault.ts`), using `note()` or the `mission()` helper in `test/model.test.ts`. They do not call `run(ctx)` with a hand-made context, which skips the engine's overlay and diff.
- New tests go in the existing files (`core.test.ts`, `model.test.ts`, `builders.test.ts`) under a `describe` per builder or module. A new file needs a fixture no neighbour shares.
- **Every output test asserts idempotency and no errors**: `r.problems.filter((p) => p.severity === "error")` equal to `[]`. Without it, a fixture that trips `schema` first is red or green for the wrong reason.
- Assertions on generated text pin the surrounding line or region, not a bare substring (red-phase self-check, "matcher can't pass by accident").
- An option-gated behaviour passes the option (`{ threads: true }`, `{ relayout: true }`).
- No `node:fs`, no child process, no `dist/`, no real vault, no absolute path, no `obsidian` import, no real timers. Vitest only.
- **No immediately-passing Red Phase, and no stub Green Phase.** Each red names the diff that flips it. Each green is the full implementation: no `TODO`, no "implement the layout here", no signature with an empty body. The executor cannot fill gaps.
- **Diff the design decisions against the hunks.** Every claimed behaviour has a Green hunk that realizes it and a Red test that pins it. A decision with no hunk, or a hunk with no test, is a finding. So is a plan that diagnoses its own gap in prose and delegates it ("Executor: resolve this one of two ways").
- **Verification includes the parity check**: `npm run check`, whose test-vault check (`node dist/cli.cjs check --vault test-vault`) passes as is, or the plan names exactly the `test-vault/` files `npm run build:vault` regenerates. A plan that runs `build` against a DM's vault is blocking.

### 10. Types

Apply `pr-tidying/references/typing.md` to every Green hunk. In short: no `any`; no `!` where a local alternative exists (iterate `entries()`, guard and return, `??`); no `as T` on parsed input with no runtime check behind it; no `@ts-ignore`; no edit to `tsconfig.json` that weakens `strict` or `noUncheckedIndexedAccess`. Green code must typecheck as written: Vitest does not typecheck, so a step can be green in Vitest and red in `npm run check`.

### 11. Integration and callsite wiring (CRITICAL)

The most expensive class of plan failure is new code nothing calls. Apply `tdd-planning` § 1.5. Check that:
- every new builder is in `BUILDERS`;
- every new schema rule is reached from `schema.run`;
- every new option is threaded CLI → `BuildOptions` → builder;
- every replaced helper has each callsite enumerated, in `src/` and `test/`, each with its own step;
- every changed emitted literal (a callout heading, an edge label, a region id) is grepped as a literal in `test/`, and each hit is a migration row;
- every changed string identity (region id, marker value, output file name pattern) is grepped as a string, because `tsc` cannot find it.

Flag missing wiring as **PLAN INCOMPLETE** and list the swaps.

## Subject modes

**TDD plan.** The whole checklist. Read the PRD and slice spec it implements; a plan that contradicts a settled contract rule is an issue even if it conforms otherwise.

**Slice spec or PRD.** There is no code yet, so check at requirement level. Apply `prd-writing` § Phase 3 and these sections of the checklist:
- §1: no requirement has a builder write frontmatter, touch hand-made text or depend on a non-idempotent output. Every rename names its `RETIRED` entry.
- §3: nothing requires a vault-specific name, and everything derivable is derived.
- §5: new properties are whole-value links and top-level lists.
- §7: CLI and plugin surface changes are marked as vault gates where they break, and the affected vault docs are listed.
- Every new property has a "notes that don't have it" paragraph that degrades safely: a warning or omitted output, never an error on an untouched vault.
- No parked roadmap items are re-proposed. Arc and Campaign maps need the developer's design confirmation; the Bases-API read path needs design before code (`CLAUDE.md` § Roadmap).

**Branch diff.** The whole checklist against `git diff <parent>..HEAD -- src/ test/`, reading each touched file in full. Run `npx tsc --noEmit` and `npx vitest run` if the dispatch did not supply results. `npm run check` is read-only outside `dist/` and includes the parity check; run it if the dispatch did not supply its result. Never `build` against a vault or `deploy`.

## Routing: blast radius decides where a finding goes

Route each finding by **who else inherits the change**, not by how important it feels:

| Blast radius | Route |
|---|---|
| Confined to this slice's own new code: a new builder's internals, its tests, a new helper only it calls, a new region or `nid` family only it emits | **Required plan amendment.** The planner applies it on re-dispatch; no gate. |
| A shared contract (listed below the table) | **Proposed PRD amendment**, in the PRD's contract-rule form. It goes back to the developer's PRD gate (`docs/sdlc.md` §4 step 3), which is never suspended. Do not write it into the plan as if decided. |
| A shared contract on a standalone fix with no PRD | **Open question for the developer**, stated with your recommended answer. Schema and interface changes are proposed, never implied (`CLAUDE.md` § Working style). |

A **shared contract** is any of:

- the frontmatter schema: a property's name, type or shape; `RETIRED`;
- the CLI's flags, exit codes or `--json` shape;
- the plugin's `run` signature, `prefs` keys or command ids;
- an existing generated identity: a `nid` input, region id, marker value, output path;
- a `src/core/` signature another builder or slice uses;
- `BUILDERS` order another builder depends on.

A finding in a PRD or slice spec under review is, by definition, a proposed amendment to that document.

## Verdict

- **APPROVED**: no issues, or only notes that need no change.
- **NEEDS CHANGES**: required plan amendments, none of them invariant breaks.
- **MAJOR ISSUES**: an invariant break, a layering violation, missing wiring (PLAN INCOMPLETE), or any proposed PRD amendment. The last because the plan cannot proceed until the developer rules on it.

Do not add features or expand scope during review. Correct the subject to match existing rules, and nothing more.

## Reference

- `references/conventions.md`: the code shapes behind each check (region builder, note rewrite, canvas merge, schema addition, CLI option, plugin pref, test fixture).
- `CLAUDE.md` § Architecture, § Invariants, § Obsidian facts we tested, § The vault.
- `docs/sdlc.md` §1 (public interfaces), §2 (parity), §3 (vault gates, vault docs), §4 step 5 (this review).
