# L. Type Completeness

**Findings file:** `.tmp/pr-tidying-findings-typing.md`
**ID prefix:** `L1`, `L2`, …
**Read-set:** every `.ts` file under `src/` the branch changed (`.tmp/pr-tidying-diff-src.txt`) and `tsconfig.json`. Read the current file to confirm a line before reporting it.

`tsc --noEmit` runs `strict` with `noUncheckedIndexedAccess`, so it catches what is wrong. This audit catches what is *weakened*: code that compiles because a type was widened or an assertion told the checker to stop looking.

## What to flag

- **`any`** written anywhere in new code: an annotation, `as any`, `any[]`, `Record<string, any>`, a generic defaulted to `any`.
- **A non-null `!` papering over `noUncheckedIndexedAccess`** — `arr[i]!`, `map.get(k)!` — where a local, cheap alternative exists: iterate `entries()`/`values()` instead of keys-then-`get`; destructure with a guard (`const first = order[0]; if (!first) return;`); `?? fallback`; `for…of` instead of an index. Name the alternative in the finding.
- **A type assertion that bypasses checking** — `as unknown as T`, or `as T` on a value parsed from outside (`JSON.parse`, `yaml`'s `parse`, frontmatter, `loadData()`) with no runtime check behind it. Frontmatter is `unknown` until a helper (`str`, `list`, `truthy`, `parseLink`) or the schema builder narrows it.
- **`@ts-ignore` / `@ts-expect-error`** in `src/`.
- A function the branch exported or rewrote with an implicit return type that leaks a wide or accidental type (a union with `undefined` the callers do not handle, an inferred object literal standing in for a named interface).
- A record standing in for a named shape — `Record<string, unknown>` or a positional tuple of 3+ related values passed between functions — where an `interface` names its fields (`Award`, `Combat`, `Problem` are the precedent).
- A container typed wider than what it holds (`string[]` where every element is a `beat-status`; use the `STATUSES` union).
- In `tsconfig.json`: a strict flag removed or turned off, `noUncheckedIndexedAccess` dropped, or `skipLibCheck`-style escapes added for project code.

## What NOT to flag

- `!` in `test/` on a fixture lookup (`v.files[path]!`): a wrong path fails the test either way.
- `!` where the alternative is a restructure rather than a local edit — note it, do not flag it.
- An `as` narrowing the DOM or the Obsidian API needs where the library types are wider than the runtime value (`as Partial<Settings> | null` on `loadData()` merged over `DEFAULTS`).
- Code the branch did not add or rewrite, even in a file it touched.
- Inferred types on locals and non-exported helpers that are already precise.

## Report shape

| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| L1 | `src/builders/adventureMap.ts` | 61 | `beats.get(s)!.act` over `[...beats.keys()]` | Iterate `beats.entries()` |
| L2 | `src/core/story.ts` | 120 | `const raw = parse(text) as Award[]` | Validate through `awardsOf`'s checks; keep `unknown` until narrowed |
