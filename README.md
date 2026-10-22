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

## Builders

| id | Output |
|---|---|
| `navigation` | each sequence note's two-line header and its `## Next` footer |
| `adventure-map` | `<Mission> — Adventure Map.canvas`: one card per beat (its H1 over its `^card` block), branches, IF cards, XP, resume, hand-off |

Generated canvas nodes carry `"generated": "adventure-map"`. Anything you add by hand on
the canvas is kept, and dragged positions survive a rebuild.

## Running

- **In Obsidian:** commands *Taleform: Build everything* and *Check*. It rebuilds
  automatically after a note's metadata changes (toggle with *Toggle building on change*).
  Scripts can call `app.plugins.plugins.taleform.run(options, write)`.
- **Headless:** `node dist/cli.cjs build|check [--vault dir] [--mission name] [--relayout] [--threads] [--json]`.
  `check` changes nothing and exits 1 when anything is stale or invalid, so it can gate a commit.

## Development

```
npm install
npm run check                 # typecheck + tests + bundle
npm run deploy -- <vault dir> # copy main.js + manifest.json into <vault>/.obsidian/plugins/taleform
```
