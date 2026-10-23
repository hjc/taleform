# Authoring Removal / Carve-Off TDD Plans

A removal (or carve-off) plan RIPS OUT existing behavior instead of adding new
behavior. Its failure modes differ from a feature plan's: the traps are
atomic-ordering (broken intermediate states), test-surgery (reversing tests that
already pass), dead-code cleanup, and generated output that outlives the builder that
wrote it. Load this doc when the task is a removal, a feature carve-off/park, or
reversing a just-shipped behavior.

## The red→green vehicle for a removal

You cannot lead a removal with a behavioral test that passes either way. The vehicle is:

1. **Delete** the tests that pin the OLD behavior.
2. **Add** a test asserting the NEW invariant that fails NOW — `expect(BUILDERS.map((b) => b.id)).not.toContain("x")`, `expect(text).not.toContain("%% taleform:x %%")`, a canvas with no node carrying the removed element. Not a behavioral test that passes before and after.

**Watch for the exact inverse.** A removal's new test is often the literal negation
of a test whoever added the feature wrote ("draws the X card" → "draws no X card").
Grep for it: one of the two must be deleted, and it won't fail loudly — it will just
contradict.

**The vehicle is scaffolding — delete it in a Refactor Phase in the same commit.** The invariant test above is required to make the removal red→green, but `/pr-tidying` Category B deletes exactly these shapes on sight: absence tests, registration tests ("`BUILDERS` is exactly these ids"), and directory-listing introspection. Both rules are right; they describe different moments. Category B states the resolution: *"where there is none, the rule belongs in `CLAUDE.md` § Invariants, a reviewing rule, or a Category A check of this pass — not a test."* So every plan whose red phase asserts structure rather than behaviour must (a) say "scaffolding" in the test's name or a comment and in the plan, so the executor does not ship it, and (b) name the durable home for the rule it stood in for — a context doc, `CLAUDE.md`, or a reviewing rule.

## Atomic-ordering traps (broken intermediate states)

Splitting a removal across steps can leave an intermediate state that doesn't
typecheck, breaks a later builder, or emits the same output twice. Land these together
in ONE step:

| # | Trap | Rule |
|---|------|------|
| 1 | Remove a builder, but a later builder still `ctx.read`s a path it emitted | Land the removal and every reader's change in the SAME step. Otherwise the reader silently falls back to disk content and the suite may stay green on stale text. |
| 2 | Remove an exported helper from `src/core/`, but its importers change in a later step | Land the removal and every importer together; `tsc` fails `npm run check` in between, and Vitest (which does not typecheck) may report something unrelated. |
| 3 | MOVE an output from builder A to builder B (a callout, a region, a canvas element) | Land the B-add and the A-remove in ONE step with combined red tests — emitting it from both is a "double output" intermediate: later builders read earlier builders' output through the overlay, so B edits a note that already carries A's copy. The behavior is atomic even though each file edit is separately testable. |

## Dead-code cleanup after a removal

- **Grep the callsite for now-dead locals.** A variable assigned solely to feed the removed call becomes dead — remove it too; grep confirms no other use.
- **Narrowing an over-broad filter: audit the NEGATIVE path before removing it.** A bug where "X is wrongly excluded" tempts a bare removal, but the exclusion often also (correctly) protected a negative case (an act note, an optional beat, a non-story note with a `kind`). Fix value-aware and FAIL-CLOSED (claim only the affirmative variant), and write a baseline-green guard test pinning that the negative case stays excluded.
- **Removing code does not remove what it already wrote.** The DM's vault still holds every region, callout and canvas item the removed builder generated. Decide in the plan, and state it as a design decision: either leave the orphaned output for the DM to delete (and say so in the PR), or ship a cleanup — `setRegion` with empty content removes a region; canvas items carrying the old `"generated"` value can be dropped — with a test that hand-made content beside it survives. Never leave the choice implicit.
- **Removing a frontmatter property is a retirement.** Add it to `RETIRED` in `src/builders/schema.ts` with what replaces it (or `"nothing: …"` with the reason, as `resume` has), and test that a note still carrying it gets that error. Never drop support silently (`CLAUDE.md` § Invariants 4).

## Test surgery (reversing tests that already pass)

- **A mixed `describe` block must be split, not gutted in place.** If a block mixes tests for the removed feature with tests for a KEPT sibling behavior, rename it to reflect what remains and show the reduced block whole, not a pile of delete-diffs — the executor gets one clean artifact.
- **Reversing a just-shipped behavior = a test-surgery TABLE, not new tests.** When the plan reverses behavior that already has passing tests, grep the test files for the behavior's emitted literals FIRST, then enumerate each old test as DELETE / REWRITE / KEEP-retarget in a dedicated Callsite-Swaps table. This churn is expected and pre-approved; "test churn" is never grounds to water down an approved change.
- **Fixture helpers outlive their tests.** After deleting tests, check whether a fixture helper parameter (`extra`, `body`, a stat-block note) is still used by anything; `tsc` does not flag an unused parameter or an unused fixture file here, so grep.

## Parked carve-off (removing to a holding area, not deleting outright)

- Park durable design notes under `docs/features/<feature>/parked/` with `cp`, not `mv` — the tree originals get `git rm`'d later, so the parked copy needs independent provenance.
- Do NOT copy source code. The removal commit in git history is the durable backstop; a `RESTORE.md` map (files → what was removed + commit hash) guides re-integration.
