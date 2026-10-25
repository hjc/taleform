---
name: context-compacting
description: Prune and compact a context or instruction doc — cut what is stale, repeated or derivable, then rewrite the lines `planr wordy` flags without dropping a rule, literal or number that survives the cut. Use on a `CLAUDE.md`, a `docs/` Markdown file, or any Markdown file under `.claude/` (skill, skill reference, agent definition, command) when `planr wordy` flags it, after writing one, or when asked to compact one.
---

# Context Compacting

A context doc is read in full every time an agent works in its area, so every line costs. **The bar for a line to stay: it is hard to derive from the code, and it is needed often when working in this area.** This skill first cuts what fails that bar, then rewrites what `planr wordy` still flags.

`planr` below is `node .claude/skills/html-planning/planr.js`.

## Targets

- `docs/context/**`, every `CLAUDE.md`, every `SKILL.md`, and `docs/**/*.md`.
- **Never a generated doc** — one whose header carries `> Auto-generated`. Fix the generator or leave the line.
- **Never pass a `--max-*` limit** to make a run pass.

## MANDATORY first step — load `html-planning`

**Invoke the `html-planning` skill before anything else.** The loop runs `planr`, and the `wordy` item shape is defined there.

## The loop

1. **Prune** the whole doc, not only flagged lines (below). Skip the prune when the caller limits the run to lines it wrote (`librarian`); then work only those lines' findings.
2. `planr wordy <file> --format json > .tmp/wordy.json` — the work list. The item shape is `.claude/skills/html-planning/SKILL.md` § "Wordy lines"; the loop reads `path`, `line`, `context` and `section`.
3. Work the findings from the bottom line up, so the line numbers not yet reached stay valid. **Compact**, **split**, or **move a cell out** of its table.
4. Re-run `planr wordy` on the file. Stop at exit 0, or when every remaining finding is justified (see "Leaving a finding").
5. Run the literal check, then `node .claude/skills/wayfinding/check-tooling.js`.

## Prune

Read the doc end to end and cut each line that fails the bar:

| Cut | Replace with |
|---|---|
| A reference to planning: slice or phase ids (`S3`, `M2`, "since S3", "until S5"), PRD requirement ids (`FR-030`), plan or PRD paths, "the plan says" | Nothing. State the behaviour as it is today. Check the id is planning before cutting it: `S3` is also AWS S3 |
| A claim the code no longer bears out | The true claim, checked against the code, or nothing |
| A full method signature, field list, request/response shape, or error-code list the code already declares | A pointer: the file and symbol (`views.py` → `AskTurnView`) plus the one rule a reader would get wrong without the doc |
| Content another `docs/context/` doc covers in full | A one-line pointer to that doc |
| A fact repeated elsewhere in the same doc | Nothing. Keep the copy where it is acted on |
| History: how a rule was found, what was tried, what a thing "used to" do, dates, commits | The rule, as an instruction |
| Rationale that does not name a specific wrong edit and what it breaks | Nothing. Rationale that does gets folded into the rule's own sentence |
| Worked examples, and lists the code already holds | Nothing, or a pointer |

Keep, for every line that survives the prune:

- Every backtick literal: path, symbol, flag, command, exact string.
- Every load-bearing number: a limit, a count a check asserts, a version.
- Every qualifier that changes meaning: `never`, `only`, `unless`, `before`, `after`.
- Every trap: a rule whose violation fails silently or passes review.

**Verify before cutting a claim as outdated.** Read the code it names. A fact you could not check stays, and goes in the report.

## Compact

A compacted line states the rule, not its rationale, in fewer words. Root `CLAUDE.md` → "Writing Context & Instruction Docs" sets what a line keeps and drops.

## Split

- Split a bullet or paragraph that is really a section: it becomes a heading one level down, with one short bullet per fact.
- Its bold lead-in becomes the heading text.
- The new section sits where the line was.

## Move a cell out

A table cell that holds more than a summary is a section squeezed into a row.

- The cell keeps one short summary sentence.
- The detail becomes a section directly after the table, headed by the row's key (the endpoint, the task, the field), one short bullet per fact.
- The prune applies to it: a contract the code declares becomes a pointer.

## HTML docs

Edit only through `planr`, at the finding's `section` address — never by hand.

- A phrase: `planr replace <file> <section> --match "…" --with "…"`.
- A block, a split or a moved cell: `planr read <file> <section> --body > .tmp/hunk.html`, edit the hunk, then `planr set-body <file> <section> --file .tmp/hunk.html`.
- Finish with `planr check --strict <file>`.

## The literal check

List the literals that left the file:

```bash
git show HEAD:<file> | grep -o '`[^`]*`' | sort -u > .tmp/lit-before.txt
grep -o '`[^`]*`' <file> | sort -u > .tmp/lit-after.txt
comm -23 .tmp/lit-before.txt .tmp/lit-after.txt
```

For an HTML doc, match `<code>[^<]*</code>` instead. Every printed literal is either restored or accounted for in the report as **pruned** (stale, planning, derivable from a named file, covered by a named doc, duplicate) or **example**. A literal dropped by a compaction alone is a defect.

## Leaving a finding

A finding may stay only when cutting it would drop a fact that passes the bar, and no split or move applies — a long literal command, an irreducible table cell. Report each as `path:line — reason`.

## Report

Per file:

- Lines and characters, before and after.
- `wordy` findings, before and after.
- What was pruned, grouped by the reasons in the Prune table.
- Every claim fixed or cut as outdated, with the code that showed it.
- Every claim that looked outdated but could not be checked.
- Each finding left, with its reason.
