# B. LLM-Development Tests

**Findings file:** `.tmp/pr-tidying-findings-test-scaffolding.md`
**ID prefix:** `B1`, `B2`, …
**Read-set:** every test file the branch added or changed — `test/**/*.test.ts`, plus `test/memoryVault.ts` if it changed. Establish from the diff what is NEW, then read the current file in full — these families are recognised by shape, and a truncated read misses whole flaggable classes.

Tests that scaffold the development process rather than protect behavior. Five families below. Work family by family; do not generalise from one bullet to another. **Name the family in every finding** — the follow-through differs per family.

## What to flag

- **Absence tests** — assert behavior is GONE rather than that behavior is correct. Tells: a function or export does not exist; a removed builder id is absent from `BUILDERS`; a retired code path is no longer called (`expect(spy).not.toHaveBeenCalled()`); names like `"no longer …"`, `"removed …"`, `"drops the old …"` for something introduced on THIS branch; a whole `describe` whose sole purpose is asserting deleted code is gone.

- **Regression-guard / snapshot tests** — freeze a tunable value and assert it survives, exercising no behavior. A direct equality on a module constant (`expect(STATUS_COLOR.played).toBe("4")`, a layout width, the debounce interval, `STATUSES` deep-equaling a literal), or the same literal asserted passed into a call via a spy. Tells: the assertion restates a value production already defines; names like "exposes …", "declares …", "still uses …".

  **Match on the restatement, not the shape** — equality, membership (`toContain` over a constant table) and `typeof` checks all freeze the same thing.

- **Plumbing tests** — assert something the language, a dependency or the engine's own wiring guarantees by construction. The assertion holds for ANY correctly-declared builder and fails only on a rename. Tells: a builder's `id` or `description` equals a string; `BUILDERS` contains a builder or has a length (a registration test); `yaml`'s `parse` round-trips a value; a `Map`/`Set` built and read straight back; a bare "builds without throwing" on a fixture with no assertion on output.

- **Source-introspection tests** — assert how the code is WRITTEN, by reading source text at test time. No product code runs. Tells: `readFileSync`/`readdirSync` over `src/`, a regex or substring matched against a `.ts` file (`"core never imports obsidian"` as a grep), `Object.keys(await import(...))` asserting "the public surface is exactly these names". Two failure modes make these worse than they read: a **literal** pattern silently misses every spelling it did not anticipate, and a **substring** match invents hits that do not exist — so the true coverage is neither what the test claims nor visible from reading it.

  Replace with the behavior the structure stood in for. Where there is none, the rule belongs in `CLAUDE.md` § Invariants, a reviewing rule, or a Category A check of this pass — not a test. Import-layer rules are Category A's.

- **Documentation-content tests** — assert the text of a Markdown document in this repo: `README.md`, `CLAUDE.md`, a skill, a context doc. Tell: a test that opens a `.md` file outside a `MemoryVault` fixture, or asserts a doc mentions a builder id, flag or path. Delete it — this pass keeps docs in step with code, not the suite.

**When removing any of these:** delete a now-empty `describe` it was the last child of, trim an import it solely consumed, and **grep the production side** — a snapshot test is often the only reader of the export it froze, so an export nothing references once its assertion is gone goes with it.

## What NOT to flag

- **Assertions on generated text.** Generated output is Taleform's product: a test asserting the exact header line, region body, callout or canvas node a build writes (`toContain("> [!tip] Next → …")`) tests behavior, even though it reads like a literal.
- **Invariant tests** — a second `build` reports 0 changes; CRLF survives a build; a hand-added canvas card or a dragged position survives a rebuild; frontmatter is byte-identical after a build. These guard `CLAUDE.md` § Invariants.
- **Schema-problem tests** — a fixture with a retired or malformed property yields the expected `problems` entry. That is the `RETIRED` contract working, not a frozen constant.
- A function asserted NOT called where it genuinely should not be (no write when nothing changed) — real conditional behavior.
- Tests of a real rule even when constants appear (the 2024 XP table applied to a block of stat blocks; `nid(...)` returning the same id for the same inputs) — a contract, not a frozen value.

## Report shape

| # | File | Test | Family | Action |
|---|------|------|--------|--------|
| B1 | `test/builders.test.ts` | `"registers the arc-map builder"` | Plumbing | Delete |
| B2 | `test/core.test.ts` | `"core never imports obsidian"` (greps `src/core/*.ts`) | Source-introspection | Delete; the rule is Category A's and `CLAUDE.md` § Architecture's |
