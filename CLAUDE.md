# CLAUDE.md

**Taleform** is declarative storytelling infrastructure for Obsidian, named to echo Terraform: typed frontmatter is the source of truth, and builders generate everything the DM reads from it. One TypeScript core serves two runners: an Obsidian plugin and a headless CLI. `README.md` holds the user-facing model and builder table. Read it first; this file covers what it leaves out.

The author is the DM of a D&D 5e (2024) campaign, and their vault is the only real consumer so far. They want Taleform distributable, because another DM may adopt it. That means no vault-specific names or paths in `src/`; everything comes from frontmatter.

## Commands

```
npm run check                  # typecheck + vitest + bundle. Run before calling anything done
npm run dev                    # esbuild watch (sourcemaps only here)
npm run deploy -- "<vault>"    # copy dist/main.js + manifest.json into <vault>/.obsidian/plugins/taleform
node dist/cli.cjs check --vault "<vault>"   # exit 1 on stale output or schema errors; prints warnings
node dist/cli.cjs build --vault "<vault>" [--mission name] [--relayout] [--threads] [--json]
```

Toolchain: TypeScript 7 (strict, `noUncheckedIndexedAccess`), esbuild, Vitest, `yaml`, Node 22. The DM prefers the latest of everything.

## Architecture

- **`src/core/`** has no Obsidian imports, and must keep it that way, so the CLI stays headless.
  - `vault.ts`: the `VaultIO {list, read, write}` interface. Text is normalized to LF internally (`toLF`/`fromLF`).
  - `index.ts`: `StoryIndex`. It parses every note's frontmatter, then exposes `resolve`/`link` (basename or shortest path, like Obsidian), `missions()` (`kind: mission`) and `members(mission)`. Membership is the `mission` link, never the folder.
  - `story.ts`: the domain rules. These are sequence order, `resumeBeat`, typed `awards`, `combatOf` (encounter block × stat-block `cr` → 2024 XP table), the level table and `partySize`.
  - `engine.ts`: runs builders in order. Builders `emit(path, content)`; the engine diffs against disk and writes only real changes. `build()` returns `{changes, problems, written}`.
  - `regions.ts`: `%% taleform:<id> %%` … `%% /taleform:<id> %%` generated regions. `setRegion` with empty content removes the region.
  - `canvas.ts`: `sameCanvas` compares canonically, ignoring key order, formatting and the default `toEnd: "arrow"`. That is because Obsidian re-saves canvases in its own format.
  - `sha1.ts`: the hash behind deterministic node IDs (`nid(...)`, defined in `src/builders/adventureMap.ts`). These must stay stable across builds, or maps churn.
- **`src/builders/`**: `BUILDERS` in `index.ts` sets the run order: schema → navigation → awards → resume → ledger → adventure-map. A builder is `{id, description, run(ctx)}`. Add a new kind of builder here; the DM expects many (Arc and Campaign maps, and more).
- **`src/cli/main.ts`**: `FsVault` skips dot dirs and the Templates folder (from `.obsidian/templates.json`). It has the commands `build`, `check` and `pre-commit`.
- **`src/plugin/main.ts`**: `ObsidianVault` over `app.vault`. It debounces a 1500 ms auto-build on `metadataCache` "changed" (`prefs.autoBuild`) and shows status in the status bar. `run(options, write, loud)` is the scripting entry point. The setting is named `prefs`, because `settings` clashes with the Plugin base class.
- **`test/`**: `memoryVault.ts` is an in-memory `VaultIO`. Builder tests go through `build()` on fixture vaults.

## Invariants (do not break)

1. **Builders never write frontmatter.** Frontmatter is input only, so a build can never feed back into itself.
2. **Only generated text is touched:**
   - text between region markers;
   - a sequence note's two-line header (mission line, then `← prev • **this** • next →`) and its `## Next` footer;
   - canvas items carrying `"generated": "adventure-map"`.

   Anything else is the author's. Hand-added canvas cards and edges survive, and so do dragged positions unless `--relayout`.
3. **A rebuild is idempotent.** A second `build` must report 0 changes, and `check` on a freshly built vault must exit 0.
4. **The schema names the replacement for every retired property** (the `RETIRED` map in `schema.ts`). When a property is renamed, add it there; never drop support silently.
5. **Pre-commit never blocks.** It stages only a rebuilt canvas, or a note that was already staged and has no other unstaged edits. Everything else is printed and left alone, because the DM's tree is full of deliberate WIP.

## Obsidian facts we tested (they shape the schema)

- **Frontmatter links must be whole values** (`"[[Note|label]]"`). Obsidian tracks and rename-rewrites those, even inside objects in lists (key `branches.0.to`). It does not track a link embedded in a longer string.
- **Lists of objects stay top-level.** make.md's properties panel shows nested ones as "[object Object]", and editing there loses data. That is why `entry` / `branches` / `outcomes` / `awards` are flat top-level keys.
- **YAML `[[X]]` unquoted parses as a nested array.** `frontmatter.ts` folds it back to `"[[X]]"`.
- **Obsidian canvas keeps unknown node keys** on save, which is why the `generated` marker works. It drops a default `toEnd: "arrow"`.
- **The Windows file watcher drops events** when many files are written externally at once. Obsidian then shows stale embeds ("Unable to find ^card"). The vault's `.claude/scripts/obsidian-resync.js` re-feeds disk text through `app.vault.modify`. Prefer writing through the plugin when Obsidian is open.
- **Bases API (Obsidian 1.14):** `registerBasesView`, `BasesView`, `QueryController` (the undocumented `setQuery`/`runQuery`), `BasesEntry.getValue`, `ObjectValue`/`ListValue`. `prepareQuery` is fuzzy search only. Bases formulas can read object lists, for example `awards.filter(value.type != "optional").map(value.xp).reduce(acc + value, 0)`.

