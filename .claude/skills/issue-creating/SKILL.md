---
name: issue-creating
description: File a defect found while doing something else as an HTML issue doc under `.claude/plans/issues/`, and retire it when the fix ships. Use when you find a bug you are not fixing right now, when asked to write one up, or when a fix lands and its issue doc needs removing.
---

# Issue Creating

An issue doc records a defect **you are not fixing right now**, for whoever picks it up cold. It is the counterpart to `tdd-planning`: that skill plans work you are about to do, this one preserves work you are not.

**File it and commit it in the same pass, on whatever branch is in hand.** Matching a finding to its "correct" branch is worth nothing next to not losing it (`docs/sdlc.md` §3). An unfiled finding is a lost one.

## When to file one

- A defect found while doing something else — the common case, and the one this exists for.
- A defect you *are* fixing, but whose blast radius exceeds the current branch. File the part you are not taking.
- A behaviour you cannot yet classify as a defect. File it with the open question stated; that is what the `open` section is for.

**Do not file** something already covered by a live plan or ticket, a refactor you merely prefer, or a defect small enough that fixing it now is cheaper than writing it up. Check `.claude/plans/issues/` and `.claude/plans/README.md` first — `planr query .claude/plans/issues --where 'reference-paths~<dir>' --fields path,title,priority` narrows that listing to the directory you are about to file against.

## Location and naming

`.claude/plans/issues/<slug>.html` — one file per defect, `kebab-case`, named for the **defect** rather than the symptom or the file (`region-end-marker-dropped.html`, not `regions-ts-bug.html`). Issue docs are **committed**; only TDD plans stay untracked (`docs/sdlc.md` §4e).

An issue that grows into scheduled work gets a roadmap entry in `.claude/plans/README.md` pointing at it. The issue doc stays the detail; the register stays the index.

## Scaffold

```bash
node .claude/skills/html-planning/planr.js new .claude/plans/issues/<slug>.html \
  --title "<Defect, named as a defect>" --template issue \
  --set header.status=draft \
  --set reference-paths=<comma-separated directories, e.g. src/builders,test>

node .claude/skills/html-planning/planr.js meta .claude/plans/issues/<slug>.html \
  --set class=<slug> --set reach=<dm|hooks|adopter|developer|none> --set detection=<silent|loud> \
  --set "source=<where it surfaced>" \
  --set impact=<low|medium|high|critical> --set urgency=<low|medium|high> --set effort=<small|medium|large>
```

Status stays `draft` until someone owns it, then `review`. An issue examined and ruled intended goes to `rejected`, which takes it out of every queue — that is the end state for an adjudication, and `planr set <file> header.status=rejected` is its only writer.

**Never write header chips** — they are deprecated, and `check` warns on one. Where the defect surfaced is `source`, loud vs. silent is `detection`; the header renders both from `<plan-meta>`. `source` takes no `<`, `>` or `&`: `planr meta --set` writes it verbatim.

**When the fix ships, DELETE the file.** `git rm` it in the same commit that lands the fix — there is no `implemented` end state for an issue. An issue doc is a debt record, and a resolved debt kept on disk is clutter that every future search pays for. The commit that removes it is the record that it was resolved.

**Grep for its path before deleting**, and fix what you find:

```bash
grep -rn "<slug>.html" --include=*.md --include=*.html .
```

A tracked artifact citing a deleted issue is a dangling reference, and those citations are usually **stale claims as well** — a slice spec saying "not yet wired, see this issue" is wrong in both halves once the fix ships. Correct the claim, don't just strip the link. Untracked artifacts (TDD plans under `tdds/`) need nothing. If the issue earned a roadmap entry in `.claude/plans/README.md`, that goes too.

A hit inside another issue's `blocked-by` field is removed with `planr meta <that issue> --unset blocked-by`, or `--set blocked-by=<the rest>` when it names others. Until it is, `planr check` warns that the target does not exist.

## Triage metadata

These fields, declared in `.claude/planr-schema.json`, classify an issue and decide where it sits in the queue.
Write them with `planr meta --set`, never by hand.

