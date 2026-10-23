# M. Issue Triaging

**Findings file:** `.tmp/pr-tidying-findings-issue-triage.md`
**ID prefix:** `M1`, `M2`, …
**Read-set:** the issue docs this branch added — `git diff --name-only --diff-filter=A <parent>..HEAD -- .claude/plans/issues/` — plus whatever each doc cites, as `issue-triaging` directs.

**Run inline by the orchestrator in `SKILL.md` Phase 2b**, with the `issue-triaging` skill loaded. No agent is dispatched.

## Which issues

An added issue needs triage when its triage is incomplete — `issue-triaging` §7 defines complete. Read each with `node .claude/skills/html-planning/planr.js meta <file> --format json`; a field is unset when its `source` is `null`.

No added issue needs triage → skip M and say so in the coverage line.

## Propose, don't write

For each selected issue, follow `issue-triaging` from §0 through §6 and reach one verdict:

- **RATED** — the §9 one-pass command, filled in, **not yet run**.
- **RESOLVED** or **DUPLICATE** — `issue-triaging` §0's finding, with its evidence. This is a deletion proposal under `issue-creating`, not a rating.

Write every verdict into the findings file: one `M<n>` row per issue, then each issue's proposed field values and its command verbatim.

## Report (Phase 3)

| # | Issue | Verdict | Proposed priority | Off-matrix |
|---|-------|---------|-------------------|------------|
| M1 | `adventure-map-drops-hand-edge.html` | RATED | p1 | matrix p2 → p1: breaks invariant 2 on every rebuild |

Follow the table with each issue's proposed values. **Every verdict needs the DM's approval, per issue** — approve, amend a field, or reject.

## Apply (Phase 4, last)

Apply after every other category. For each approved verdict, run its command with any amendments, then:

```bash
node .claude/skills/html-planning/planr.js check <file> --strict
PYTHONUTF8=1 py .claude/skills/issue-triaging/scripts/review.py check
```

`review.py check` exits 1 when `class=latent` and `reach=none` disagree; fix the fields, never the script. An approved RESOLVED or DUPLICATE verdict is a `git rm` per `issue-creating`.

Commit the triage alone as `mapping: triage <n> issue(s) filed on this branch`.

## What NOT to flag/do

- Re-triage an issue whose triage is complete, or one this branch did not add.
- Run a verdict's command before the DM approves it.
- Hand-edit an issue doc. Every write goes through `planr`.
