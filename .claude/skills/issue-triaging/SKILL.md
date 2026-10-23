---
name: issue-triaging
description: Set an issue doc's triage metadata in one pass, from what the document says and what the roadmap is committed to. Use when triaging the issue corpus, when a newly filed issue needs priority, or when asked what to work on next.
---

# Issue Triaging

Triage reads one issue doc, the code it cites, the live vault's `check` output and the roadmap. It then sets the doc's triage metadata in one `planr meta` call: what kind of defect it is, who it reaches, what one occurrence costs, why it matters now, how big the fix is, and the priority bucket the work queue sorts on.

## Key pointers

- Enums: `.claude/planr-schema.json`.
- The queue is `planr query docs/issues --rank default`; untriaged docs sit in `--rank triage`.
- `source` is written at filing (`issue-creating`); set it here only when it is empty and the document states where the defect surfaced.
- The invariants the classes below are built on: `CLAUDE.md` § Invariants.
- What a complete triage is, and what else gets recorded: §7.

## Current focus: feature completeness and value

**Taleform is early, with one DM and one vault.** The ranking favours what makes the tool more complete and more useful at the table over hardening it like a platform. That means:

- **Up:** gaps in outputs the DM uses, wrong output the DM reads, and work that completes a roadmap builder.
- **Down:** interface stability, scale, portability to other vaults, latent defects and test gaps. They wait until they bite.
- **Still `p0`:** destroying the DM's own writing. That is the DM's work, not platform reliability.

When the focus moves (another DM adopts Taleform, or the vault outgrows the auto-build), rewrite this section and §6, then re-triage the corpus.

## 0. Before rating: is it still an issue at all

Triage is also when a stale doc gets caught. Two checks, both cheap:

- **Resolved.** Open the code the `root-cause` cites. If the mechanism is gone — the guard exists, the builder is converted, the function has no callers — the issue is closed, not `p3`. Say so with the evidence; `issue-creating` says a fixed issue's doc is deleted, not downgraded.
- **Duplicate.** Two docs describing one mechanism get one doc. Keep the one with the better root cause, fold anything the other adds into it, and name the loser. Same symptom from two different mechanisms is **not** a duplicate.

Neither is a rating. Report both as findings and let the caller delete.


## 1. Classify the document first

Record it as `class`, with the slug in the second column.

| Class | `class` | Test |
|---|---|---|
| **Author data loss** | `author-data-loss` | A build overwrites or deletes text or canvas items the DM wrote — anything outside region markers, the sequence header and `## Next` footer, or canvas items marked `"generated": "adventure-map"` (invariant 2). Includes dragged positions lost without `--relayout` |
| **Feedback loop** | `feedback-loop` | A build writes frontmatter (invariant 1), or a second `build` reports changes / `check` on a freshly built vault exits 1 (invariant 3). Output churns, or feeds back into its own input |
| **Interface break** | `interface-break` | Something outside Taleform breaks with no change on its side. Examples: CLI flags or the `--json` shape the vault hooks call; a pre-commit that blocks or stages unrelated work (invariant 5); a renamed property with no `RETIRED` entry (invariant 4); canvas node IDs (`nid()`) or region ids that change between builds |
| **Material bug** | `material-bug` | A live path produces wrong generated output — wrong XP, wrong resume beat, a broken link, a map missing or misplacing beats — or a build/check that errors on valid frontmatter |
| **Gap** | `gap` | Nothing is wrong, but something is missing: the typed model implies a capability no builder delivers, a builder does in one place what it skips in its sibling, or an output is half-built. Rated on value (§2), not correctness |
| **Scale robustness** | `scale` | Correct today, fails or crawls on a bigger vault — auto-build cost per keystroke, whole-vault reparses, the Windows watcher dropping events under bulk writes |
| **Portability** | `portability` | A vault-specific assumption in `src/` — a name, path, folder or plugin the live vault happens to have — that would break another DM's vault |
| **Latent defect** | `latent` | The mechanism is real but no current path reaches it |
| **Quality** | `quality` | Cleanup, dead code, a vacuous or missing test, duplication, naming |
| **Not a defect** | `not-a-defect` | A refactor, a modelling question, an adjudicated non-bug, a new feature the model does not yet imply (that is a PRD, not an issue) |

The class caps everything below. A document that does not name a reachable wrong output is not a material bug, however many builders it touches; if it names a missing capability instead, it is a `gap`.

