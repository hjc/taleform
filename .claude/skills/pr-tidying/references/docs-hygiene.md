# J. Instruction & Context Doc Hygiene

**Findings file:** `.tmp/pr-tidying-findings-docs-hygiene.md`
**ID prefix:** `J1`, `J2`, …
**Read-set:** two disjoint sets.

1. **Branch-touched prose** — root `CLAUDE.md`, `docs/sdlc.md`, any `docs/context/*.md`, `SKILL.md` or skill reference, agent or command file the branch ADDED or substantially edited (`git diff <parent>..HEAD -- '*.md'`).
2. **Every always-loaded frontmatter `description`** in `.claude/skills/*/SKILL.md`, `.claude/agents/*.md` and `.claude/commands/*.md` — touched or not, **but only if the branch added or edited one of those files**. A generator emits bloated ones by default, so a branch adding one artifact is the moment to check its neighbours.

This audit asks **"is this prose the right size and shape"**, never "is it true" — truth is Category H. Note a factual error as an H cross-reference, not a J finding.

The standard is `docs/sdlc.md` §5b → "What makes a good agent or skill": a precise trigger, single responsibility, grounded in the codebase, **written for retrieval, not rendering** (literals in backticks, tables for dense relational data, nothing that is only there to look good). Read it before flagging anything. For a context or instruction doc, `node .claude/skills/html-planning/planr.js wordy <file>` flags long, dense and run-on lines mechanically; the `context-compacting` skill is the fix procedure.

## What to flag for UPDATE (apply after approval)

- **Render chrome** added by this branch to `CLAUDE.md` or a `docs/context` doc: clickable Markdown links (`[text](path)`), anchor-link TOCs (`[x](#x)`), or HTML render tags (`<sub>`, `<br>`). Replace a link with the bare backtick path, drop anchors and HTML.
- **Frontmatter `description` bloat** — an always-loaded `description` that duplicates its body instead of carrying a trigger plus a one-line scope. Tells: embedded worked examples (`Examples:` / `<example>` / `User:`/`Assistant:`/`<commentary>` blocks), a full workflow or category list, or the trigger stated twice (an opening "Use this agent/skill when…" AND a closing "Triggers when…"). Commonly 1.5–2.5 KB each, charged every session. **Audit agent and command frontmatter explicitly, not just skills.** Trim to a trigger + one-line scope, **preserving load-bearing distinctions** ("reviews plans, not code"; "produces design docs, not TDD plans"; a required output extension).
- **Verbose context doc** — prose that restates the codebase, or that would be tighter as a table.
- **Bloated branch-authored prose** — a section this branch added or substantially edited in `CLAUDE.md` or a context doc with a point made twice, redundant bullets, or padding. Tighten only what the branch touched.
- *For the last three:* preserve the trigger ("when to use") and every load-bearing fact; cut what belongs in the body.

**Exception — deliberate hoisting into an always-loaded file is not duplication.** An always-loaded file may restate a subset of an on-invoke artifact on purpose: the part a session needs in hand to know it should reach for that artifact at all, or to take the actions it performs constantly. `CLAUDE.md` § Invariants restating what `docs/sdlc.md` §2 checks per PR is the standing example. That subset is the trigger and the working set; the copy it resembles is the reference. **Do not flag it as duplication, and do not "collapse it to a pointer"** — a pointer only helps a reader who already knows to follow it. Flag it only if it is *wrong*, contradicts its source, or has grown past the working set into the reference. When you cannot tell which it is, **report it as an open question, do not trim** — the author chose what to hoist and that choice is not recoverable from the text.

## What NOT to flag

- Cosmetic rewording of prose the branch did not touch — except `description` bloat on a sibling artifact (read-set 2).
- A factual staleness or a missing fact — Category H.
- Anything under `docs/features/`, `docs/issues/` or `docs/roadmap.md` — Category K.
- `README.md` — it is user-facing documentation for a DM, not an instruction doc; its accuracy is Category H's and its prose is the author's.

## Report shape

| # | Artifact | Line | Issue | Action | Saving |
|---|----------|------|-------|--------|--------|
| J1 | `CLAUDE.md` | § Architecture | Branch's new builder note restates the `BUILDERS` order twice | Collapse to one | — |
| J2 | `.claude/skills/<skill>/SKILL.md` | frontmatter | `description` carries the full category list | Trim to trigger + one-line scope | ~0.8 KB/session |
| J3 | `CLAUDE.md` | 52 | `[the deploy script](scripts/deploy.mjs)` added by this branch | Bare backtick path | — |

**State the per-session saving for every `description` finding** — without it the finding reads as taste.
