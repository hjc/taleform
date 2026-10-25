---
name: qa-checklist-writing
description: Write a manual acceptance walkthrough for a Taleform feature — how the generated output reads in Obsidian, how auto-build behaves while the DM edits, and the CLI against the test vault. Use when asked for a QA checklist, manual test plan, acceptance test, or verification document.
---

# QA Checklist Writing

A manual QA checklist is **acceptance testing**: it walks the developer through the feature as a DM would meet it while prepping and running a session, so they can judge the experience and sign off on the requirements. It is not regression testing. Anything `npm run check` or Claude can check is checked there, and the checklist says so in one section at the end.

What a test suite cannot see is how generated output *reads*, and that is what the checklist is for:

- whether an Adventure Map is legible at a glance;
- whether a region sits where the DM expects it in a note;
- whether a header's `← prev • **this** • next →` line helps at the table;
- whether the 1500 ms auto-build feels right while typing.

Write it as a Markdown file beside the feature's plans (`docs/features/<feature>/qa-checklist.md`) unless told otherwise.

## Triage every requirement first

Before writing a step, sort each requirement and edge case in the source PRD/specs into one bucket:

| Bucket | Goes where | Examples |
|---|---|---|
| **Seen by a person** | A journey step | A canvas card's text and position, an edge label, an IF card, the `%% taleform:resume %%` region's wording, a two-line header, the `## Next` footer, an AWARD XP callout, the status-bar text (`Taleform ✓` / `Taleform: N problems`), a Notice, a dragged card staying put after a rebuild |
| **Mechanical** | "Covered by automated tests" | Idempotency (second `build` reports 0 changes), schema errors and `RETIRED` messages, CRLF preservation, `nid()` stability, region insert/replace/remove, combat XP arithmetic, `--json` shape |
| **Fault or timing** | "Covered by automated tests", or verified by Claude | Malformed YAML, an unresolved `prev`/`next`, a missing `^card`, many files written externally at once (the Windows watcher dropping events) |
| **Adversarial input** | "Covered by automated tests" | A link embedded in a longer string, a nested `map` object, unquoted `[[X]]`, a non-numeric `party-size` |
| **DM's-vault only** | `[V]` item with the reason | Behaviour the test vault cannot exercise: a vault's own git `pre-commit` hook (the test vault has no `.git` of its own), the Claude `PostToolUse` hook, a real campaign's scale |

For the mechanical, fault and adversarial buckets, find the test that covers each one (grep `test/*.test.ts` — Vitest, with fixture vaults built on `test/memoryVault.ts`) and run `npm run check` once. If a requirement has no covering test, verify it yourself against the test vault or with the CLI, record how, and say which test is missing. None of it goes to the developer as a step.

## Structure

1. **Header**: feature name, PRD path, branch, date, and the `npm run check` result.
2. **Key**: the markers below.
3. **Step 0**: put the branch in front of Obsidian — `npm run check`, `npm run deploy` (installs into `test-vault/`), open `test-vault/` as a vault in Obsidian and reload the plugin. Its own `[ ]` item, before the first journey. Never deploy a branch to a DM's vault for QA unless the developer asks (`docs/sdlc.md` §2, Deploy).
4. **Vaults**: one table naming each vault the checklist uses — the test vault (which missions the steps use, and any QA mission added for this checklist), and a DM's vault if any `[V]` step needs one — and for each, whether steps may write to it. A DM's vault is always **read-only**.
5. **Journeys**: one `##` section per situation the DM is in (see below).
6. **Covered by automated tests**: a table of requirement → test file and `describe`/`it` name, plus anything Claude verified by hand and how.
7. **Findings**: defects and deviations found during the walkthrough, each with its filed issue path.
8. **Test data**: the test-vault missions the steps use, any QA mission added, how it was built, and how to rebuild it.

### Markers

- `[ ]` needs testing
- `[x]` passed
- `[F]` failed (note the actual behaviour under it)
- `[A]` handed to Claude to run
- `[K]` skipped
- `[V]` deferred to a DM's vault, after the change lands on `main` and is deployed

New items start `[ ]`, except `[V]` items, which carry their reason.

### Journeys

