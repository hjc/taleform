---
name: abstraction-spotting
description: Check whether the convention a plan or a built diff follows is the right one for it, not whether it follows it. Use on a TDD plan, slice spec or PRD alongside `taleform-reviewer` (`plan` mode), and on a slice's committed build against its parent branch before `/pr-tidying` (`diff` mode).
---

# Abstraction Spotting

`taleform-reviewer` asks *"does this follow our patterns?"* You ask **"is the pattern right for this?"**, the question a conformance checker structurally cannot ask.

This is a **precision instrument, not a refactor generator.** Everything below exists to keep the false-positive rate near zero.

## Modes

The dispatch brief names the mode. **Read `reference/<mode>.md` before any finding**: it owns the input, the finding cap, where findings go and the report path. With no mode named, infer it from the target: a `.html` plan, spec or PRD → `plan`; a branch, commit range or PR → `diff`. State which mode you ran.

| Mode | Target | Reference |
|---|---|---|
| `plan` | A TDD plan, slice spec or PRD, at `docs/sdlc.md` §4 step 5 | `reference/plan.md` |
| `diff` | A slice's committed build, at `docs/sdlc.md` §4 step 7 | `reference/diff.md` |

Everything else in this file (the bar, the shapes, the meta-signals, routing and output) binds in both modes.

## The bar — every item must hold

A finding ships only if it satisfies **every** one of these. Clearing all but one is not a finding.

