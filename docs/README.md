# docs/

Everything Taleform knows, plans, tracks and decides lives here. The AI tooling itself stays under `.claude/`: skills, agents, agent memory and ephemeral reviews.

| Path | Holds | Tracked |
|---|---|---|
| `context/<name>.md` | Context docs: the hard-won facts about tricky parts of the codebase, read by agents before they plan or review. They outlive every effort; decisions graduate into them (`docs/sdlc.md` §4d) | yes |
| `GLOSSARY.md` | The terms every doc, plan and PR uses, each with one meaning. `CLAUDE.md` mandates loading it | yes |
| `sdlc.md` | How Taleform is built and delivered: the development loop, branches and stacks, the AI tooling | yes |
| `roadmap.md` | The PRD register, its dependency graph, and unscheduled product ideas | yes |
| `issues/<slug>.html` | One issue doc per defect or gap not being fixed right now (`issue-creating`), triaged in place (`issue-triaging`) | yes |
| `features/<feature>/` | Everything one feature produces while it is being built (below) | yes, except `tdds/` |

## A feature folder

`features/<feature>/` is named for the feature in kebab-case. Every TDD plan belongs to a feature folder, so a one-branch fix gets one too, named for the fix.

| Path | Holds | Written by |
|---|---|---|
| `prd-<feature>.html` | The PRD: cross-cutting contract and slice list | `prd-writing` |
| `slices/<n>-<slug>.html` | A thin spec per slice | `prd-writing` |
| `wayfinding/` | The map, its tickets, the three registers and `assets/` | `wayfinding` |
| `qa-checklist.md` | The manual QA checklist | `qa-checklist-writing` |
| `tdds/<n>-<slug>.html` | One TDD plan per slice. **Gitignored** (`docs/features/**/tdds/*`) | `tdd-planner` |

## Lifecycle

Context docs are permanent; everything else here is not. Every planning artifact is deleted when its work completes, once the graduation check has passed: a fixed issue's doc when the fix ships, and a feature folder at effort close. The durable facts graduate to `docs/context/` or `CLAUDE.md` first. `docs/sdlc.md` §4e has the rules; `/pr-tidying` Category K enacts them.

Every HTML document here is a `planr` document. Query it rather than listing directories:

```
node .claude/skills/html-planning/planr.js next docs/issues --format json
node .claude/skills/html-planning/planr.js query docs/features --fields path,title,status
```