**Author data loss outranks everything else.** Taleform's whole promise is that a build is safe to run at any time; a build that eats the DM's writing breaks that promise for every other output too. After it, the ranking is about value (Current focus).

## 1a. Who the failure reaches

Record it as `reach`: the first row, top down, that the failure reaches.

| `reach` | Who the failure reaches |
|---|---|
| `dm` | The DM in Obsidian: generated notes, regions, the Adventure Map, the status bar, the plugin's commands and auto-build |
| `hooks` | Only the automation that calls `dist/cli.cjs`: the vault's git `pre-commit`, the Claude `taleform-hook.mjs` PostToolUse hook, scripts reading `--json`. The DM meets it only when that automation runs |
| `adopter` | Only another DM's vault — a vault shape, setting or plugin set the live vault does not have |
| `developer` | Whoever works on Taleform: the repository, tests, `npm run check`, the build and deploy scripts |
| `none` | No one today. Set exactly when `class=latent`, and never otherwise |

**`reach=dm` with `detection=silent` raises impact one level** (never past `critical`). The DM runs the table off generated text and has no reason to doubt it; wrong output nobody flags gets read aloud.

## 1b. Whether anything reports it

Record it as `detection`. `silent`: the failure raises nothing the DM or a hook sees — wrong numbers written quietly, a region dropped, a validation that passes what it should reject. `loud`: a schema error or warning in `build`/`check`, a non-zero exit, a status-bar error, a hook that exits 2, a visibly broken map. Leave it unset when the document does not say.

## 2. Impact — what one occurrence costs

**Defects that produce output (every class but `quality` and `not-a-defect`).** Rank by what the DM experiences when it fires:

| Impact | Consequence |
|---|---|
| `critical` | DM-written text or canvas work destroyed where git does not have it (uncommitted work in progress), a build rewriting its own input, or the vault hooks broken so commits or Claude's edits fail |
| `high` | A core output silently wrong for a normal vault — XP, resume, navigation, the map — or a build/check that refuses valid frontmatter |
| `medium` | Degraded or recoverable: wrong only on a rare shape or an error path, a misleading warning, a loss git restores, churn the next build settles |
| `low` | Cosmetic: layout, wording of a generated line |

**Unrealized value counts as impact.** The ladder above measures what a failure costs; a gap costs what it never delivers. Both are impact, and the second is the easy one to under-rate.

**Scale robustness and portability.** Rate what they do *today*: `medium` at most unless the scale problem has already bitten the live vault, or another DM has adopted Taleform and hit the portability one — then rate what happened.

**A gap (`class=gap`) is rated on the value it is failing to deliver, not on correctness.** Nothing is broken, so the correctness ladder reads it as `low`; that is wrong. Ask what the DM cannot do:

| Impact | The gap |
|---|---|
| `high` | A capability the typed model plainly implies is missing from an output the DM reads every session — a frontmatter field the schema validates but no builder draws |
| `medium` | A rough edge in a flow that still completes — a hand-maintained line beside a generated one, a manual rebuild, a warning that needs explaining |
| `low` | Additive polish nobody is waiting on |

**A refactor or cleanup is not a product gap.** It is measured against `docs/roadmap.md` and `CLAUDE.md` § Roadmap: `high` only if it blocks or materially accelerates a committed roadmap item (the Arc and Campaign Map builders, reading through the Bases API); `medium` if it serves one; `low` if the roadmap does not need it.

**Never raise impact for:**
- **Occurrence count.** 33 beats with a mild consequence is a mild consequence, 33 times. Breadth belongs in `effort`.
- **A missing or vacuous test.** The defect is the regression risk, not a live failure.
- **Class-of-pattern arguments.** "The next builder will copy this" is urgency at most.
- **Adopter-only reach.** Rate the consequence; `reach=adopter` lowers urgency instead (§3).

## 3. Urgency — why now rather than later

Time-sensitivity, not severity. Default `low`, then raise:

| Raise to | When |
|---|---|
| `high` | It **fires on the live vault today** and the DM reads the output; it **breaks invariant 1 or 2** (frontmatter written, DM text touched); it blocks or completes a roadmap item in flight; the DM is waiting on it for an upcoming session |
| `medium` | Worsens with time (wrong output being copied into session notes, the DM authoring around it, a pattern being copied into new builders); the DM has hit it; it fires only through the hooks |
| | **Already destroyed DM text** — rate `high` whatever the class |
| `low` | Cleanup, test gaps, latent defects, scale and portability that have not bitten, anything waiting on a decision |

