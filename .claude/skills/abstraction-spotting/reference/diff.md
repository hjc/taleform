# Diff mode

**When:** `docs/sdlc.md` §4 step 7, once per slice, after `tdd-executor` has built the TDD plan and committed it, and before the step-8 branch review and `/pr-tidying`.

**Input:** the brief names the parent branch (`main`, or the branch below in a stack). The subject is `git diff <parent>...HEAD`. Read the source around each hunk, and the callers of anything the diff adds. The plan and the PRD are context only: the built code is what you judge. Git is read-only: `diff`, `log`, `show`, `grep`. Against the live vault, only the read-only `check` is allowed.

**No cap.** Every finding still clears the bar. Rank them.

**Weight the shapes that only the built code shows:**

- **A:** count hand-written clauses across the **whole diff**, including tests and fixture vaults. A plan adds one site per step, so only the diff shows N. Pay most attention to raw `n.fm[...]` reads and act/beat/status logic in `src/builders/` that `src/core/story.ts` already expresses.
- **D:** every new `nid(...)` call and region id. For each input, ask whether it is stable when nothing in the notes changed, and when the DM reorders a list.
- **I:** every new builder, exported helper and `src/core/` primitive. List what each adopter in the diff did beyond implementing `Builder` (its `BUILDERS` position, the mission-selection loop, the `generated` marker, an `nid` namespace, the hand-item merge, a `same` comparator, a `RETIRED` or schema entry), and every convention of the DM's vault the diff reads without the schema declaring it.
- **J:** enumerate every branch, option and exception comment the diff adds in or beside one of the repo's own primitives: the engine and its overlay, `BuildContext`, `StoryIndex`, `regions.ts`, `canvas.ts`, `frontmatter.ts`, `VaultIO`, `BUILDERS` order; the list is not closed. For each, ask whether the primitive already has an extension point or could take an option. Grep the diff's comments for the exception phrasing: *instead of*, *unlike*, *does not apply*, *cannot use*, *workaround*, *rather than*.
- **K:** mechanisms the diff justifies by citing `CLAUDE.md` or a skill. Look for a check of this case behind each.
- **Builders (A, I, J):** the same layout, canvas-merge or region-filling block repeated across builders, or a builder importing it from a sibling builder's module, is a primitive the diff has not extracted into `src/core/`. Count the copies across the whole diff, as for A.

**A clean pass must show its counts.** On a diff that adds a builder or a `src/core/` primitive, "no findings" must state the adoption steps per adopter and the hand-written clauses per rule it counted. Without them, a clean pass cannot be told apart from a shallow one.

**Findings go to:**

| Route | Where |
|---|---|
| Build-in-slice | The orchestrator dispatches `tdd-executor` to apply each finding as its own `refactor:` commit, with `npm run check` green, before the step-8 review |
| Contract amendment | A proposed amendment to the PRD's cross-cutting contract, which goes to the step-3 gate. Nothing is built |
| Rule amendment | Build the plain version as a `refactor:` commit; propose narrower wording for the rule in the decision log |

Write each build-in-slice finding so that the executor can act on it without re-deriving it: the files, the construct to introduce, and the sites it replaces. A refactor that moves code must leave generated output byte-identical; say so, so the executor confirms with the parity check.

**Report:** `.claude/reviews/<branch-key>.diff.taleform-abstraction-spotter.md`, where `<branch-key>` is the branch name with `/` replaced by `-`.
