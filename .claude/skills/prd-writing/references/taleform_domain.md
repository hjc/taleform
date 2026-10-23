# Taleform Domain Reference

Ground truth is the code and `CLAUDE.md`; this file is a map into them. Re-check anything
here against `src/` before a PRD asserts it.

## Product Overview

Taleform is declarative storytelling infrastructure for Obsidian, named to echo Terraform:
typed frontmatter is the source of truth, and builders generate everything the DM reads from
it — navigation headers, XP callouts, mission-note regions, and Adventure Map canvases.
Everything generated can be rebuilt at any time.

Personas:
- **The DM** — the author, running a D&D 5e (2024) campaign. Their vault is the only live
  consumer. They prep missions in frontmatter and read the generated output at the table.
- **Another DM** — a future adopter. Distribution is a goal, so `src/` carries no
  vault-specific names or paths; everything comes from frontmatter.

## Architecture

One TypeScript core, two runners.

| Layer | Path | Notes |
|---|---|---|
| Core | `src/core/` | **No Obsidian imports**, so the CLI stays headless |
| Builders | `src/builders/` | `BUILDERS` in `index.ts` is the run order; a builder is `{id, description, run(ctx)}` |
| CLI | `src/cli/main.ts` → `dist/cli.cjs` | `build`, `check`, `pre-commit`; `--vault`, `--mission`, `--relayout`, `--threads`, `--json` |
| Plugin | `src/plugin/main.ts` | Commands *Build everything*, *Check (change nothing)*, *Toggle building on change*; 1500 ms debounced auto-build on metadata-cache "changed"; status-bar text; `run(options, write, loud)` for scripts |
| Tests | `test/*.test.ts` | Vitest; `test/memoryVault.ts` is an in-memory `VaultIO`; builder tests go through `build()` on fixture vaults |

Core modules: `vault.ts` (`VaultIO {list, read, write}`, LF internally), `index.ts`
(`StoryIndex`: parses all frontmatter, `resolve`/`link`, `missions()`, `members(mission)`),
`story.ts` (domain rules), `engine.ts` (runs builders; `build()` returns
`{changes, problems, written}`), `regions.ts`, `canvas.ts` (`sameCanvas`), `sha1.ts` (`nid()`),
`frontmatter.ts`, `links.ts`.

**The engine diffs, builders don't write.** A builder calls `ctx.emit(path, content)`; later
builders `ctx.read` through the overlay; the engine compares against disk and writes only real
changes. `ctx.problem("error" | "warning", …)` reports.

## The Typed Model

| On | Property | Meaning |
|---|---|---|
| mission | `kind: mission`, `party-size`, `party-xp`, `handoff` | `party-xp` is XP each *now*; running totals count from it |
| sequence note | `mission`, `kind`, `act`, `beat`, `beat-status`, `prev`, `next`, `optional` | `kind` ∈ `act`, `beat`, `scene`, `combat`, `challenge` (`SEQ_KINDS`) |
| beat | `awards`: list of `{xp, type, for, per, max, note}` | `type` is `story` (default) or `optional`; `per`/`max` only on optional |
| beat | `entry`; `branches`: `{to, label}`; `outcomes`: `{if, then, to}` | what the map draws beyond the main line |
| beat | `related` | drawn as threads on the map only with `--threads` |
| stat block | `statblock: true`, `name`, `cr` | read by combat XP |

Other `kind` values the schema accepts: `reference`, `bench`. `beat-status` ∈ `planned`
(default), `played`, `partial`, `skipped`.

**Membership is the `mission` link, never the folder.**

## Derived Rules (`src/core/story.ts`)

- **Sequence** — a mission's sequence notes in `act`/`beat` order.
- **Resume** (`resumeBeat`) — find the furthest beat touched (played, partial, skipped). If it
  is `partial`, resume there; otherwise the first planned, non-optional beat after it. Act
  notes never count. There is no `resume` property.
- **Awards** (`awardsOf`) — typed; malformed entries are reported, never guessed at.
- **Combat XP** (`combatOf`) — never typed. Read from a beat's ```` ```encounter ```` block
  (Initiative Tracker format) × each creature's stat-block `cr` → 2024 XP table, split across
  `party-size`.
- **Levels** (`nextLevel`) — the 2024 advancement table; story awards and combat XP count
  toward running totals, optional awards do not.