**Adopter-only reach lowers urgency one level**, never below `low`: no other DM runs Taleform yet, which buys time, not safety.

A `critical` impact that nothing reaches is still low urgency. A `low` impact that breaks an invariant is still high urgency.

## 3a. Ground it in the live vault

**A defect firing on the live vault is no longer a judgement call.** Before rating anything that would change output, check whether it is firing, read-only (`docs/sdlc.md` §2, Parity against the live vault):

```bash
npm run check
node dist/cli.cjs check --vault "<vault>"          # exit 1 on stale output or schema errors; prints warnings
node dist/cli.cjs build --vault "<vault>" --json   # only in a throwaway copy of the vault, never the live one
```

`CLAUDE.md` § The vault names the vault path and the one known warning (3.03's Encounter line). Any other diff or warning is evidence. **Never run `build` against the live vault to triage** — that is the DM's call, and it rewrites the very output you are judging.

**Reproduce it in a fixture.** A failing `build()` on a `test/memoryVault.ts` fixture vault is the strongest evidence there is, and it becomes the fix's first test.

**Record the evidence in the document**, in `open` or the impact table: the command, the exit code, the offending line or note. A rating resting on a reproduction that does not name its command cannot be re-checked.

**A clean `check` is never evidence of health.** A silent failure — every `detection=silent` document, a wrong XP total the ledger agrees with, a region dropped on both sides of the diff — passes `check`. Never downgrade for a clean run; say the signature is unobservable and rate on the document.

## 4. Effort — size of the fix as the document describes it

`small` one file or one guard, with its test · `medium` a few files, or a builder plus its schema and `RETIRED` entry · `large` cross-cutting, every builder, a frontmatter model change, or a behaviour change needing a plan.

Effort never moves impact or urgency. It is the tie-break inside a priority bucket.

## 5. Reference paths

Record them as `reference-paths`: only the paths the document actually names (a `plan-file` path, a cited module). Leave unset rather than guessing. Comma-separated.

## 6. Priority

**The bucket is a decision about what the next few sessions of work look like, not the output of a formula.** Pick it from these definitions, then use the matrix below to check yourself:

| | Definition |
|---|---|
| **`p0`** | **Fix ASAP.** Left alone this produces damage someone has to repair by hand — the DM rewriting lost notes, restoring from git, unpicking a commit the hook staged, or re-checking numbers already used at the table. **Use it sparingly**; a `p0` list longer than a week of work is not a `p0` list |
| **`p1`** | **High unrealized value**, and it passes at least one of the three tests below. It sands out an ornery edge, removes a bug the DM keeps hitting, or closes a gap in an output the DM already uses |
| **`p2`** | **Medium.** Should be addressed within the next few months. It can sit, but it is more than a nice to have |
| **`p3`** | **Low.** A nice to have. Living without it costs nothing material; having it adds clarity or robustness to a builder that is otherwise finished |

**The test for `p0` is the repair, not the severity.** "The DM has to go fix something by hand" is the line. A critical-sounding defect nothing reaches, or one whose output the next build corrects, is not `p0`.

### The three tests for `p1`

A document reaches `p1` by passing **one** of these. Failing all three, it is `p2` however bad it reads — a severe-sounding defect nobody can show happening, in an output nobody reads yet, that a rebuild or git restores, is next-few-months work.

| | Test | Evidence it takes |
|---|---|---|
| **Proven** | It is happening | A reproduction (§3a): a failing fixture test, a diff or warning from `check` on the live vault, or the DM reporting it. "3.03's XP total is wrong", not "could affect any beat" |
| **Felt** | It improves or completes an output the DM already uses | The working half is in use at the table: the Adventure Map, the resume region, the XP ledger, the navigation headers. A builder that is named but not designed (Arc Map, Campaign Map) is `p2` until its PRD is approved; after that, a gap that completes it passes this test |
| **Irreversible** | When it does happen it is very painful or impossible to fix | Uncommitted DM text destroyed, a commit made with the wrong files staged, wrong numbers already played at the table. Unobserved is fine here — that is the point of the clause |

**Reasoned severity is not evidence.** "Any vault with a nested folder could…" with no reproduction, no report and an outcome git restores is the exact shape this test exists to hold at `p2`.

**The test for `p3` is "finished".** `p3` belongs to a builder that is otherwise complete and would merely be clearer or sturdier. If the output is half-built, that is a gap, and gaps are not `p3`.

### Cross-check, not arithmetic

| Impact | urgency `high` | urgency `medium` | urgency `low` |
|---|---|---|---|
| **`critical`** | `p0` | `p1` | `p2` |
| **`high`** | `p1` | `p2` | `p2` |
| **`medium`** | `p2` | `p2` | `p3` |
| **`low`** | `p3` | `p3` | `p3` |

Where the matrix and the definitions disagree, **the definitions win** — and say so in the document, because `scripts/review.py render` reports the divergence and the next reader needs to know it was deliberate.

These still hold, as inputs to the judgement rather than arithmetic applied after it. **Where a floor and the three `p1` tests disagree, the tests win** — a floor says who can reach a thing, not that anyone has. They encode the current focus (top of this skill): value up, hardening down.

1. **Author data loss on a live path is `p0`** (`class=author-data-loss`). It is the clearest case of the hand-repair test.
2. **A feedback loop is at least `p1`** (`class=feedback-loop`): a build rewriting its own input poisons every other output.
3. **A gap in an output the DM already uses is at least `p1`** (`class=gap`, `reach=dm`). Completing what is in use is the highest-value work there is.
4. **A material bug in what the DM reads is at least `p1`** (`class=material-bug`, `reach=dm`).
5. **A gap anywhere else is at least `p2`** (`class=gap`): unrealized value is never `p3`.
6. **A reproduction on the live vault is at least `p1`** — a diff or warning from `check` beyond the known one (§3a).
7. **An interface break is at most `p2`** (`class=interface-break`) until it breaks the live vault's hooks; then rate what happened. There is one consumer, and it is in the room.
8. **Scale robustness is at most `p3`** (`class=scale`) until it has bitten the live vault; then rate what happened.
9. **Portability is at most `p3`** (`class=portability`) until another DM adopts Taleform; then rate it as the break it causes them.
10. **Quality, cleanup and test gaps are `p3`** (`class=quality`), unless the untested thing guards invariant 1 or 2 — then `p2`.
11. **Unreachable is `p3`** (`class=latent`).

**Most of the corpus is `p2` and `p3`, and the tail should be long.** Inflation is the only failure mode this ranking has: a `p0` that is really a `p2` buys nothing and hides the three that are real.

## 7. Record the judgement

Record `class`, `reach` and `detection` with `planr meta --set`, in the same call as the rating — never in prose alone.

**A triage is complete** when `class`, `reach`, `impact`, `urgency`, `effort` and `priority` are all set. `detection` and `reference-paths` may stay unset when the document cannot answer them.

**An issue that cannot be fixed until another one is** records it: `planr meta <file> --set blocked-by=<other>.html`, naming the blocking issue's file (comma-separated for several). The `default` queue skips it while any blocker is open. When `planr check` warns that a `blocked-by` target does not exist, the blocker's fix shipped and its doc is gone: remove the entry with the command the warning prints.

When a rating is not obvious from the document — a guess at reachability, a roadmap link, a class-of-pattern call — state it in one line in the issue's `open` section rather than leaving the next reader to re-derive it.

Re-triage when the roadmap's focus moves, not per branch.

## 8. Review page and check

```bash
PYTHONUTF8=1 py .claude/skills/issue-triaging/scripts/review.py render > .tmp/body.html
node .claude/skills/html-planning/planr.js set-body <review.html> overview --file .tmp/body.html
PYTHONUTF8=1 py .claude/skills/issue-triaging/scripts/review.py check
```

`render` reads the matrix and floors/caps from §6 and the fields from `planr query`. `check` exits 1 when `class=latent` and `reach=none` disagree; `check-tooling.js` runs it as `issuemeta`.


## 9. The one-pass command

Write every field in one call, per document:

```bash
node .claude/skills/html-planning/planr.js meta <file> \
  --set class=<author-data-loss|feedback-loop|interface-break|material-bug|gap|scale|portability|latent|quality|not-a-defect> \
  --set reach=<dm|hooks|adopter|developer|none> \
  --set detection=<silent|loud> \
  --set impact=<low|medium|high|critical> \
  --set urgency=<low|medium|high> \
  --set effort=<small|medium|large> \
  --set reference-paths=<paths the doc names> \
  --set priority=<p0|p1|p2|p3>
```