## The vault (live consumer)

- **Vault:** `C:\Users\hjc17\Documents\anima-automatum\Anima Automatum`. It is git-tracked, with its own `CLAUDE.md` and strict commit rules. **Never edit vault content from this repo's sessions** unless the DM asks. Taleform's job is to generate it.
- **Worked example:** `Story Beats/Post Bardo Intro/Missions/The Ashfall Seam/`.
  - The mission note carries `kind: mission`, `party-size: 6`, `party-xp`, `handoff`, and the `resume` and `xp` regions.
  - There are four act folders with 33 beat notes. Each beat has a `^card` block, which is what its Adventure Map card embeds.
  - `The Ashfall Seam — Adventure Map.canvas` sits beside them.
- **Parity check after any builder change:** run `npm run check`, then `node dist/cli.cjs check --vault "<vault>"`. Expect "up to date" with one known warning: 3.03's Encounter line says 14,700 XP against a block total of 12,040, which is the DM's call. Any other diff means the change altered output. Decide whether that is intended before running `build`.
- **Deploying:** `npm run deploy -- "<vault>"`, then reload the plugin in the running Obsidian through the vault's CLI client:
  ```
  node "<vault>/.claude/scripts/obsidian-cli.js" "vault=Anima Automatum" eval "code=..."
  ```
  An async eval returns empty output on success, so verify by reading state back. Before bulk-migrating vault notes, pause auto-build: `app.plugins.plugins.taleform.prefs.autoBuild=false` (in memory only; a reload restores it).
- **What else calls Taleform:**
  - The vault's `.git/hooks/pre-commit` runs `dist/cli.cjs pre-commit`.
  - The vault's `.claude/scripts/taleform-hook.mjs` is a Claude PostToolUse hook. It runs `build --json` only when Obsidian is closed and exits 2 on errors.
  - Both default to `D:/Code/personal/taleform/dist/cli.cjs` (override with `TALEFORM_CLI`), so **the CLI flags and the `--json` shape are a public interface**.
- **Vault docs that describe Taleform's model** must change when the model changes. They are `.claude/skills/encounter-building/references/story-maps.md` (the spec), `run-sheet-format.md`, `_tpl/Story Beat.md`, and the vault `CLAUDE.md` § Taleform. Tell the DM which ones are affected rather than editing them silently.
- Installed alongside: **Nested Properties** (editing objects in frontmatter) and **make.md**.

## Roadmap and open questions

- **Parked, but the DM cares:** builders should read through the **Bases API** rather than Taleform's own frontmatter parser, so a Bases format change can't desync them. "Bases is our Postgres." One idea is for the plugin to run `.base` queries and hand rows to builders, with the CLI delegating to the running plugin (or the plugin writing scratch views). It needs design before code.
- **Arc Map and Campaign Map builders:** they are named but not designed. Confirm the design with the DM before building. The terms are Story Map (the umbrella), then Adventure (one mission), Arc and Campaign.
- **Visual tweaks to the Adventure Map:** the DM deferred them while the data model settled, so expect them.
- **Undecided:** whether a beat's hand-written RUN CARD XP line should become a generated region.

## Working style

- The DM likes to understand the data model. Explain the rules (what derives what) when they ask, and propose before restructuring the schema.
- Prefer deriving to declaring. Resume, combat XP and running totals are all derived, and the DM explicitly dislikes implicit wiring (magic names, folder matching).
- Commit here with plain conventional messages. End each with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Windows plus Git Bash gotchas:
  - multi-line `python -c` fails;
  - heredocs or inline JS containing backticks break;
  - sed with `\n` in replacements mangles text.

  Use script files or the Write/Edit tools instead.

## Writing Context & Instruction Docs

Instruction and context files (`CLAUDE.md`, `docs/context/` docs, `SKILL.md`, agent definitions, `docs/**/*.md`) are read by LLMs. Optimize for precise retrieval, not rendering:

- **Keep (signal):** backticks around literals (paths, symbols, exact strings); Markdown tables for dense or relational data; headings and short bullets as retrieval anchors.
- **Drop (render chrome):** clickable links `[text](path)` (write the bare path); anchor-link tables of contents; HTML render tags.
- **Generated docs:** fix the generator, not the output file.
- **Right altitude:** an always-loaded `description` or index line carries only the trigger ("use when…") plus a one-line scope. The full workflow belongs in the body. Don't say the same thing twice.
- **Check length with `planr wordy`** (`node .claude/skills/html-planning/planr.js wordy <file>`) after writing or editing a doc; it exits 1 on any line it flags. Fix what it flags with the `context-compacting` skill.

The development loop, branch and stack rules, and the AI tooling are in `docs/sdlc.md`. Planning docs (features, issues, the roadmap) live under `docs/`, laid out in `docs/README.md`. **Context docs live in `docs/context/`**: search there for prior art before planning, reviewing or changing a tricky area.
