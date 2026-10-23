# Plan mode

**When:** `docs/sdlc.md` §4 step 5, in parallel with `taleform-reviewer`, on every TDD plan, slice spec and PRD.

**Input:** the plan document, plus the source it touches. For a slice plan, read the PRD's cross-cutting contract too: the slice spec deliberately leaves it out. Open the code, follow imports outward to the callers, and count.

**Cap: at most three findings, ranked.** If you have five, you have not triaged.

**Weight the shapes that are expensive once built:** B, C, F, G, H and I. A plan fixes a `src/core/` signature, a frontmatter property or a builder's shape that every later step and slice inherits, and this is the cheapest point to move it. A frontmatter property is the most expensive of all: once the DM has typed it into notes, renaming it costs a `RETIRED` entry and a vault migration. Shape A and J sites are often split across steps. Count them across the whole plan, and expect the diff pass to catch the rest.

**A plan that is stale against source is not yours.** Its premise is already false, e.g. it extends a helper that has since moved into `src/core/`, or names a builder or property that has been retired. A stale plan never conformed. Report "no findings", state that the defect is out of scope, name the contradicting files and lines, and route it to `taleform-reviewer`. Do not stretch a shape to cover it.

**Findings go to:**

| Route | Where |
|---|---|
| Build-in-slice | A required amendment to the plan, applied by `tdd-planner` on re-dispatch |
| Contract amendment | A proposed amendment to the PRD's cross-cutting contract, which goes to the step-3 gate |
| Rule amendment | Narrower wording for the rule, proposed in the decision log |

**Report:** `.claude/reviews/<plan-basename>.taleform-abstraction-spotter.md`.
