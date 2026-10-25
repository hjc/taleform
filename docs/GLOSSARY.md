# Glossary

The terms Taleform's docs, plans and code use, each with one meaning. Load this before writing or reviewing any doc, plan or PR body (`CLAUDE.md` mandates it). When a word is used two ways, fix it here first (`domain-modeling`).

## People

| Term | Means | Not |
|---|---|---|
| **developer** | Whoever works on Taleform in this repo: writes PRDs, approves plans, reviews and merges PRs. The human at every gate in `docs/sdlc.md` | the DM, even when the same person is both |
| **DM** | Taleform's end user: a Dungeon Master who keeps a campaign in an Obsidian vault and reads what Taleform generates. Use it only for end-user needs, behaviour and data | the developer |
| **author** | The DM in their role of writing notes. "The author's text" is anything a builder must not touch (invariant 2) | the developer |
| **adopter** | A DM other than the developer who installs Taleform. There are none yet; `src/` stays free of vault-specific names so there can be | — |

## Vaults

| Term | Means |
|---|---|
| **vault** | An Obsidian vault: a folder containing `.obsidian/`. The CLI finds it from `--vault` or by walking up from the working directory |
| **test vault** | `test-vault/`, committed in this repo. A small, fictional campaign covering every builder. Its generated output is committed too, so `npm run check` fails when a change alters output that was not rebuilt and reviewed |
| **a DM's vault** | Any real campaign vault. Taleform's sessions never edit one unless the developer asks. Machine-specific vault paths belong in `CLAUDE.local.md` (gitignored), never in a tracked file |
| **plugin folder** | `<vault>/.obsidian/plugins/taleform/`. `npm run deploy` installs `main.js`, `manifest.json`, `cli.cjs` and `claude-hook.mjs` there |
| **vault hooks** | The DM's vault's git `pre-commit` hook and Claude `PostToolUse` hook. Both run the CLI from the plugin folder (`TALEFORM_CLI` overrides it), so its flags and `--json` shape are a public interface |

## Story model

| Term | Means |
|---|---|
| **frontmatter** | A note's YAML properties: Taleform's only input. Builders never write it |
| **mission** | A note with `kind: mission`. Its **members** are the notes whose `mission` property links to it, never the notes in its folder |
| **sequence note** | A member whose `kind` is `act`, `beat`, `scene`, `combat` or `challenge`, ordered by `act` and `beat` and chained by `prev` / `next` |
| **beat** | Loosely, any sequence note; strictly, `kind: beat` |
| **award** | One typed XP entry in a beat's `awards` list (`type: story` or `optional`). Combat XP is never an award; it is derived |
| **combat XP** | Derived from a beat's `encounter` block and each creature's stat-block `cr` |
| **stat block** | A note with `statblock: true` and a `cr`, named by an `encounter` block |
| **resume** | The beat to start the next session from. Derived from `beat-status`, never declared |
| **hand-off** | Where a mission leads: the last beat's `next`, plus the mission's `handoff` text |

## Generation

| Term | Means |
|---|---|
| **builder** | A `{id, description, run(ctx)}` in `src/builders/`, run in `BUILDERS` order |
| **generated output** | Everything a builder emits: region text, a sequence note's header and `## Next` footer, and canvas items marked `"generated": "<builder id>"` |
| **region** | Generated text between `%% taleform:<id> %%` and `%% /taleform:<id> %%` |
| **Story Map** | The umbrella term for generated canvases. An **Adventure Map** covers one mission (built); **Arc** and **Campaign** Maps are named but not designed |
| **parity check** | `node dist/cli.cjs check --vault test-vault`, run by `npm run check`: exits 1 if the test vault's committed output is stale |

## Delivery

| Term | Means |
|---|---|
| **PRD** | The developer-approved spec for one feature, with its slice list (`prd-writing`) |
| **slice** | One reviewable unit of a PRD: one TDD plan, one branch, one PR |
| **stack** | A chain of slice branches, each based on the one below |
| **vault gate** | A slice whose output must reach a DM's vault (a schema rename, a hook-facing CLI change) before the slices above it can be built |
| **segment / landing point** | The run of slices a vault gate closes, and its top branch, whose PR lands the segment on `main` |