- **One situation per journey.** The persona is the DM (or, for distribution work, another DM adopting Taleform on a fresh vault); journeys split by what they are doing. The first line says where they are and why, e.g. "The DM, prepping Act 2 of a mission, adds a branch to a beat." Typical situations: authoring a mission's frontmatter with auto-build on; reading the Adventure Map; running a session and flipping `beat-status`; committing in the vault (the `pre-commit` hook); running the CLI from a terminal.
- **Order journeys by the story.** Follow the order things happen: author the notes, see the generated output, play through beats, commit.
- **One action per step**, written as what the DM does and what they should see: "Set `beat-status: played` on `Job 1.01 — Start` and wait two seconds. The mission note's resume region now names `Job 1.03 — End`." Quote generated text exactly where the text is the requirement.
- **Put every note name, property, value and path a step needs in that step.** Never make the developer look up a value from an earlier step or a table elsewhere.
- **Use what the DM can see.** Use notes, the canvas, the properties panel, the status bar, Notices and the command palette (*Taleform: Build everything*, *Check (change nothing)*, *Toggle building on change*). A terminal step is fine for the CLI journey — it is a surface the DM uses — but never ask for Obsidian's dev-tools console or an `eval`. If a requirement can only be seen that way, it is mechanical.
- **Auto-build steps say how long to wait.** Any change to a Markdown note fires the metadata cache's "changed" event, and the rebuild runs 1500 ms after the *last* one (the timer resets while the DM keeps typing); a step that edits a note says to pause before looking. A step that must *not* rebuild (auto-build toggled off) says what should stay unchanged.
- **Map steps say what to look at, not where to click.** Name the card by its beat, the edge by its label (`skip — optional`), the IF card by its condition. A step that drags a card says which one, then which rebuild should keep it there (any build) or discard it (`--relayout`).
- **CLI steps run against the test vault.** `node dist/cli.cjs check --vault test-vault` (optionally `--json`, `--mission <name>`) changes nothing; `build` there is fine when the step says what it regenerates. Never put `build` or `pre-commit` against a DM's vault in a step; those are `[V]`.
- **Keep a journey to 20 steps or fewer.** Split a longer one at a natural pause, e.g. "Prepping, part 2: awards".

### Preconditions must be real

- **A setup step must actually produce the state the next step claims.** Check the mechanism before writing it: *Toggle building on change* is saved and survives a plugin reload, but setting `prefs.autoBuild=false` by `eval` is in memory only and a reload restores it; and a canvas edit is not a Markdown change, so dragging a card triggers no rebuild on its own.
- **Never tell the developer to destroy evidence a later step needs.** Deleting a generated canvas, clearing a region by hand and running `--relayout` all count. Where a clean slate helps, say what to look for instead.
- **Say which state a step consumes** when a later journey depends on it, e.g. "the card you dragged in step 4". Give each such item one name and reuse it.
- **Mind the Windows file watcher.** If Claude wrote test-vault files externally while Obsidian was open, Obsidian may show stale embeds ("Unable to find ^card"). Build test data with Obsidian closed, or through the plugin, before handing over.

## Test data

Build all test data yourself before handing the checklist over, in the **test vault** (`test-vault/`) — never a DM's vault. Prefer the missions it already holds; add a QA mission only for what they do not exercise. Write notes the way a DM would: typed frontmatter that passes the schema, `^card` blocks on every beat, links as whole values. Then run `node dist/cli.cjs build --vault test-vault` once and confirm `check` exits 0, so the developer starts from a clean, built state.

- **Name it for the checklist**: a QA mission goes in `test-vault/QA-<feature>/`, named `QA-<feature>`. Delete it before the PR, unless the developer wants it kept as permanent coverage; then commit it with its built output.
- **Build what each step needs**: e.g. a resume step needs a mission with played, partial, optional and planned beats in a known order; a combat-XP step needs stat-block notes with `cr` and an `encounter` block.
- **Write fictional content.** The test vault is committed; never copy a DM's campaign notes into it.
- **Record it** in the Test data section: each mission used or added and what it exercises, and the script that built any QA mission (kept in the scratchpad or a gitignored directory).

## Iterating with the developer

The developer marks items and writes notes under them as they go. When revising:

- **Keep their progress.** Carry every `[x]`, `[F]`, `[K]` and `[A]` and its note into the new structure. Never drop a completed step because the layout changed.
- **Resolve every `[A]`.** Run it, or show the test that covers it. Record the outcome and the evidence in the automated-coverage section, and turn the marker into `[x]` or `[F]`.
- **File every defect the developer reports** with `issue-creating`, and list it under Findings with its path. A failure caused by a bad test step is a checklist defect: fix the step and say so; don't file it.
- **Update the steps when the product disagrees with the checklist.** If a note shows the expected behaviour was wrong but the product is right, rewrite the step and record the correction under Findings.