## Builders (run order)

| id | Output |
|---|---|
| `schema` | nothing: validates story frontmatter; names the replacement for every retired property (`RETIRED`) |
| `navigation` | each sequence note's two-line header (mission line, then `← prev • **this** • next →`) and its `## Next` footer |
| `awards` | the AWARD XP callouts under each beat's H1, with running total and next level when `party-xp` is set |
| `resume` | the mission note's `%% taleform:resume %%` region (opt-in: warns if absent) |
| `ledger` | the mission note's `%% taleform:xp %%` region; warns when an **Encounter:** line disagrees with its block |
| `adventure-map` | `<Mission> — Adventure Map.canvas`: one card per beat (H1 over its `^card` block), branches, IF cards, XP, resume, hand-off |

## Invariants (`CLAUDE.md` § Invariants — do not break)

1. **Builders never write frontmatter.** It is input only, so a build cannot feed back.
2. **Only generated text is touched**: region contents, a sequence note's two-line header and
   `## Next` footer, and canvas items carrying `"generated": "adventure-map"`. Hand-added cards
   and edges survive; dragged positions survive unless `--relayout`.
3. **A rebuild is idempotent.** A second `build` reports 0 changes; `check` on a freshly built
   vault exits 0.
4. **`RETIRED` names the replacement for every retired property.** Never drop support silently.
5. **Pre-commit never blocks.** It stages only a rebuilt canvas, or a note already staged with
   no other unstaged edits.

## Public Interfaces

- **Frontmatter** — the DM's notes, and potentially another DM's. Renames go through `RETIRED`.
- **CLI flags and `--json` shape** — the vault's git `pre-commit` hook and its Claude
  `PostToolUse` hook (`taleform-hook.mjs`) call `dist/cli.cjs` directly.
- **Generated-output stability** — canvas node IDs come from `nid(...)` and must stay stable
  across builds, or maps churn and dragged positions are lost. Region ids are matched by name
  in existing notes.
- **Vault docs that describe the model** — the story-maps spec, `run-sheet-format.md`,
  `_tpl/Story Beat.md`, and the vault `CLAUDE.md` § Taleform. A PRD that changes the model
  lists which are affected; they are never edited from this repo.

## Obsidian Facts That Shape the Schema (`CLAUDE.md` § Obsidian facts we tested)

- **Frontmatter links must be whole values** (`"[[Note|label]]"`). Obsidian rename-tracks
  them, even inside objects in lists; not a link embedded in a longer string.
- **Lists of objects stay top-level.** make.md shows nested ones as "[object Object]" and
  editing there loses data — hence flat `entry` / `branches` / `outcomes` / `awards`.
- **Unquoted `[[X]]` parses as a nested array**; `frontmatter.ts` folds it back.
- **Canvas keeps unknown node keys** on save (so the `generated` marker works) and drops a
  default `toEnd: "arrow"` (so `sameCanvas` compares canonically).
- **The Windows file watcher drops events** under bulk external writes; prefer writing through
  the plugin when Obsidian is open.
- **Bases API (Obsidian 1.14)** exists and can read object lists in formulas; see `CLAUDE.md`
  for the classes.

## Key Patterns

- **Derive, don't declare.** Resume, combat XP and running totals are derived. The DM dislikes
  implicit wiring (magic names, folder matching); a new rule reads explicit properties.
- **Opt-in regions.** Mission-note outputs fill a region only where the DM placed its markers,
  and warn otherwise.
- **Warn on prose/data disagreement, don't fix it.** The ledger's Encounter-line check is the
  precedent: the DM decides.
- **Propose schema changes before making them.** The DM wants to understand the data model.

## Deferred / Out of Scope Items

Do not propose these in a PRD unless the DM asks:
- **Builders reading through the Bases API** instead of Taleform's own parser ("Bases is our
  Postgres") — parked; needs design before code.
- **Arc Map and Campaign Map builders** — named (Story Map → Adventure, Arc, Campaign) but not
  designed; confirm the design with the DM first.
- **Visual tweaks to the Adventure Map** — deferred while the data model settled.
- **Generating a beat's hand-written RUN CARD XP line as a region** — undecided.
- **Community-plugin release** (`versions.json`, release workflow) — not set up.
