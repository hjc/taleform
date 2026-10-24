---
name: prd-writing
description: Create a structured Taleform PRD from a high-level prompt — grounded in the existing story model, builders and invariants, and sliceable into TDD implementation plans. Use when asked to write a PRD, product spec, or feature design for Taleform.
---

# Taleform PRD Creator

## Overview

Create structured Product Requirements Documents for Taleform features. PRDs
translate high-level intent from the DM ("the Adventure Map should show who is owed
optional XP") into a complete product specification covering problem, solution,
schema changes, generated-output changes, plugin and CLI changes, edge cases, and
success criteria.

The output format is designed to be directly consumed by the
`tdd-planning` skill, which slices each PRD into individual TDD
execution plans. Each feature section in a PRD should be independently
implementable.

## Two shapes: standalone, or map-derived

**Standalone** — no map preceded it. One self-contained PRD with the required sections below. The default for anything a single session could scope.

**Map-derived** — a `wayfinding` map closed and handed off. The effort is too large for one document, so it splits in two:

| Artifact | Carries | Path |
|---|---|---|
| **The PRD** | The **cross-cutting contract** — the rules, invariants and vocabulary every slice must obey — plus the **slice list** in dependency order | `docs/features/<feature>/prd-<feature>.html` |
| **A slice spec**, one per slice | Only what that slice builds: its feature sections, schema / generated-output / plugin and CLI changes, edge cases, success criteria | `docs/features/<feature>/slices/<n>-<slug>.html` |

**A slice spec never restates the cross-cutting contract — it cites it.** If a rule applies to more than one slice it belongs in the PRD; if it applies to exactly one it belongs in that slice spec.

Slice specs are written independently and possibly months apart. **Writing a slice's spec must not require reopening the PRD** for *content*, and the PRD must not need re-deciding anything each time a slice is specced. The one permitted exception is the back-link below: a mechanical, one-line edit that adds no content.

### The PRD links every slice; the slice author adds the link

The PRD is authored with each slice's spec path as plain `<code>` and no `href`, because the spec does not exist yet. **Turning that entry into a link is the last step of writing the spec** — and the only edit a slice author makes to the PRD.

```html
<strong>Spec:</strong> <a href="slices/3-arc-map-builder.html"><code>slices/3-arc-map-builder.html</code></a>
```

Use a repo-relative `href` so it resolves from the PRD's own directory, and keep the visible text as the path in `<code>` so it stays greppable.

> Markdown read by an LLM cites bare paths, never clickable links. This is the one exception: a PRD is an HTML artifact a human clicks through.

### Map-derived PRDs carry an implementation graph

Alongside the slice table, a `<plan-diagram>` Mermaid flowchart of the slice dependencies, then a **wave table** (`Wave | Ships | Why here`) so the sequencing is derivable without reading the graph. Waves are not estimates and carry no dates. The graph shows three things a table cannot:

- **Which slices form one gate** — draw it as a `subgraph`; the gate lands whole.
- **Which slices split** — a read-only half early and a write half late is two nodes, not one row.
- **What only looks blocking** — solid arrow for a hard dependency, dashed for a soft one (rehearsal, preference). A slice in another repository blocks nothing here.

**`planr check` validates structure, not Mermaid.** A graph with a syntax error still passes it, so verify the rendered page with the browser check in `.claude/skills/html-planning/references/authoring-traps.md` (Verifying diagrams).

### Deriving from the map

1. **Take the slicing from the map's close; do not re-derive it.** Wayfinding produces it, coverage-checked, as its last act.
2. **Read the tickets' Obligations sections first.** They are the map's own statement of what it commits the PRD to, written while the reasoning was fresh. They are the checklist — resolutions are the backup.
3. **Reference the map; never restate it.** The PRD says *what to build and how to verify it*; the map says *why that and not the alternative*. Cite ticket ids inline (`q08 d49`) for rationale. A reader who never opens the map must be able to build from the spec; a reader who questions a choice opens the ticket.
4. **Route standing rules to the context doc, not the PRD.** For each decision ask: is this *this build's work*, or *a rule that outlives it*? Rules go to `docs/context/`, which survives after the PRD and the map are deleted at effort close (`docs/sdlc.md` §4e).
5. **If the build contradicts a decided ticket, amend the map** with what superseded it and why (see the `wayfinding` skill). Do not silently diverge.

**Reading order for a large map.** The map's `slices`, then `destination` / `out-of-scope` / `documents`; then the registers beside it, `decisions.html` and `vocabulary.html`; then the `Obligations` blocks of the tickets the brief names. Read the effort's `docs/context/<effort>.md` too — usually denser and more current than any ticket. Open a full ticket only when a summary fails.

**Two id spaces.** `C1…Cn` for contract rules (what a slice obeys internally), `G1…Gn` for hard gates (ordering *between* slices). Group the C rules into lettered families — e.g. identity, naming, shape, system boundary, irreversibility, safety, custody — each its own subsection, so a spec can cite a whole family.

**State rules; cite tickets for the why.** Never reproduce the map's catalogs, inventories, or decision prose. The rule ids plus a one-line gloss are the deliverable.

**Treat every count, list and asserted fact in the map as a claim to re-verify — except two, which are settled: a measured result recorded in the map's `evidence.html` at rank `live`, and anything the DM stated directly.** Take those as given and move on. Re-measuring either, or asking the user to reconfirm one, is the error.

| The claim | What governs |
|---|---|
| An approximation ("~30 of them") | Enumerate the exact set and reconcile the delta in an info callout naming each amending ticket. Log an Autonomous Calls row. |
| Two tickets classifying the same set differently | The ticket that owns **selection**, not the one that made the inventory. Divergence goes in "Flags raised against the map". |
| A fact taken from ticket prose | The raw asset it rests on, located through `wayfinding/evidence.html` — `assets/` is unindexed, so the manifest is the only way in. Parse the asset, not the prose summary of it. |
| The dispatch brief vs. a cited ticket | The ticket. Flag the divergence in the return message; log an Autonomous Calls row. |

Anything you find that belongs to another slice goes in Flags — never acted on.

**Authoring mechanics.** Write each section body with the Write tool into the scratchpad, splice with `planr add-section --body-file` / `set-body --file`. Verify every `href` resolves on disk, and strip inline `style=` attributes.

## Writing a slice spec

**A slice spec's value-add is cross-ticket conflict, not restatement** — everything else already sits in the map, the PRD contract, and `docs/context/<effort>.md`. The map is coverage-checked per ticket, not per slice boundary, so conflicts survive at the seams: work two slices both claim, work neither claims, a requirement violating a rule the same map wrote.

**Write every conflict as an open question with a recommended option — decided-and-flagged, never re-decided — and surface it in the return message.**

### Before writing a single row

- **Chase the amendments.** Grep the primary ticket for `Amended by` / `superseded` / `overturned` and read every ticket named there *before* its own decision table. Where an amendment wins, say so in a callout — a planner will otherwise find the original by search.
- **Read a sibling slice's spec.** `ls slices/` first (one may exist even when the brief says to create the directory), then `planr list` plus `planr read <sib> requirements --body`. Copy the section id set and the `R`/`AC`/`OQ` conventions; never the content. **Re-run `ls slices/` at the end too** — peers are often written concurrently, so an empty directory at the start is not evidence none exists. If siblings appeared, do not restructure; report the convention divergence so the orchestrator normalizes once across all of them.
- **Verify a dispatch brief's claim about the document before acting on it.** A brief describes what the parent agent believes it had you record. Grep for the claim's distinctive token before editing; if it is absent, record what the brief actually wants, state that nothing was superseded and why, and say so in the report. Never fabricate a prior position to make the instruction fit.
- **Read the PRD's non-contract sections.** A brief cites contract rules, but `§ Hard gates`, `§ Open items` and `Resolved:` blocks assign ownership by naming a slice. `planr read <prd> gates --body` and grep for this slice's id; anything addressed to it becomes a requirement plus an acceptance criterion, not a note.
- **Check each inherited decision's premise against the slicing.** A map decision predates slice boundaries, so it can assume two changes ship together. Ask what else must be true *when it lands on `main` and runs against the vault*; if the answer lives in another slice, write an entailed requirement plus an OQ.
- **Confirm the target system permits an operation before speccing it.** If it does not, spec what *is* available and raise a **blocking** OQ — do not re-decide.

### Shape

- **The contract citation is a table:** `Rule | Family | Consequence for THIS slice`. The third column is the whole value; glossing the rule is restatement.
- **Add a "what this slice does not ship" subsection** naming the sibling that owns each exclusion, or a planner absorbs neighbouring scope.
- **Acceptance criteria get a `Fails if` column.** Where the PRD already defines done, reuse it as `AC1`–`ACn` verbatim and add criteria only for the machinery.
- **Never write a number you have not measured.** State it unmeasured, name the query that would settle it, and assert a shape now and a number once run. **This applies to the numbers the PRD asserts about existing code too** — a confidently-stated exact count is as likely to be wrong as a hedged one, nothing downstream re-derives it, and no reviewer re-counts. Open the file and count, then put the divergence in Flags rather than silently correcting it.

### Slicing seams

- **The PRD's `Binds` list is a floor.** Check the draft against the full contract; cite extras with their consequence and log a row.
- **A ticket's Obligations block is effort-wide, not slice-scoped.** Carry a bullet only if your slice's paragraph in the PRD names its subject, and state which obligations belong elsewhere — silence reads as oversight.
- **A bound rule may describe the world your slice creates.** If it is not true on `main` today, say "becomes true only once this slice lands" in the consequence column.
- **An amendment invalidates acceptance criteria, not just prose.** Re-read the acceptance table asking *can this still fail?* A criterion that can only pass ships a green suite over a live defect.
- **Look for uncovered work at the emission trigger, not the payload.** A map decides what a value is and where it is computed, and routinely never decides what causes it to be emitted — "what fires the sync" and "what does the sync compute" are different tickets, each looking complete. Check every new signal against the triggers its siblings already have; a gap belongs to nobody and is an OQ.
- **A guard that returns "unconfigured" must be reachable before the work it guards.** `f(expensive(...))` evaluates the argument first, so it reads as guarded and is not. The tell is a spec claiming "with the property unset this builder reads no notes" alongside such an expression — both cannot be true. Split the guard into a predicate the caller checks first.
- **When a slice's work is "run the existing script", the finding is in the script's self-checks.** A well-built operator script is mostly guards, and those guards encode assumptions about the codebase at the time it was written; a slice that deliberately runs ahead of code violates exactly those. Enumerate every drift, agreement and refusal check it performs and test each against what this slice changes and what the slices it gates will change. Spec a named, self-retiring allowance that aborts when the code catches up, rather than relaxing the guard.
- **Ownership follows behaviour, not rule ids.** A rule is owned by whichever slice performs what it governs — often a slice that does not bind it.
- **Where two specs each point at the other for ownership, state your side and cite theirs as a cross-reference, not a claim**, then name the OQ that resolves it. Never claim, never disown.
- **Work that survives the map but appears in no slice row is an OQ**, not a judgment call.

### Correcting a spec after review

- **Audit internal id cross-references first**, before later edits add more. Inserting or promoting an OQ renumbers the list without touching the `R`/`AC` notes citing it, and no reviewer catches it.
- **Never renumber.** New criteria take the next free id; superseded Autonomous Calls rows get a bolded "Superseded — see row N" and keep their basis text. Inserted runbook steps take a letter suffix (`6a`).
- **A review's finding is binding; its stated evidence is not.** Re-check the source before adopting the review's wording — "narrower than stated" and "does not exist" prescribe different requirements. Two specific forms:
  - **A proposed test seam:** before adopting it, grep for an existing test of the same symbol. The shipped pattern is often a different mechanism, whose own comment encodes the trap the review reasoned toward.
  - **A "corrected" line number:** when both numbers resolve to real lines, neither is wrong. Drop the number, cite the symbol, and record that the original was not wrong, or the next reviewer re-files it.
- **Sweep the spec's own summary and overview tables after applying a review.** A review cites the section that argues a claim, never the two or three places the same spec restates it in condensed form — a "settled as" row, a contract binding, a cross-reference. Those restatements are what a TDD planner skims, so a corrected requirement plus an uncorrected summary row ships the original defect. Grep the whole file for the corrected claim's distinctive phrase and for the requirement ids near it.
- **A reframing leaks into every condensed restatement, not just the section that argues it.** Changing what a slice *is* touches the header and chips, overview tables and their column headings, contract-binding rows, section titles and every cross-reference to them, runbook step headings, exclusion-row notes, acceptance criteria, and flag remediation text. Grep for `ships|shipped|deliverable|engineering work|branch` and read every hit.

## Review and approval

**A PRD and every slice spec get explicit human approval, and this gate is never suspended** — including on the approved branches where `CLAUDE.local.md` suspends the TDD-plan gate.

**Dispatch the reviewer agents for the touched area before presenting it** (`docs/sdlc.md` §4b), the same ones that review TDD plans. A slice spec goes to the reviewers its own surface touches; the PRD goes to the union of those its contract constrains.

## Workflow

### Phase 1: Reconnaissance

Before writing anything, understand the current state of the system being changed.

1. **Read the planning directory** — check `docs/features/`, `docs/roadmap.md` and any relevant
   feature subdirectories for existing PRDs, READMEs, and MEMORY.md files
   that document prior decisions, deferred items, and architectural constraints.

2. **Read the domain reference** — load `references/taleform_domain.md` from this
   skill for Taleform's story model, builders, invariants, and
   deferred items. Cross-reference against the codebase to confirm currency.

3. **Trace the existing behavior** — read the specific code being changed:
   - Core: `src/core/story.ts` (domain rules), `index.ts` (membership, links), `engine.ts`, `regions.ts`, `canvas.ts`
   - Builders: `src/builders/` and their order in `BUILDERS`; `schema.ts` for the typed model
   - Surfaces: `src/plugin/main.ts` (commands, auto-build), `src/cli/main.ts` (flags, `--json`)
   - Tests: `test/*.test.ts`, builder tests through `build()` on `test/memoryVault.ts` fixtures

4. **Check the deferred list** — verify the proposed change doesn't conflict with
   explicitly deferred decisions. If the user's request touches a deferred item,
   surface this and confirm intent.

### Phase 2: Structure the PRD

Every PRD must contain these sections. How they are formatted is determined by the formatting skill loaded alongside this one (e.g., `html-planning`) — this skill only defines the **content**.

#### Required Sections (all must be present)

1. **Problem** — Concrete, scenario-based. Use bold names for actors (**the DM**, **another DM** adopting Taleform). 2-4 specific scenarios where current behavior fails or is confusing. Ground each scenario in real prep or table workflows (the worked-example mission in the live vault is the reference).

2. **Solution** — 2-3 sentence summary. Number the high-level changes.

3. **Feature Sections** — Split into independently implementable features. Each gets **What / Why / Behavior** subsections. For features with sub-operations, include: Who can do it, What it does, What it does NOT do, UX.

4. **What's NOT Changing** — Every adjacent system that stays the same. Common Taleform items: the existing builders' output, `BUILDERS` order, membership by `mission` link, the derived resume, canvas node IDs (`nid()`), the CLI flags and `--json` shape, the pre-commit staging rule.

5. **Schema Changes** — Table with Property / On / Change / Detail columns for every frontmatter property added, changed or retired, with the `RETIRED` entry for each rename. Call out what's NOT changing.

6. **Generated Output Changes** — Per builder: current output → new output. Name each region id, header/footer line and canvas item (with its `"generated"` marker), and say what a rebuild of an existing vault changes.

7. **Plugin & CLI Changes** — Commands, settings, status-bar text, auto-build behaviour; CLI commands, flags and `--json` fields. Condition tables where behaviour depends on context.

8. **Edge Cases** — Numbered list. Cover: existing notes without the new property, malformed or unquoted frontmatter, unresolved links, hand-made canvas items and dragged positions, auto-build firing mid-edit, CRLF notes, a vault with no missions.

9. **Success Criteria** — Testable assertions. These become the basis for TDD test cases.

**Map-derived PRDs additionally carry**, in place of feature sections (see "Two shapes" above):

- the **cross-cutting contract**, as numbered, citable rules;
- the **slice list**, each entry linked to its spec and each **vault-gating** slice marked as one (`docs/sdlc.md` §3 → Landing the stack);
- the **implementation graph** and its wave table;
- the **hard gates**.

Feature-level detail lives in the slice specs, not here.

### Phase 3: Taleform-Specific Quality Checks

Before finalizing, verify:

1. **Public-interface rule** — does this change a frontmatter property, a CLI flag,
   or the `--json` shape already on `main`? If yes, the PRD names the `RETIRED`
   entry (for a property) or what the vault's hooks will see (for the CLI), and
   marks the slice a vault gate if the DM must migrate first. If the feature isn't
   on `main` yet, no backward compat needed.

2. **Frontmatter is input only** — no requirement may have a builder write
   frontmatter. A state the DM must record is a property they set; anything
   derivable is derived (resume, combat XP and running totals are the precedents).
   Propose schema changes to the DM; never imply them.

3. **Only generated text is touched** — every new output lives in a region, the
   sequence header / `## Next` footer, or a canvas item carrying a `"generated"`
   marker. State what happens to the DM's hand edits beside it, and that a second
   build reports 0 changes.

4. **Existing notes** — every new property needs a "what happens with notes that
   don't have it" paragraph. Default to safe degradation: the output is omitted or
   a warning is raised, never an error that fails `check` on an untouched vault.

5. **Distributable** — nothing in the PRD requires a vault-specific name or path in
   `src/`. Everything comes from frontmatter.

6. **Feature slicing** — each Feature section should be independently
   implementable and testable. Feature 1 should not require Feature 2 to be
   useful. Feature 2 can depend on Feature 1.

7. **No over-scoping** — check the deferred list in `references/taleform_domain.md`,
   `CLAUDE.md` § Roadmap, and the feature README. Do not re-propose deferred items unless the user
   explicitly asks for them.

## PRD Conventions & Patterns

Formatting conventions:
- **Status labels** — `[NEW]`, `[BUG FIX]`, `[ENHANCEMENT]`, `[BLOCKED]`, `[PREREQUISITE]` applied to section headings, FR items, and phasing-table rows.
- **FR numbering** — sequential across the whole PRD (`FR-001`, `FR-002`, …); FRs added later take the next free number rather than renumbering.
- **Section renumbering** — inserting a new requirement section renumbers the downstream sections.

Writing patterns:
- **Open-question resolution** — surface Open Questions interactively via `AskUserQuestion` with a recommended default per question, then fold every answer into the PRD body (do not leave the questions in the finished doc).
- **Phase slicing** — a common shape, in dependency order: Phase 1 = the core rule or schema change (`src/core/`, `schema.ts`); Phase 2 = the builder that renders it; Phase 3 = the plugin or CLI surface and visual polish.
- **v0 simplification** — when validation complexity is uncertain, default to "all fields required" in v0 and note the planned refinement for a later phase.
- **The DM vs. another DM** — make explicit when a requirement serves only the live vault's conventions; anything that must hold for **another DM** adopting Taleform is stated without the live vault's names.

## No Deliberation in Output

The PRD is a finished artifact, not a scratchpad. Remove all reasoning process, hypotheses, self-corrections, and exploratory narrative before writing the final document. Present decisions as resolved facts with brief rationale. Downstream agents (TDD planners, reviewers) consume this document — deliberation text confuses them.

## Output Location

Save PRDs to `docs/features/<feature>/` using the naming convention from the agent instructions:
- `prd-{feature-name}` for standalone features
- `{area}/prd-{feature-name}` if it logically groups with existing plans
- File extension is determined by the formatting skill (e.g., `.html` when using `html-planning`)
- Check existing files in `docs/features/` to determine the best organizational fit

**Map-derived efforts** use the effort root the map already established, so the PRD, its slices and the map sit together:

```
docs/features/<feature>/
  wayfinding/map.html          the meta document: pointers and status
  wayfinding/decisions.html    the decision record
  wayfinding/vocabulary.html   the effort's bound terms
  wayfinding/evidence.html     the asset manifest, with authority rank
  wayfinding/q##-<slug>.html   one ticket per question — the reasoning
  wayfinding/assets/           the measured artifacts themselves —
                               unindexed, reachable only via evidence.html
  prd-<feature>.html           cross-cutting contract + slice list
  slices/<n>-<slug>.html       one per slice, thin
```

**Take each register at its own grain.** `decisions.html` is the source for the cross-cutting contract — one row is one rule, already in normative form, with the ticket that decided it in `Decided in`. `vocabulary.html` is the terminology section, already bound. `evidence.html` is the index that makes "prefer the raw asset over ticket prose" executable: it names the measured artifact behind every number, with an authority rank (`live` > `report` > `export` > `prose`), so a figure the PRD asserts is traced to what measured it. **A lower rank never overrides a higher one.**

**A PRD is a committed artifact, not a scratch file.** The "keep plans untracked" rule is scoped to TDD plans only. Commit the PRD on a `map--` branch under the `mapping:` prefix, and update its row in `docs/roadmap.md` in the same pass. If the PRD feeds a larger effort, that `map--` branch is the planning layer of a stacked PR — see `docs/sdlc.md` §3.

## References

- `references/taleform_domain.md` — Taleform's story model, builders, invariants, the Obsidian facts that shape the schema, and the deferred items list. Consult during Phase 1 reconnaissance.
- `CLAUDE.md` — architecture, § Invariants, § Obsidian facts we tested, § The vault (vault docs a model change affects), § Roadmap.
- `README.md` — the typed model and builder table, as the DM reads them.
- `docs/context/` — any context doc for the area the PRD touches.
