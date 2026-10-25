# Taleform

Declarative storytelling infrastructure for Obsidian. You describe a campaign in typed
frontmatter: missions, beats, branches, awards. Taleform builds the resources you read
from it: navigation headers, Adventure Maps (canvas), ledgers. As with Terraform, the
declarations are the source of truth, and everything generated can be rebuilt at any time.

## Model

- A **mission** is a note with `kind: mission`.
- Its **members** are every note whose `mission` property links to it. Membership is the
  link, never the folder.
- Sequence notes (`kind: act | beat | scene | combat | challenge`) are ordered by `act` and
  `beat` and chained by `prev` / `next`.
- **Builders never write frontmatter.** Frontmatter is source only, so a build can never
  feed back into itself.

## The typed model

| On | Property | Meaning |
|---|---|---|
| mission | `kind: mission`, `party-size`, `party-xp`, `handoff` | the mission; `party-xp` is XP each *now*, and every running total counts from it |
| beat | `mission`, `kind`, `act`, `beat`, `beat-status`, `prev`, `next`, `optional` | the sequence |
| beat | `awards`: a list of `{xp, type, for, per, max, note}` | typed XP (`type` is `story` or `optional`) |
| beat | `entry`; `branches`: `{to, label}`; `outcomes`: `{if, then, to}` | what the map draws beyond the main line |

- **Combat XP** is never typed. It is read from a beat's `encounter` code block and each
  creature's stat-block `cr`.
- **Resume** is derived: the furthest beat touched if it is `partial`, else the first planned,
  non-optional beat after it.
- **Lists of objects stay top-level**, because editors render nested ones as "[object Object]".
- **Links are whole values**, so Obsidian tracks renames.

## Builders (run order)

| id | Output |
|---|---|
| `schema` | nothing: validates story frontmatter and names retired properties |
| `navigation` | each sequence note's two-line header and its `## Next` footer |
| `awards` | the AWARD XP callouts under each beat's H1 |
| `resume` | the mission note's `%% taleform:resume %%` region |
| `ledger` | the mission note's `%% taleform:xp %%` region; warns when an Encounter line disagrees with its block |
| `adventure-map` | `<Mission> — Adventure Map.canvas`: one card per beat, branches, IF cards, XP, resume, hand-off |

- **Generated text in notes** lives between `%% taleform:<id> %%` markers.
- **Generated canvas items** carry `"generated": "adventure-map"`.
- **Everything else is the author's** and is never touched. Dragged positions survive a rebuild.

## Running

- **In Obsidian:** commands *Taleform: Build everything* and *Check*. It rebuilds
  automatically after a note's metadata changes (toggle with *Toggle building on change*).
  Scripts can call `app.plugins.plugins.taleform.run(options, write)`.
- **Headless:** `node dist/cli.cjs build|check [--vault dir] [--mission name] [--relayout] [--threads] [--json]`.
  `check` changes nothing and exits 1 when anything is stale or invalid.
- **Git hook:** `taleform pre-commit` builds, then stages only the outputs that cannot drag
  unrelated work along: a map, or a note that was already in the commit and has no other unstaged
  edits. It never blocks a commit. `npm run deploy -- <vault> --hooks` installs it.
- **Claude Code hook:** `claude-hook.mjs`, shipped in the plugin folder, rebuilds after an agent
  edits a note while Obsidian is closed, and reports build errors back to the agent. Register it
  in the vault's `.claude/settings.json` (the command is in the file's header).

Both hooks run the CLI deployed in the vault's plugin folder
(`.obsidian/plugins/taleform/cli.cjs`); `TALEFORM_CLI` overrides it.

## Development

```
npm install
npm run check                          # typecheck + tests + bundle + test-vault parity check
npm run build:vault                    # rebuild test-vault/ after a change to generated output
npm run deploy -- [<vault>] [--hooks]  # install the plugin, CLI and Claude hook (default: test-vault)
```

`test-vault/` is a small fictional campaign covering every builder, committed with its generated
output. A change that alters output shows up as a diff there, for review.
