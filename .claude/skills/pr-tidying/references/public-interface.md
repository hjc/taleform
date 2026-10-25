# G. Public Interface & Generated-Output Stability

**Findings file:** `.tmp/pr-tidying-findings-public-interface.md`
**ID prefix:** `G1`, `G2`, …
**Read-set:** the `src/` diff (`.tmp/pr-tidying-diff-src.txt`), the parity output (`.tmp/pr-tidying-parity.txt`), the branch's diff under `test-vault/`, `CLAUDE.md` § Invariants and § Obsidian facts we tested, and `docs/sdlc.md` §1 and §3. **At a landing point, the whole segment** — `git diff <segment base>..HEAD -- src/` rather than `<parent>..HEAD` — because the segment lands on `main`, and reaches a DM's vault on their next deploy, as one change.

Taleform has no deployed environments, but it has contracts other things depend on (`docs/sdlc.md` §1): the DM's notes depend on the frontmatter schema, the vault's hooks depend on the CLI, and every generated file depends on stable ids and markers. This audit asks one question: **does this branch change any of them, and is each change intended, compatible, and recorded?**

## The surfaces

| Surface | Where it lives | Who depends on it |
|---|---|---|
| Frontmatter schema | every `fm[...]` / `fm.<key>` read in `src/`; `RETIRED` and the checks in `src/builders/schema.ts`; `README.md` § The typed model | The DM's notes; another DM's notes |
| CLI | `USAGE`, the argv loop and exit codes in `src/cli/main.ts` (0 ok, 1 errors or stale on `check`, 2 usage); the `--json` shape, which is `BuildResult` (`src/core/engine.ts`) with `Problem` (`src/core/builder.ts`) | A DM's vault hooks: git `pre-commit` and the Claude `PostToolUse` hook `claude-hook.mjs`, both running `cli.cjs` from the plugin folder |
| Plugin folder | the files `scripts/deploy.mjs` installs into `<vault>/.obsidian/plugins/taleform/` (`main.js`, `manifest.json`, `cli.cjs`, `claude-hook.mjs`) | A DM's vault hooks, which look for the CLI there; a renamed or dropped file breaks them |
| `pre-commit` | `preCommit` in `src/cli/main.ts` | The DM's commits (invariant 5) |
| Plugin scripting | `run(options, write, loud)` and the persisted `prefs` keys in `src/plugin/main.ts`; command ids | Vault scripts calling `app.plugins.plugins.taleform.run(...)`; the DM's saved settings and hotkeys |
| Generated-output identity | `nid(...)` inputs, region ids passed to `setRegion` (`awards`, `resume`, `xp`), the `generated` marker (`MARK`), the sequence header and `## Next` footer format, output paths (`<Mission> — Adventure Map.canvas`) | Every generated file in a DM's vault, and in `test-vault/`: a change re-writes all of them |

## What to flag

- **A frontmatter property renamed, removed, or retyped with no `RETIRED` entry** naming its replacement (invariant 4). Also a `RETIRED` entry the branch deleted. The fix is the entry; support is never dropped silently.
- **A frontmatter shape that breaks a tested Obsidian fact**: a list of objects nested under another key (lists of objects stay top-level), or a link expected inside a longer string (links must be whole values, `"[[Note|label]]"`).
- **A builder that writes frontmatter** (invariant 1) — any emitted text that differs from disk above `note.fmEnd`.
- **A write outside generated text** (invariant 2) — text outside region markers, the sequence header and `## Next` footer; or a canvas merge that drops or moves an item not carrying the `generated` marker, or a generated item emitted without it.
- **Nondeterministic output** (invariant 3) — `Date.now()`, `Math.random()`, iteration order over unsorted `io.list()` results or object keys reaching emitted text, locale-dependent formatting without an explicit locale (`fmt` pins `"en-US"`; follow it).
- **A new builder or new emitted output with no idempotency assertion** in `test/` — a `build` followed by a second `build` reporting 0 changes over a fixture that exercises the new output.
- **A generated-identity change** — a `nid(...)` input, a region id, the `MARK` value, a header/footer format, an output path — that the parity check or the regenerated `test-vault/` diff shows and the branch does not state as intended. Every existing map or region churns on the next build, and a renamed region id leaves the old region orphaned in every note. Intended changes are not findings; they are reported under **Parity** below.
- **A CLI break** — a flag removed or renamed, an exit code's meaning changed, a field removed or renamed in the `--json` output, or `pre-commit` made able to block or to stage something invariant 5 forbids. Flag it unless the PRD's slice list marks this slice a vault gate for exactly that change (`docs/sdlc.md` §3).
- **A plugin scripting break** — `run`'s parameters reordered or retyped, a `prefs` key renamed (the saved value is lost on load), a command id renamed (hotkeys bound to it break).

## Parity

Read `.tmp/pr-tidying-parity.txt` and the branch's diff under `test-vault/`. Expected: "up to date", and no regenerated test-vault file unless the branch means to change output. For every stale or regenerated file, report a row: the file, the builder, and whether the branch's intent explains it.

- An unexplained change is a finding above.
- An explained one goes in the PR body. It is an **open question for the developer** when a DM must rebuild their vault after deploying (`docs/sdlc.md` §3 → After merging).
- If the parity file is absent, the branch did not touch `src/`; say so.

## Affected vault docs

When the branch changes the model — the frontmatter schema, what a builder generates or how it reads, the CLI, or the plugin folder — list what a DM must change in their own vault: notes to migrate, templates, hook setup, and any docs of theirs that describe the model. **Never edit a DM's vault, and never open a finding to edit it**; the list goes to the developer and into the PR body. In-repo docs (`README.md`, `docs/GLOSSARY.md`, the test vault's templates) are Category H's to update.

## What NOT to flag

- An additive change: a new optional frontmatter property, a new CLI flag, a new field in the `--json` output, a new region id, a new builder appended to `BUILDERS`. These still go on the affected-vault-docs list when they change the model.
- A refactor the parity check shows as identical.
- A CLI or schema break the PRD marks as a vault gate for this slice — it is planned; confirm only that its `RETIRED` entry exists.

## Report shape

| # | Surface | Location | Change | Action |
|---|---------|----------|--------|--------|
| G1 | Frontmatter | `src/builders/schema.ts:18` | `handoff` renamed to `hand-off`; no `RETIRED` entry | Add `handoff: "hand-off"` |
| G2 | Generated identity | `src/builders/adventureMap.ts:80` | Edge `nid` now includes the color; parity shows every edge re-id'd | Drop color from the `nid` input |
| G3 | CLI | `src/cli/main.ts:124` | `--json` renames `problems` to `issues`; the vault hook reads `problems` | Keep `problems`, or mark the slice a vault gate |

Then two short blocks: **Parity** (one row per diff line: file, builder, explained by) and **Affected vault docs** (doc, what is now wrong).
