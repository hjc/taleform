# F. Planning and Rambling Comments

**Findings file:** `.tmp/pr-tidying-findings-comments.md`
**ID prefix:** `F1`, `F2`, …
**Read-set:** ADDED comment lines across the whole branch diff — `src/`, `test/`, `scripts/`, `esbuild.config.mjs`. Diff-scoped by construction: a pre-existing comment is out of scope no matter how bad it is.

**Start mechanically, then triage by hand.** Extract the added comment lines from `<parent>..HEAD` first (`//`, `/* */`, `/** */` JSDoc), then judge each one. Reading whole files misses comments and wastes the pass.

Comments that reference internal planning artifacts or are excessively descriptive.

## What to flag

- References to "Phase 1", "Phase 2", "PRD", "slice", "TDD plan", "ticket", "wayfinding", a decision id (`D12`, `q04`), or a similar planning artifact. Replace with plain language or numbered steps. A plan's decision that matters to the code belongs in `.claude/context/` or `CLAUDE.md`, not a comment citing the plan.
- References to deleted functions, retired properties, or "the old approach" when the reader has no context for what was old. A retired frontmatter property is documented by its `RETIRED` entry in `src/builders/schema.ts`, not by a comment.
- Stream-of-thought comments explaining WHY a decision was made during development rather than WHAT the code does.
- JSDoc referencing a planning document ("all the fields the PRD lists").
- **Conversational double-quotes — a comment quoting the development chat, not the code.** A double-quoted phrase that paraphrases a DM-reported *symptom* or restates the *request*, usually appended as a breadcrumb via "hence", "i.e.", "so-called", "the … case", or a parenthetical aside: `// …dragged cards snap back (hence "my layout keeps resetting")`. Rewrite the comment to state the behavior in technical terms and drop the quoted aside, keeping any genuine technical detail it carried.

  To find candidates, scan ADDED comment lines in the diff for a `"` — any quote on a comment line, not just same-line `"…"` pairs, so a phrase split across two lines is caught — then triage each by hand.

## What NOT to flag

- Comments explaining a non-obvious story rule or edge case (why an optional beat is bypassed, why a link leaving the mission is labelled with its heading).
- Comments recording a tested Obsidian behaviour the code depends on (canvas drops a default `toEnd: "arrow"`; unquoted `[[X]]` parses as a nested array).
- TODO comments for known future work.
- Module, interface and field JSDoc describing purpose and usage.
- **Double-quotes around a legitimate technical referent** — the common, valid case. A literal value the code manipulates (`"generated": "adventure-map"`, a `beat-status` token, a region id), test-fixture data, the name of a real test or function being cross-referenced, an example of generated text, or a domain term the comment is defining. These quote the CODE, not the conversation. Only the conversational symptom/request paraphrase is a defect.

## Report shape

| # | File | Line | Comment | Action |
|---|------|------|---------|--------|
| F1 | `src/builders/adventureMap.ts` | 14 | `// Phase 2: lay out the missions per slice 3 spec` | Rewrite as a plain description of the step |
| F2 | `src/builders/adventureMap.ts` | 88 | `// …positions reset (hence "my layout keeps resetting")` | Drop the quoted aside; state the behaviour technically |

**Quote the offending text in every finding.** The false-positive rate on the double-quote rule is high enough that the DM needs to see the string to review it.
