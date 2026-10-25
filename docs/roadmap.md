# PRD Portfolio & Roadmap

Code-aware index of the PRDs under `docs/features/`. For each PRD it records where it lives (file and branch), its status, the code it touches and what it depends on, so the build order respects dependencies. Read this first when deciding what to sequence next.

**Maintenance:** when a PRD is added, moved to a branch, approved or sliced into TDD plans, update its row here, and keep the dependency graph in sync. **Commit the update as you make it**, on whatever branch is in hand, with the `mapping:` prefix (`docs/sdlc.md` §3). An implemented PRD is deleted at effort close (`docs/sdlc.md` §4e), so it leaves no row here.

## PRD register

| PRD | File | Branch | Status | Scope |
|-----|------|--------|--------|-------|

## Dependency graph

No PRDs yet.

## Product ideas

Unscheduled directions. An idea authorizes nothing: it graduates to a PRD through the Discuss step (`docs/sdlc.md` §4, step 1) or is dropped. `CLAUDE.md` § Roadmap and open questions holds the current list: the Arc and Campaign Map builders, reading through the Bases API, Adventure Map visual tweaks, and whether a beat's hand-written XP line becomes a generated region.

More, beyond the Declarative Model effort (`docs/features/generic-data-model/`); the last two are scoped by issue docs:

- **A builder dependency graph.** Builders declare what they depend on; the engine orders them topologically and rejects cycles and unknown ids, so `BUILDERS` order stops mattering. Do it before the Arc and Campaign Map builders, the first that read another builder's output. Scoped in `docs/issues/builder-order-implicit-array-position.html`.
- **Sessions.** A fourth family (`docs/context/story-model.md`): the record of what happened at the table, which the DM's assistant reads to update beat state. A session might be notes or an audio recording, analysed and applied. Uncharted; ruled past the Declarative Model map.
- **Threads and Clues.** Foreshadowing and plots revealed across moments. They fit none of the three families, so the set stays open for a family of their own.
- **Generated arrangements.** The DM sketches one-line moments in an Act; the assistant fleshes them out and draws them from pools onto the graph by a fixed seed, so a one-shot changes with each generation yet reproduces from its seed. An authoring action on the recipe/instance model.
- **A configurable game system.** XP tables, levels and stat-block numbers come from config, so a system other than D&D 5e (2024), or a game developer sketching a story's shape, swaps the config, not the code.
- **Generalize away from one vault's conventions.** `src/` still bakes in the `^card` block, title glyphs, the `**Encounter:**` prose line, the AWARD callout and more. Each becomes mission frontmatter, a setting or a documented contract, so an adopter's vault builds right. Scoped in `docs/issues/vault-conventions-hardcoded-in-src.html`.
