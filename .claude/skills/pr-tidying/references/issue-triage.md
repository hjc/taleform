# M. Issue Triaging

**Findings file:** `.tmp/pr-tidying-findings-issue-triage.md`
**ID prefix:** `M1`, `M2`, …
**Read-set:** the issue docs this branch added — `git diff --name-only --diff-filter=A <parent>..HEAD -- .claude/plans/issues/`.

**Run by the orchestrator in `SKILL.md` Phase 2b**, which owns the dispatch and the completeness check.

## Which issues

An added issue needs triage when its triage is incomplete — `issue-triaging` §7 defines complete. Read each with `node .claude/skills/html-planning/planr.js meta <file> --format json`; a field is unset when its `source` is `null`.

No added issue needs triage → skip M and say so in the coverage line.

## Dispatch

One `issue-triager` per issue, all in parallel, brief: the issue path and `mode: verdict`.

Collect every report into the findings file: one `M<n>` row per issue, then each verdict table and apply command verbatim.

## Report (Phase 3)

| # | Issue | Verdict | Proposed priority | Off-matrix |
|---|-------|---------|-------------------|------------|
| M1 | `adventure-map-drops-hand-edge.html` | VERDICT | p1 | matrix p2 → p1: breaks invariant 2 on every rebuild |

Follow the table with each issue's verdict table. **Every verdict needs the DM's approval, per issue** — approve, amend a field, or reject. A `RESOLVED` or `DUPLICATE` verdict is a deletion proposal under `issue-creating`, not a rating.

## Apply (Phase 4, last)

Apply after every other category. For each approved verdict, run its apply command with any amendments, then:

```bash
node .claude/skills/html-planning/planr.js check <file> --strict
PYTHONUTF8=1 py .claude/skills/issue-triaging/scripts/review.py check
```

`review.py check` exits 1 when `class=latent` and `reach=none` disagree; fix the fields, never the script. An approved RESOLVED or DUPLICATE verdict is a `git rm` per `issue-creating`.

Commit the triage alone as `mapping: triage <n> issue(s) filed on this branch`.

## What NOT to flag/do

- Re-triage an issue whose triage is complete, or one this branch did not add.
- Apply a verdict the DM has not approved.
- Hand-edit an issue doc. Every write goes through `planr`.
