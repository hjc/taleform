# E. Algorithm Inefficiency

**Findings file:** `.tmp/pr-tidying-findings-efficiency.md`
**ID prefix:** `E1`, `E2`, …
**Read-set:** production code the branch added or changed under `src/`. Read the surrounding function, not just the diff hunk: the second scan that makes a pattern O(N²) is often outside the changed lines.

Code on the order of O(N)+ where a simple O(1) cache, lookup table, or set operation would suffice.

Why it matters here: the plugin rebuilds the whole vault on a 1500 ms debounce after every metadata change (`CLAUDE.md` § Architecture), so a builder's cost is paid while the DM types. N is the vault's note count, not a mission's beat count.

Flag only where the fix is unambiguous and local. A restructure that changes a function's contract is out of scope — file it with `issue-creating`.

## What to flag

- Repeated linear scans of the same collection within a loop — `index.notes`, a `sequence(...)` result, an `awardsOf(...)` list.
- Calling an O(N) `StoryIndex` query inside a loop over notes when its result does not change per iteration: `members(mission)` and `missions()` each walk every note (and `members` resolves a link per note). Hoist it out of the loop, or build a `Map` once.
- Recomputing a pure derivation per caller in the same builder run — `sequence(index, mission)`, `combatOf(...)` — inside a loop, when one call before the loop serves every iteration.
- Building a list via `push` inside a loop, then scanning it again with `includes`/`find` in the same scope, when a `Set`/`Map` would eliminate the second scan.
- Re-parsing text the index already parsed: `parse` from `yaml` or `splitFrontmatter` over a note's text where `note.fm` holds the result.
- `[...map.keys()]` then `map.get(k)` per key, where iterating `map.entries()` or `map.values()` gives both at once (it also removes the `!` Category L would flag).

## What NOT to flag

- Code where N is a static constant known at write time (iterating `STATUSES`, `SEQ_KINDS`, the level table).
- A per-mission scan of that mission's own beats — dozens, not thousands.
- `sha1` per generated id: ids must be computed, and the inputs are short.

## Report shape

| # | File | Line | Pattern | Action |
|---|------|------|---------|--------|
| E1 | `src/builders/adventureMap.ts` | 40-52 | `index.members(m)` inside `for (const n of index.notes.values())` | Build `Map<mission, Note[]>` once before the loop |
| E2 | `src/builders/ledger.ts` | 88 | `sequence(ctx.index, mission)` per award row | Compute once per mission, pass it in |