| Field | Values (declared order is the sort order) | What it answers | Set when |
|---|---|---|---|
| `class` | `author-data-loss` · `feedback-loop` · `interface-break` · `material-bug` · `gap` · `scale` · `portability` · `latent` · `quality` · `not-a-defect` | What kind of defect it is (`issue-triaging` §1) | Filing |
| `reach` | `dm` · `hooks` · `adopter` · `developer` · `none` | The widest audience the failure reaches (`issue-triaging` §1a) | Filing |
| `detection` | `silent` · `loud` | Does anything report it when it fires? (`issue-triaging` §1b) | Filing |
| `source` | free text | Where it surfaced: `parity check on the live vault`, `pre-commit hook output` | Filing |
| `impact` | `low` · `medium` · `high` · `critical` | The worst severity in the issue's own impact table | Filing |
| `urgency` | `low` · `medium` · `high` | Is it live today, or latent/deferred? | Filing |
| `effort` | `small` · `medium` · `large` | 1–2 / 3–5 / 6+ remediation steps | Filing |
| `blocked-by` | sibling issue file names | Another issue that must be fixed first — the `default` queue skips this one while that one is open. Written `planr meta <file> --set blocked-by=<other>.html` | Filing, or when found |
| `priority` | `p0` · `p1` · `p2` · `p3` | The bucket the work queue sorts on | **Triage** |

A new issue carries every field but `priority` — the evidence, read off the document you just wrote.
**`priority` is not set at filing.** It is decided at triage, one issue at a time: run `issue-triaging` on the new doc, and its verdict is applied only once the DM approves it.

An issue with no `priority` is not lost — it surfaces in the `triage` ranking, which exists for exactly that.
`planr query .claude/plans/issues --rank triage` is the list of issues awaiting a bucket.

**Leave any field you cannot answer UNSET. Never guess one.** A guessed value ranks an issue nobody judged.

`reference-paths` lists the repository directories the defect lives in — the same paths the `root-cause` section already quotes.
`title`, `status` and `date` are **owned by the header**: `planr meta --set` refuses them and names `planr set
<file> header.status=…` as the writer.

## The spine

`--template issue` scaffolds these ids. **Use them verbatim** — a stable id makes every issue addressable (`planr read <slug>.html remediation`) and the corpus comparable, exactly as with the TDD spine.

| # | id | Title | Content convention |
|---|----|-------|--------------------|
| 1 | `overview` | Overview | A single `plan-callout type="danger"`: the defect and its blast radius in **one sentence**, then how long it has been true and whether it fails loudly or silently. |
| 2 | `root-cause` | Root cause | One mechanism, quoted as a `plan-file` with a real `path` and `lines`. Never a bare snippet. |
| 3 | `impact` | Impact | `plan-table` **Area / What breaks / Consequence / Severity**, most severe first. Plus an info `plan-callout` naming anything another effort already owns. |
| 4 | `remediation` | Remediation | `plan-table` **# / Step / Notes**, ordered, blockers named. A `plan-diff` only if the fix shape is genuinely known. |
| 5 | `not-affected` | What is not affected | A `warn` callout bounding the defect. |
| 6 | `open` | Open | A list of questions whose answers change the remediation. |

Delete a section that genuinely does not apply; do not rename or reorder one.

**Some issues on this branch predate the spine** and carry everything under a single `overview` section with `<h3>` headings, or their own invented ids. Leave them — an issue doc is a point-in-time record, and rewriting one to match a later template gains nothing. The spine governs new issues.

## What makes an issue useful cold

- **The first sentence is the whole triage.** Someone scanning the directory reads the danger callout and nothing else. If it does not state what breaks and how badly, the issue will not get picked up.
- **Separate the mechanism from its consequences.** One cause, several impacts — that is why `root-cause` is prose and `impact` is a table.
- **Say whether it fails loudly or silently**, and record it as `detection`. A silent failure is a different class of problem: it has an unknown backlog behind it and no one is reporting it.
- **Quote code with a path and line range.** A path plus gutter numbers is the difference between a report and a lead.
- **Say what is *not* affected.** A reader who has just learned the mechanism assumes it is everywhere; bounding it is the cheapest thing you can give them.
- **Distinguish measured from reasoned.** If a claim was measured, give the command or probe — they will re-run it. If it was reasoned, say so, and put the measurement in `open`.
- **State the recoverability of anything lost.** It is usually what decides the priority. The vault is git-tracked, so ask whether the lost text was committed or was the DM's uncommitted work in progress — the second is the realistic loss, and git does not have it.
- **Name the invariant it breaks**, if any (`CLAUDE.md` § Invariants). A broken invariant is what separates `author-data-loss`, `feedback-loop` and `interface-break` from an ordinary `material-bug` (`issue-triaging` §1).

## What to keep out

- **A fix you have not validated.** A plausible diff nobody has run reads as authoritative and is worse than an open question. Delete the `plan-diff` and state what is undecided.
- **The investigation narrative.** Record what is true, not how you came to believe it. Dates, ruled-out hypotheses and measurement history belong only where they change what someone does next.
- **Scope creep.** Adjacent defects get their own issue docs and a cross-reference, never a second `root-cause`.

## Finishing

Run `planr check <file>` — it exits 1 with line numbers on a structural break — then commit the issue doc with whatever else is in hand.
