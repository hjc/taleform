# C + D. Test Overlap, Consolidation and Speed

**Findings file:** `.tmp/pr-tidying-findings-test-structure.md`
**ID prefix:** `C1`, `C2`, … for overlap and speed; `D1`, `D2`, … for consolidation
**Read-set:** every test file the branch added or changed, PLUS the sibling test files under `test/` and `test/memoryVault.ts` — a consolidation target is by definition not in the diff. Read the neighbours' fixture setup, not just their names.

Three questions over one read-set: does this branch's new suite say the same thing twice (C), does it pay for things a `MemoryVault` makes free (C, speed), and does it need this many files and helpers to say it (D). All concern the branch's OWN new tests — never restructure a pre-existing suite.

The house shape (`CLAUDE.md` § Architecture): **builder tests go through `build()` on a fixture vault**, built from `MemoryVault` and `note()` in `test/memoryVault.ts`. Tests sit in `test/core.test.ts`, `test/model.test.ts` and `test/builders.test.ts`, grouped by `describe` per builder or core module.

## C. Overlap and redundancy

**Flag:**
- A test that is a strict subset of another (same fixture, fewer assertions).
- Tests with different names but identical fixtures and assertions.
- Tests covering the exact same code path with trivially different inputs (`beat-status: planned` vs `partial` when the code does not branch on it).
- A second idempotency test for a builder whose `describe` already has one — `build` then `build(v, BUILDERS, {}, false)` reporting `[]` covers every builder in the run.

**Do not flag:**
- Tests that share a fixture but exercise genuinely different behavior or edge cases.
- Tests that enter through different entry points (a `src/core/` function directly vs the builder that consumes it through `build()`).

## C. Speed

The suite runs on every `npm run check`. Keep it in-memory.

**Flag:**
- A test touching the real filesystem (`node:fs`, `os.tmpdir()`, `mkdtemp`) where a `MemoryVault` would do.
- A test that spawns `dist/cli.cjs` or any child process, or that depends on `dist/` existing. It runs before the bundle in `npm run check`, so it tests a stale build or none.
- A test that reads a DM's vault, or any absolute path on the developer's machine. It fails for anyone else and on a clean checkout.
- Real timers or sleeps (`setTimeout`, a debounce waited out) where `vi.useFakeTimers()` would do.

**Do not flag:** a fixture that is large because the behavior needs it (a mission with several acts to exercise layout).

## D. Boilerplate consolidation

**Flag:**
- A new test file with 1–3 tests whose fixture setup is shared 80%+ with an existing file. The target must already build that fixture (or one it can extend with a property).
- A new hand-rolled `VaultIO`, fixture-note builder, or frontmatter string templater duplicating `MemoryVault` or `note()`. Use the shared ones; extend `test/memoryVault.ts` only when the new need is general.
- A builder test that calls a builder's `run(ctx)` with a hand-made `BuildContext` instead of `build()` on a fixture vault — the hand-made context skips the engine's overlay and diff, which is what the test should exercise.
- Sibling test files whose names differ by one character (`builder.test.ts` / `builders.test.ts`). Merge them into one, whatever their size.

**Do not flag:**
- A test file whose fixture setup no neighbour shares.
- A test file with 4+ substantive tests — large enough to justify its own file, unless its name differs from a sibling's by one character.

**When merging:** move the tests into the existing `describe` block, carry over any fixture unique to the source, delete the source file, and verify the target's pre-existing tests still pass.

## Report shape

| # | File | Test(s) | Issue | Action |
|---|------|---------|-------|--------|
| C1 | `test/builders.test.ts` | `"ledger is idempotent"` | Subset of the run-wide idempotency test | Delete |
| C2 | new `arcMap.test.ts` | `"writes the canvas"` | Writes to `os.tmpdir()` | Use `MemoryVault` |
| D1 | new `arcMap.test.ts` | 2 tests | Builds the same mission fixture as `builders.test.ts` | Merge into a new `describe("arc map")` there; delete source |

Every `D` finding names the **target file** and confirms it already has the fixture — a merge into a file that must first grow new setup is not a consolidation and is not flaggable. The one-character sibling rule is exempt: merge those whatever their setup.