1. **It matches a named shape below.** Not "this feels wrong": the specific shape, named. If it matches nothing, it is not a finding; it is taste.
2. **The cost is named in a unit.** Builders touched per future change, generated files that churn per build, frontmatter properties the DM must keep by hand, vault reads per build, latent sites unwired, guards in shared code, and three more:
   - **Silent-omission clauses**: hand-written clauses every current and future builder must repeat, where leaving one out emits wrong-but-plausible output rather than reporting a problem.
   - **Adoption steps**: what the next builder (or the next DM adopting Taleform) must do beyond implementing the interface.
   - **Bypassed hooks**: an extension point of `src/core/` (the engine overlay, `emit`'s `same`, `setRegion`, `StoryIndex`, `VaultIO`) worked around rather than used.

   **"Cleaner", "more maintainable", "more idiomatic" are not units.** "Easy to forget" is, once counted as silent-omission clauses. If you cannot state the cost in something countable, drop it.
3. **The convention was followed.** If the plan violates an existing convention or a `CLAUDE.md` invariant, that is `taleform-reviewer`'s finding, not yours. Yours is the case where conformance *is* the defect, **including a rule that is itself the defect** (shape K). Question whether a rule fits; never report a plain violation of one.
4. **It is load-bearing now**, not on a hypothesis about future needs. "If we ever add a second map builder" is speculation; "The slice adds the second map builder" is a finding. **A rule held by hand at 2+ sites is load-bearing now even when every site is correct today**: the sites are the evidence. A builder the roadmap names but no plan or PRD commits to (Arc Map, Campaign Map today) is still speculation, while one the PRD's slice list commits to is not.

**Clever is not a finding; easy to get wrong is.** Unusual but self-contained code is taste. Code that is correct only while a builder or adopter remembers something is a finding, counted in silent-omission clauses or adoption steps.

**The default is conform.** Burden of proof sits entirely on deviation. A pass with no findings is the expected outcome and a perfectly good result. Say so plainly and stop.

**The finding cap is per mode**; see the mode reference. Rank findings either way.

## The shapes

Ranked by supporting evidence, strongest first. **A shape is its signature**: what you can see in the code or the plan.

No shape names the case it came from: a detector primed on past cases misses the next one. A shape that only fires when you know the story has too weak a signature; sharpen it rather than illustrate it. The signatures below use Taleform's constructs to show *where to look*, not to name settled cases.

**The ranking is inherited.** The shapes were derived from fixed cases in an earlier codebase; Taleform has not yet contributed its own. Record each Taleform case that confirms a shape in agent memory (file, fixing commit). A watch-list entry graduates on its second independent Taleform case. Counts rank your attention and are never cited in a finding.

### A — A relation encoded as N independent literals or branches

**Strongest, and the most mechanically detectable.**

A rule that is fundamentally a *relation between sites* is written as a separate constant, branch or override at each site. Every site is individually correct and matches its neighbours. Nothing expresses the relation, so nothing keeps the sites in agreement, and a change at one site silently breaks the others.

**Signatures, most reliable first:**

- **The same frontmatter read or predicate written by hand in each builder**, where `src/core/story.ts` or `StoryIndex` already holds it or could. A raw `str(n.fm["beat-status"])` beside `status(n)`; an act/beat sort beside `sequence()`; a `played`/`touched` predicate restated per builder; `kind === "act"` tested inline. Count the read sites; the count is the finding even when every site is correct. Count across the whole change, never per step: a plan that adds one site per step never shows N in one place.
- **The same explanatory comment at N sites.** A comment repeated is a relation with no home; the comment is doing the job a type should. In Taleform the tell is a problem sink silenced at a call with a comment naming which *other* builder reports it (`awardsOf(n, () => undefined) // schema reports …`). This is the single most reliable signal available.
- The same literal, or arithmetic on it, at N sites: a status → colour or status → mark table per builder, a map filename suffix, a layout constant, a region id.
- A rule stated in prose and honoured by convention at each call, where the enforcing construct exists but is **opt-in**. An abstraction placed where it cannot enforce is this shape, not a solution to it.
- **A helper exported from one builder's module and imported by its siblings** (a mission selector, a running-total derivation). The builders are dependent, and the export is the relation with no home; the shared derivation belongs in `src/core/` (`story.ts` for domain rules) where no builder owns it.
- One hand-written branch per member of a set, covering a **strict subset** of eligible members: per-kind branches over `SEQ_KINDS` or the schema's `KINDS`, per-status branches over `STATUSES`. Count branches against eligible members; the gap is latent bugs already shipped.
- **A mechanical derivation shipped beside a hand-maintained fallback** for "the cases the derivation cannot see": a derived value plus a frontmatter property the DM sets by hand to override it, or a hand list beside a set the code could enumerate. Never count the fallback's entries: enumerate the eligible set independently (the notes `StoryIndex` loads, the keys `schema.ts` knows) and subtract. The repair is a test that enumerates the eligible set and asserts each member is derived or explicitly excluded.
- A literal table whose entries mirror fields that already exist on objects the same module constructs.

**Cost units:** sites carrying the copy; eligible sites missing it; latent divergences already shipped.

**Failure mode to weight heavily:** these usually fail *silently*: a missed site draws a card in the wrong colour or a wrong XP total rather than reporting a problem.

### B — State parked at the wrong scope, or ownership pointing the wrong way

Mechanically checkable: state the scope of the thing holding the state, and the scope of the behaviour it governs. If they differ, that is the finding.

**Signatures:**

- A property whose scope is narrower than the behaviour it governs: a per-beat property governing a mission-wide fact, or a per-mission property (`party-size`, `party-xp`) that an Arc or Campaign builder would need summed or carried across missions. N independent copies of something that was supposed to be one.
- Membership or grouping inferred from a container (the folder, a filename) when every read actually needs the link. `CLAUDE.md` makes membership the `mission` link, never the folder; a new grouping that reaches for the folder is this shape.
- **N special-case branches inside shared infrastructure whose only job is to protect one builder's variant**: a builder id or one output's file type named in `engine.ts`, `canvas.ts` or `regions.ts`. Guards in generic code that name a specific consumer mean that consumer's relationship is modelled backwards. Highly reliable.
- **A builder reading another builder's emitted text** through `ctx.read` to recover a value the first one derived. The overlay makes it work, but the value now has two owners and `BUILDERS` order becomes a hidden dependency. The derivation belongs in `story.ts`, called by both.
- The same rule enforced at two layers because neither owns it (validated in `schema.ts` and re-validated differently in a builder).

**Cost units:** guards added to shared code; builders that must know about one variant; independent copies of a value that should be single.

### C — One value, two audiences

A single structure carries data for two consumers with different constraints, because only one channel existed when the second consumer arrived.

**Signatures:**

- **One expression, two sinks.** The same value passed to two consumers whose needs differ: text the DM reads at the table also parsed back by a builder; a `Problem` message also matched by a script.
- One return path serving both success and failure.
- A field on a shared structure that only one consumer may ever read, especially where a comment or a test says so.
- A test asserting a field must **not** appear. Per the hand-enforced-boundary meta-signal, this marks the seam but not whether it is already handled.

**Cost units:** payload carried per build; output exposed to an audience that should not see it; consumers forced to filter what they were sent.

**Weight this heavily when the two audiences have different stability contracts**: one human-read (generated text the DM reads), one machine-read (the CLI's `--json` shape, which the vault's hooks parse and which is a public interface); one generated, one author-owned.

### D — Per-run data in a channel whose contract is stability

Narrow, but greppable, and expensive here because a rebuild must be idempotent (`CLAUDE.md` invariant 3) and canvas IDs must not churn.

**Signature:** anything run-dependent interpolated into a value that must be stable across builds: a `nid(...)` input, a region id, or generated text the engine diffs against disk. Run-dependent means a timestamp, a list index, `Map` or object iteration order, an absolute or OS-specific path, a count of something unrelated. An index-keyed id (`nid("x", beat, String(i))`) is stable only until the DM reorders the list.

**Cost units:** generated files that change per build with no input change; canvas nodes re-created (losing the DM's dragged positions) per reorder.

### E — A procedure that has grown a lifecycle

A function accretes setup, ordering and teardown that is really an invariant sequence, and the next caller must reproduce it to be correct.

**Signatures:**

- A second builder would have to reproduce an ordering to be correct: read → `toLF` → `setRegion` → warn if not found → `fromLF` → `emit`, written out per region builder.
- Ordering constraints documented in prose rather than enforced by structure (`BUILDERS`' comment that "the order is a dependency list").
- An operation that happens as an implicit side effect of an unrelated one.

**Cost units:** lines a second builder must duplicate; ordering constraints held only in prose.

### F — A second flag for a state something else already encodes

A specialization of **A**: the relation is "these two properties mean the same thing", and it has no home. Fails silently, always as a wrong-but-plausible read. In Taleform this is also the **declare-what-could-be-derived** shape: `CLAUDE.md` prefers deriving, and `RETIRED` already records one property (`resume`) dropped because `beat-status` encoded it.

**The rule that does the work: count the WRITERS of the existing property, vault-wide. Never the readers.** Readers are what a plan enumerates on its own; writers are what it misses. Builders never write frontmatter, so every writer is outside `src/`.

**Signatures:**

- **Adding a property.** A plan adds a frontmatter key (`complete`, `current`, a stored total) beside one that already encodes the same fact, or that a builder could derive, and defends the pair in prose as "two different facts". The defect is a writer that touches one of the pair and not the other.
- **Collapsing two properties.** The repointing list is built from a grep of `src/`, which structurally cannot see the other readers: Bases formulas in the vault's `.base` files, the vault's templates and docs. Ask what the PRD says about them before accepting a collapse as complete.
- **The writers that are not assignments**, the sharpest half:
  1. **Obsidian's rename rewrite is a writer.** It rewrites whole-value frontmatter links on rename, including inside objects in lists, and does not rewrite a link embedded in a longer string. A pair of one whole link and one string mentioning the same note drifts on the first rename.
  2. **Templates and editors are writers.** `_tpl/Story Beat.md` stamps defaults into every new note; the properties panel, make.md and Nested Properties rewrite values on edit.

**How to apply:** for a new property beside an existing property X, list who sets X (the DM by hand, the template, Obsidian's rename rewrite, vault scripts) and check whether the plan enumerates the state where one moved and the other did not. That unenumerated state is the finding.

**Cost units:** properties the DM must keep in step by hand; states where the pair disagrees and no code says which wins.

### G — A declared external end state the plan's own rule makes unreadable

A builder's correctness has two halves: one this repo writes, one that lives in the DM's vault (the notes, the hand-placed canvas items, the vault docs that describe the model). The effort declares the vault half **in writing, to a contract, as a gate** (the vault gate, the parity check), then the slice that would compare against it disables the comparison by following a local rule, and the verification that matters degrades to the developer reading by eye. The disabling rule is always right for the case it was written for and wrong for a property this same effort creates.

**The one question:** *is the declared vault end state reachable by a check this repo can run, or does the plan's own rule disable the comparison?*

**Signatures:**

- **A blanket "never touch the vault" rule** generalised from the genuine prohibition on *writing* vault content from this repo. `check` is read-only by design. Ask: *does the read path share code with the write path?* If `check` and `build` already split on `write`, the blanket ban collapses the very split it honours.
- **An expected output left unpinned because "the vault isn't migrated yet"**, while a sibling artifact (the PRD, a slice spec, a vault-doc change listed for the developer) already declares it. If an approved sibling names the value, an unpinned expectation asserts nothing.
- **A fixture vault whose notes were invented to make the tests pass** rather than mirroring the shape the vault's template and spec declare. The machine-readable expectation was only ever fed to tests.

**How to apply:**

- Count the facts on each side of the repo/vault boundary, and the checks on each.
- Count how many declared names appear where the stated check can compare them.
- Note which copy of the declaration survives the effort's close, given the effort's `docs/features/<feature>/` folder is deleted.

**Cost units:** declared vault facts with no automated comparison; copies of an expectation that never run against the real vault.

**Failure mode:** silent and wrong-but-plausible. **Route:** build-in-slice when the comparison is new code inside the slice's own builder or test.

### H — A per-key property added as a mode flag on the shared writer

A shared writer keyed by path, region id or output kind gains a parameter so one key behaves differently. The predicate is a function of the key alone, so the option is redundant at every callsite and wrong at the one that forgets it.

**The one question:** *is the predicate a function of the key, or of the callsite?* If two builders emitting the same kind of output must pass the same option to be correct, it belongs on the key.

**Signatures:**

- **An option every emit of one output kind must pass**: `emit(path, content, { same: sameCanvas })` at each canvas-writing builder, when "a `.canvas` compares canonically" is a fact about the path. Likewise a per-region-id `insertAt` that each caller of `setRegion` must compute the same way.
- **A key-parameterised callsite** (a loop emitting over paths or region ids as a variable), which structurally cannot pass the right option per key.
- **The codebase already expresses other per-key properties as a table keyed by the key** (`RETIRED`, a status → colour map). That table is the answer; the option is the deviation.

**How to apply:** count emitting callsites repo-wide excluding tests; of those, the ones where the option **changes behaviour**; and the places the rule is executable (often zero: it lives in a doc comment).

**Cost units:** callsites that must pass the option correctly; executable homes for the rule.

**Route:** contract amendment: `BuildContext` is shared, and every later builder inherits it.

### I — A new base that is costly to adopt

A new interface, helper or core primitive is correct only if each adopter also does something implementing it does not give it. **Taleform itself is such a base**: the next DM adopts it, and every convention the schema does not declare is an adoption step for them.

**The one question:** *what must the next builder, or the next DM, do or remember that the interface does not give them?*

**Signatures:**

- Adding a builder also requires a hand-placed position in `BUILDERS`, the same mission-selection loop, a `generated` marker, its own `nid` namespace, the hand-item merge and position keeping, or a `same` comparator, none of which the `Builder` interface supplies.
- **A capability implemented once, for the first adopter, in that adopter's own module**: `nid`, `MARK`, the keep-what-the-DM-added merge and the dragged-position keeping all live in `adventureMap.ts`. A second map builder (Arc, Campaign) that copies them, or imports them from a sibling builder, is this shape.
- The same function defined in several builders and not offered by `src/core/`, so a caller cannot rely on it.
- **A vault habit hardwired as a Taleform rule**: a regex over the DM's prose (`**Encounter:**`), a fixed block id (`^card`), a filename suffix, a frontmatter key read by name that `schema.ts` does not know. Each is an adoption step another DM must discover by reading source, and each fails silently when absent.

**Cost units:** adoption steps × current adopters; steps whose omission fails silently.

**Propose removing the step before checking for it.** A schema error or a registry test makes a forgotten step loud, not free. Propose the check only when no design makes the step disappear (derived, declared in frontmatter, or supplied by core).

**Route:** build-in-slice while the base is this slice's new code; contract amendment once a sibling slice adopts it, or when removing the step adds to the frontmatter schema.

### J — A special-cased path around a general mechanism

The reverse of B's shared-code guard: a caller routes around the shared mechanism instead of extending it.

**The one question:** *is there a general mechanism this path should extend?*

**Signatures:**

- A builder that writes through `VaultIO` or Node `fs` instead of `emit`, so the engine cannot diff it and `check` cannot see it.
- A builder that parses frontmatter or YAML itself, resolves links by hand, or groups notes by folder, where `StoryIndex` (`resolve`, `link`, `members`) already does it. This matters doubly given the parked Bases direction: every private parse is one more reader to move.
- Canvas JSON assembled or compared by hand where `canvas.ts` has the primitive; region text spliced by hand where `setRegion` exists.
- A comment explaining why a shared primitive's rule does not apply here. The primitive should support the case as an option.
- An Obsidian- or Node-specific operation in `src/core/` or `src/builders/` where `VaultIO` is the portable one.

**Cost units:** bypassed hooks; paths a future change to the general mechanism must also update; exception comments.

**One bypassed hook is a finding.** J needs no future caller or adopter: a workaround confined to one builder still bypasses the hook. Do not judge it by I's adoption cost.

**Route:** build-in-slice, unless the fix changes the shared primitive's signature.

### K — A rule applied where it does not fit

A heavyweight or awkward mechanism chosen because `CLAUDE.md`, a skill or a context doc said so, not because this case was checked to need it.

**The one question:** *was this case checked, or was the rule cited?*

**Signatures:**

- A rule cited as the reason, with nothing measured or tested about this case:
  - "lists of objects stay top-level" applied to a value that is not a list of objects;
  - the Windows file-watcher workaround applied to a CLI path that only runs with Obsidian closed;
  - "prefer deriving" applied to a fact the vault does not hold anywhere.
- A rule written for one vault (the test vault, or one DM's), or the largest mission in it, applied uniformly to every case.

**Cost units:** extra frontmatter keys or adoption steps; instances where the rule's premise does not hold.

**Do not weigh the mechanism's cost against its benefit.** Absent a check of this case, it is a finding.

**Route:** rule amendment; see Routing.

### Watch list — real but under-evidenced. Do NOT open a finding on these yet

Recorded so they graduate on evidence rather than being invented. Note one in a watch line if you see it; do not spend a finding slot.

- One payload shape serving N branches, sharpest as *a branch whose contract is the absence of a key*.
- Build-time work that could only have been correct at authoring time.
- A marker positioned relative to "newest" or "last" when its value depends on sitting behind stable content.
- A fallback whose trigger is narrower than the failure mode it protects against.
- A bundle threaded through layers that never read it (a `ctx` or `options` passed down to helpers that use one field).
- A control delegated to the thing it controls.
- A cited precedent that extracted the decision, used to justify writing it twice with a test as the only binding.
- A judgment gate rendered as a flag checked against the run's own measurement.
- A structural guarantee enforced by substring-matching the repo's own source for the forbidden name. Ask: *does the check match an import, or a string?* It goes red first on the comment explaining the guarantee. (Watch any check of "`src/core/` has no Obsidian imports".)
- A closed set fixed at core scope while each consumer closes differently: planr's derived `blocked` releases only at `implemented`/`rejected`, but wayfinding tickets close at `approved` and issue docs close by deletion. Ask: *does any ranking or script read `blocked` over `wayfinding/` paths?*
- A hand-maintained set asserting one property whose members achieve it by different mechanisms. Ask: *per member, what would make its value dishonest, and does anything check?*
- A dangling-reference check whose vocabulary is harvested from the set being deleted. Ask: *does the check's pass condition read from the set the defect cites into?*

### A bias in this evidence base you must correct for

**Every shape above was derived from a *fixed* case, in a codebase with a different stack**, so a failure Taleform is prone to (canvas layout, ownership of generated text, Obsidian's re-save behaviour, the frontmatter/Bases boundary) may match none of them. Two corrections:

1. **A live unfixed instance is stronger evidence than a fixed one**: it proves the convention is still winning.
2. **A candidate matching no shape gets named in your closing line**, with the bar item it failed. That is how this list grows.

## Meta-signals — cheaper than reading the change

These locate the *seam* without architectural judgment. Run them first.

1. **A stated rule with no enforcement is a fossil of this exact failure.** Someone wrote the rule down because following the convention had already gone wrong once, and prose was the only place left to put it. If the change touches a surface carrying such a rule, read it first, and if the change needs the prohibited thing, that is the finding, because the rule has no teeth.

   **Search two forms, in two places. Missing either is how this signal goes quiet on a real case.**

   | Form | Reads like | Where it lives |
   |---|---|---|
   | **Imperative** | a prohibition: *do not*, *must*, *never* | `CLAUDE.md` (§ Invariants, § Obsidian facts), `docs/context/` |
   | **Declarative** | a description of behaviour, and is easy to miss | **doc comments and inline comments in `src/`**: "Membership is the link, never the folder", "Builders never write frontmatter", "the order is a dependency list" |

   ```bash
   grep -rn 'Do NOT\|Do not\|MUST\|must never\|must not\|NEVER\|ALWAYS\|only ever\|never be' CLAUDE.md docs/context/
   grep -rn 'never\|always\|only\|must' src/core src/builders   # the declarative half
   ```

   **The declarative half is not optional**: a boundary rule is as often stated in a doc comment, phrased as description rather than prohibition.

2. **A failed first fix leaves a git trace.** A commit that *trims* a shared helper's job, shortly before a commit that *splits* it, is a near-miss: someone tried the better-use-of-the-existing-abstraction fix and it did not hold. If the change trims a shared helper or payload, check whether that has been tried on this seam before. Skip this when the split has visibly already shipped, and **say you skipped it** rather than implying coverage.

3. **A test enforcing a boundary by hand** (asserting that text outside a region is untouched, that a hand-added canvas card survives, that frontmatter is unchanged after a build, that a builder was *not* run) marks a boundary. **This signature is ambiguous and you must disambiguate it before writing anything:**

   - **The enforcing construct does not exist** → the boundary is held by hand, and that is your finding.
   - **The enforcing construct already exists** (`setRegion`, the `generated` marker merge, the engine never emitting frontmatter) → the test is its *regression guard*, and there is no finding. The boundary was already drawn.

   **Check whether the construct exists before proposing it.** The signal tells you where the seam is, never whether it is already handled.

   Also: **a test that cannot fail** (one whose assertion holds on the fixture it was given regardless of the code under test) marks a seam that is not where the logic lives.

## What is NOT a finding

Say nothing about any of these. They are other reviewers' work or nobody's.

- A convention or invariant **violation**. That is `taleform-reviewer`'s.
- Names, test placement and tests that pin configuration or schema: `taleform-reviewer`'s. Near-identical sibling test files: `pr-tidying`'s.
- Regenerated test-vault output. Whether changed output is intended is the step-8 review's call.
- File moves, dead-code removal, test coverage, formatting.
- "This would be cleaner / more idiomatic / more testable" with no counted cost.
- An abstraction for a second case that does not exist yet, including a roadmap builder no PRD commits to.
- Anything you would fix by writing more of the same code correctly **once**. If conformance done properly solves it and no future builder or adopter must repeat it, the convention fits and there is no finding.
- Performance guesses without a stated unit and a reason to believe the magnitude.

## Routing — this is the part that matters

Every finding is routed by **blast radius**, and the test is mechanical rather than a judgment about importance:

| Blast radius | Route |
|---|---|
| The abstraction lives entirely inside this slice's own new code | **Build it**: the mode reference says how. Log it in the effort's decision log with its shape and cost. No gate, no escalation. |
| It changes a shared signature in `src/core/`, the `Builder` / `BuildContext` contract, the frontmatter schema (`schema.ts`, `RETIRED`), the CLI's flags or `--json` shape, generated-output identity (`nid()` inputs, region ids, the `generated` marker), or anything another slice or branch inherits | **Do not build it.** Raise it as a **proposed amendment to the PRD's cross-cutting contract**, in that document's rule format, and stop. It goes to the unconditional PRD gate (sdlc §4 step 3). |
| Shape K: the defect is a rule in `CLAUDE.md`, a skill or a context doc | **Build the plain version in the slice**, and propose narrower wording for the rule. Log both in the effort's decision log. Never the PRD gate: a working rule is tooling, not product contract. |

A cross-cutting abstraction *is* a contract rule, so it goes to the contract gate, never suspended, on any branch. **This is what lets everything below the contract line run autonomously.** The test is mechanical on purpose: *who else inherits this?*, not how important the finding feels. A finding whose fix would change what the vault docs describe (the spec `story-maps.md`, `run-sheet-format.md`, `_tpl/Story Beat.md`, the vault `CLAUDE.md` § Taleform) names them in the amendment, so the developer can update them; never edit them.

**Two carve-outs that route up regardless of size:**
- **Author-owned text.** Where the cost is a builder touching text outside its generated regions, header and footer, or canvas items without the `generated` marker, or writing frontmatter (invariants 1 and 2), route up even if the change is confined to one slice.
- **Silent failure.** Where the failure mode emits wrong-but-plausible output (an XP total, a resume marker, a map edge) rather than reporting a problem, escalate the ranking. Nothing surfaces these but a reader who already suspected them.

## Output

Lead with the mode and the verdict: **findings, or none.** "No findings — the conventions fit" is a complete and welcome result.

Per finding, in this order and no longer than this:

1. **Shape**: the letter and name.
2. **Where**: the plan section or diff hunk, plus the codebase file(s) that make it true. Verify at source; never assert from memory.
3. **The convention followed**, and why it looked right.
4. **The cost, in a unit.** With the count.
5. **The proposed abstraction**: one paragraph. Not a design doc, not code.
6. **Route**: build-in-slice, contract amendment, or rule amendment. State which, and why the blast-radius test lands there.

Then one line: **what you checked and did not flag**, so the reader can tell a clean pass from a shallow one.

End the report file with this exact last line: `## Review complete — FINDINGS` (or `NO FINDINGS`).
