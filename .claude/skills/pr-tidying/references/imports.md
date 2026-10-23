# A. Imports & Runner Boundaries

**Findings file:** `.tmp/pr-tidying-findings-imports.md`
**ID prefix:** `A1`, `A2`, …
**Read-set:** every `.ts` file the branch changed under `src/` and `test/`. Read the diff to establish what this branch added, and the current file to confirm line numbers and what it already imports.

One core serves two runners (`CLAUDE.md` § Architecture): the Obsidian plugin, bundled for `platform: "browser"` with `obsidian` external, and the headless CLI, bundled for Node. An import in the wrong layer either breaks a runner outright or works on desktop and fails on mobile. This audit polices the import graph.

## The layers

| Layer | May import | Must never import |
|---|---|---|
| `src/core/` | other `src/core/` modules, `yaml` | `obsidian`, `node:*` (or a bare `fs`/`path`/`child_process`), anything under `src/builders/`, `src/cli/`, `src/plugin/` |
| `src/builders/` | `src/core/`, other builders, `yaml` | `obsidian`, `node:*`, `src/cli/`, `src/plugin/` |
| `src/cli/` | core, builders, `node:*` | `obsidian`, `src/plugin/` |
| `src/plugin/` | core, builders, `obsidian` | `node:*`, `src/cli/` |
| `test/` | anything under `src/`, `test/memoryVault.ts`, `vitest` | `obsidian` (it cannot load outside the app) |

Builders run in both runners, so they are as headless as core. Reaching the vault goes through `VaultIO` (`src/core/vault.ts`) and `BuildContext` (`src/core/builder.ts`), never a runner's own file API.

## What to flag

- **A layer violation** from the table above, added by this branch. Name where the dependency belongs instead: a file read becomes a `VaultIO`/`ctx.read` call, a user notice becomes a `ctx.problem(...)` the plugin surfaces, a shared helper moves down to `src/core/`.
- **A new runtime dependency in `src/core/` or `src/builders/`** (a `package.json` `dependencies` entry the branch added and imports there) that touches the filesystem, the DOM or Node APIs. `yaml` is the precedent for what is fine: pure, synchronous, platform-free.
- **A deferred `await import(...)`** of a project module or a dependency, where a top-of-file import works. esbuild bundles both runners, so a dynamic import buys nothing and hides the dependency from this table.
- **An unused import** the branch added (`tsconfig.json` does not set `noUnusedLocals`, so `tsc` stays silent).
- **A duplicate import** — the same module imported twice in one file, or a symbol imported both as a value and through a separate `import type` of the same module. Merge into one statement with inline `type` (`import { build, type BuildResult } from "../core/engine"`), the repo's style.

An `import type` counts. It is erased at runtime, but the dependency direction is the rule: core and builders must typecheck with `obsidian` absent.

## What NOT to flag

- A builder importing a helper from another builder (`selectMissions` from `./navigation`) — builders may share.
- Imports in `esbuild.config.mjs` or `scripts/` — they are Node build tooling, not a runner.

## Report shape

| # | File | Line | Import | Action |
|---|------|------|--------|--------|
| A1 | `src/core/story.ts` | 3 | `import { Notice } from "obsidian"` | Report through `ctx.problem`; surface it in `src/plugin/main.ts` |
| A2 | `src/builders/adventureMap.ts` | 2 | `import { readFileSync } from "node:fs"` | Read through `ctx.read(path)` |
| A3 | `src/builders/ledger.ts` | 7 | `import { sha1 } from "../core/sha1"` unused | Delete |
